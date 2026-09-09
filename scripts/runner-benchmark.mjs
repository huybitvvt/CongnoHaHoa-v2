// Opt-in live read benchmark. Uses only existing destination jobs; pauses the runner afterward.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const token = fs.readFileSync('.runner-data/local-token', 'utf8').trim();
const db = new DatabaseSync('.runner-data/queue.sqlite');
const mode = process.argv.includes('--full') ? 'full' : 'quick';
db.exec('PRAGMA busy_timeout=5000');
const api = async (route, body) => {
  const response = await fetch(`http://127.0.0.1:4317/${route}`, { method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
const initial = await api('status');
if (initial.enabled || initial.active || initial.outbox) throw new Error('Pause and drain the runner before benchmarking.');
const chosen = db.prepare('SELECT id FROM jobs WHERE active=1 AND failures=0 AND full_at>0 ORDER BY id LIMIT 8').all();
if (!chosen.length) throw new Error('No completed full reads available for quick benchmark.');
const saved = db.prepare('SELECT id,due FROM jobs WHERE active=1').all();
const ids = new Set(chosen.map((r) => r.id));
const started = Date.now();
db.exec('BEGIN IMMEDIATE');
for (const row of saved) {
  db.prepare('UPDATE jobs SET due=? WHERE id=?').run(ids.has(row.id) ? started : started + 3600_000, row.id);
  if (ids.has(row.id) && mode === 'full') db.prepare('UPDATE jobs SET full_at=0 WHERE id=?').run(row.id);
}
db.exec('COMMIT');
try {
  await api('control', { enabled: true, concurrency: 1 });
  while (Date.now() - started < 6 * 60_000) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const count = db.prepare('SELECT count(*) n FROM measurements WHERE at>=? AND mode=?').get(started, mode).n;
    if (count >= chosen.length) break;
  }
} finally {
  await api('control', { enabled: false });
  // Allow the one in-flight request to finish and upload before restoring the unsampled schedule.
  for (let i = 0; i < 55; i++) {
    const status = await api('status');
    if (!status.active && !status.outbox) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  db.exec('BEGIN IMMEDIATE');
  for (const row of saved) if (!ids.has(row.id)) db.prepare('UPDATE jobs SET due=? WHERE id=? AND token IS NULL').run(row.due, row.id);
  db.exec('COMMIT');
  const samples = db.prepare('SELECT ok,mode,duration FROM measurements WHERE at>=?').all(started);
  const report = { started: new Date(started).toISOString(), elapsedSeconds: (Date.now() - started) / 1000,
    selected: chosen.length, samples, final: await api('status') };
  fs.writeFileSync(`.runner-data/${mode}-benchmark.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  db.close();
}
