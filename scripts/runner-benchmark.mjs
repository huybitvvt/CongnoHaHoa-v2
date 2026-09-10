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
const saved = db.prepare('SELECT id,due,full_at FROM jobs WHERE active=1').all();
const ids = new Set(chosen.map((r) => r.id));
const started = Date.now();
const observedMeasurements = new Set();
const awaitingUpload = new Map();
const uploadLagSamples = [];
let targetCompletedAt = 0;
let targetSuccesses = 0;
const uploadMonitor = setInterval(() => {
  const measurements = db.prepare('SELECT rowid,at FROM measurements WHERE at>=? ORDER BY rowid').all(started);
  for (const sample of measurements) if (!observedMeasurements.has(sample.rowid)) {
    observedMeasurements.add(sample.rowid);
    awaitingUpload.set(sample.rowid, sample.at);
  }
  if (db.prepare('SELECT count(*) n FROM outbox').get().n === 0) {
    const observedAt = Date.now();
    for (const [rowid, receivedAt] of awaitingUpload) {
      uploadLagSamples.push(Math.max(0, observedAt - receivedAt));
      awaitingUpload.delete(rowid);
    }
  }
}, 100);
db.exec('BEGIN IMMEDIATE');
for (const row of saved) {
  if (ids.has(row.id)) db.prepare('UPDATE jobs SET due=?,full_at=? WHERE id=?')
    .run(started, mode === 'full' ? 0 : started, row.id);
  else db.prepare('UPDATE jobs SET due=? WHERE id=?').run(started + 3600_000, row.id);
}
db.exec('COMMIT');
try {
  await api('control', { enabled: true, concurrency: 1 });
  while (Date.now() - started < 6 * 60_000) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const target = db.prepare('SELECT count(*) n,sum(ok) successes FROM measurements WHERE at>=? AND mode=?').get(started, mode);
    if (target.n >= chosen.length) {
      targetCompletedAt = Date.now(); targetSuccesses = target.successes || 0; break;
    }
  }
} finally {
  await api('control', { enabled: false, concurrency: initial.requestedConcurrency });
  // Allow the one in-flight request to finish and upload before restoring the unsampled schedule.
  for (let i = 0; i < 55; i++) {
    const status = await api('status');
    if (!status.active && !status.outbox) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  clearInterval(uploadMonitor);
  db.exec('BEGIN IMMEDIATE');
  for (const row of saved) if (!ids.has(row.id)) db.prepare('UPDATE jobs SET due=? WHERE id=? AND token IS NULL').run(row.due, row.id);
  if (mode === 'quick') for (const row of saved) if (ids.has(row.id)) {
    // Preserve a supplemental full reconciliation when the quick observation changed.
    db.prepare('UPDATE jobs SET full_at=? WHERE id=? AND full_at=?').run(row.full_at, row.id, started);
  }
  db.exec('COMMIT');
  const samples = db.prepare('SELECT ok,mode,duration FROM measurements WHERE at>=?').all(started);
  const sortedUploadLags = uploadLagSamples.toSorted((a, b) => a - b);
  const report = { started: new Date(started).toISOString(), elapsedSeconds: (Date.now() - started) / 1000,
    targetElapsedSeconds: targetCompletedAt ? (targetCompletedAt - started) / 1000 : null,
    successfulPerMinute: targetCompletedAt ? +(targetSuccesses * 60_000 / (targetCompletedAt - started)).toFixed(2) : 0,
    selected: chosen.length, samples,
    uploadLagMs: sortedUploadLags.length ? {
      samples: sortedUploadLags,
      average: Math.round(sortedUploadLags.reduce((sum, value) => sum + value, 0) / sortedUploadLags.length),
      p95: sortedUploadLags[Math.ceil(sortedUploadLags.length * 0.95) - 1],
    } : null,
    final: await api('status') };
  fs.writeFileSync(`.runner-data/${mode}-benchmark.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  db.close();
}
