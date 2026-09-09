import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';

export const INTERVAL = 30 * 60_000;
export const FULL_INTERVAL = 6 * 60 * 60_000;
export const LEASE = 120_000;
const fingerprint = (result) => createHash('sha256').update(JSON.stringify([
  result.rawStatus || '', result.edd || '', result.currentEvent || null,
])).digest('hex');

export function mergeHistory(previous = [], incoming = []) {
  const seen = new Set();
  return [...incoming, ...previous].filter((event) => {
    const key = JSON.stringify([event.rawStatus, event.date, event.time, event.location, event.details]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateResult(result, code) {
  if (!result || result.code !== code || result.ok !== true || typeof result.status !== 'string'
      || !result.status.trim() || result.status.length > 160 || typeof result.rawStatus !== 'string'
      || result.rawStatus.length > 200 || !Number.isFinite(Date.parse(result.checkedAt))) return false;
  if (result.edd && !/^\d{4}-\d{2}-\d{2}$/.test(result.edd)) return false;
  if (result.mode !== 'full' && result.mode !== 'quick') return false;
  if (result.mode === 'full' && !Array.isArray(result.history)) return false;
  return (!result.history || result.history.length <= 100) && (result.history || []).every((e) =>
    e && typeof e.status === 'string' && typeof e.rawStatus === 'string'
    && Object.values(e).every((v) => typeof v === 'string' && v.length <= 1000));
}

export class Queue {
  constructor(file, { interval = INTERVAL, fullInterval = FULL_INTERVAL, stopDelivered = false } = {}) {
    this.interval = interval;
    this.fullInterval = fullInterval;
    this.stopDelivered = stopDelivered;
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, code TEXT NOT NULL, snapshot TEXT NOT NULL,
        due INTEGER NOT NULL, full_at INTEGER NOT NULL DEFAULT 0,
        fingerprint TEXT, failures INTEGER NOT NULL DEFAULT 0,
        token TEXT, worker TEXT, lease_until INTEGER, started INTEGER,
        active INTEGER NOT NULL DEFAULT 1, delivered_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS active_code ON jobs(code) WHERE token IS NOT NULL;
      CREATE TABLE IF NOT EXISTS outbox (token TEXT PRIMARY KEY, job_id TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS measurements (
        at INTEGER NOT NULL, ok INTEGER NOT NULL, duration INTEGER NOT NULL, mode TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  setting(key, value) {
    if (value !== undefined) this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, JSON.stringify(value));
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    return row ? JSON.parse(row.value) : undefined;
  }
  sync(records, now = Date.now()) {
    this.transaction(() => {
      this.db.exec('UPDATE jobs SET active=0');
      const insert = this.db.prepare(`INSERT INTO jobs(id,code,snapshot,due,full_at) VALUES (?,?,?,?,0)
        ON CONFLICT(id) DO UPDATE SET active=1, snapshot=excluded.snapshot,
        code=CASE WHEN jobs.token IS NULL THEN excluded.code ELSE jobs.code END`);
      for (const row of records) {
        if (!/^[A-Z0-9]{7,34}$/.test(row.tracking_code)) continue;
        insert.run(row.id, row.tracking_code, JSON.stringify(row),
          row.checked_at ? Math.min(now, Date.parse(row.checked_at) + this.interval) : 0);
      }
    });
  }
  expire(now = Date.now()) {
    // A durable result awaiting upload owns its job until the upload is acknowledged.
    this.db.prepare(`UPDATE jobs SET token=NULL, worker=NULL, due=?, failures=failures+1
      WHERE token IS NOT NULL AND lease_until < ? AND token NOT IN (SELECT token FROM outbox)`).run(now + 60_000, now);
  }
  claim(worker, now = Date.now()) {
    return this.transaction(() => {
      this.expire(now);
      const row = this.db.prepare(`SELECT * FROM jobs WHERE active=1 AND token IS NULL AND due<=?
        AND code NOT IN (SELECT code FROM jobs WHERE token IS NOT NULL) ORDER BY due,id LIMIT 1`).get(now);
      if (!row) return null;
      const token = randomUUID();
      const snapshot = JSON.parse(row.snapshot);
      const mode = !snapshot.checked_at || !row.full_at || now - row.full_at >= this.fullInterval ? 'full' : 'quick';
      this.db.prepare('UPDATE jobs SET token=?,worker=?,lease_until=?,started=? WHERE id=?').run(token, worker, now + LEASE, now, row.id);
      return { token, id: row.id, code: row.code, mode };
    });
  }
  receive(worker, token, result, now = Date.now()) {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM jobs WHERE token=? AND worker=?').get(token, worker);
      if (!row || row.lease_until < now) return false;
      if (this.db.prepare('SELECT 1 FROM outbox WHERE token=?').get(token)) return true;
      const snapshot = JSON.parse(row.snapshot);
      const requestedMode = !snapshot.checked_at || !row.full_at || row.started - row.full_at >= this.fullInterval ? 'full' : 'quick';
      const ok = validateResult(result, row.code) && result.mode === requestedMode;
      const payload = ok ? result : { ok: false, error: String(result?.error || 'Kết quả UPS không hợp lệ').slice(0, 500) };
      this.db.prepare('INSERT INTO outbox VALUES (?,?,?)').run(token, row.id, JSON.stringify(payload));
      this.db.prepare('INSERT INTO measurements VALUES (?,?,?,?)').run(now, ok ? 1 : 0, now - row.started, requestedMode);
      this.db.prepare('DELETE FROM measurements WHERE at<?').run(now - 7 * 86400_000);
      return true;
    });
  }
  pending() {
    return this.db.prepare(`SELECT o.*, j.snapshot,j.code,j.fingerprint,j.full_at,j.failures,j.delivered_count
      FROM outbox o JOIN jobs j ON j.id=o.job_id ORDER BY o.rowid LIMIT 100`).all();
  }
  acknowledge(item, current, now = Date.now()) {
    const result = JSON.parse(item.payload);
    const changed = result.ok && item.fingerprint && item.fingerprint !== fingerprint(result);
    const fullAt = result.ok && result.mode === 'full' ? now : item.full_at;
    const failures = result.ok ? 0 : item.failures + 1;
    const delivered = result.ok && result.rawStatus.toLowerCase() === 'delivered' ? item.delivered_count + 1 : 0;
    let due = result.ok ? now + this.interval : now + Math.min(6 * 3600_000, 60_000 * 2 ** Math.min(failures - 1, 9));
    if (result.ok && result.mode === 'quick' && changed) due = now;
    if (this.stopDelivered && delivered >= 2) due = now + 7 * 86400_000;
    this.transaction(() => {
      this.db.prepare(`UPDATE jobs SET snapshot=?,due=?,full_at=?,fingerprint=?,failures=?,delivered_count=?,
        token=NULL,worker=NULL WHERE id=? AND token=?`).run(JSON.stringify(current), due,
        changed && result.mode === 'quick' ? 0 : fullAt,
        result.ok ? fingerprint(result) : item.fingerprint, failures, delivered, item.job_id, item.token);
      this.db.prepare('DELETE FROM outbox WHERE token=?').run(item.token);
    });
  }
  stats(now = Date.now()) {
    this.expire(now);
    const counts = this.db.prepare(`SELECT count(*) total, sum(due<=? AND token IS NULL) due,
      sum(token IS NOT NULL) active, sum(failures>0) errors FROM jobs WHERE active=1`).get(now);
    const recent = this.db.prepare('SELECT * FROM measurements WHERE at>? ORDER BY duration').all(now - 15 * 60_000);
    const successes = recent.filter((r) => r.ok);
    return { ...counts, outbox: this.db.prepare('SELECT count(*) n FROM outbox').get().n,
      samples: recent.length, successful: successes.length, failed: recent.length - successes.length,
      successfulPerMinute: +(successes.length / 15).toFixed(2),
      p95Seconds: recent.length ? +(recent[Math.min(recent.length - 1, Math.ceil(recent.length * 0.95) - 1)].duration / 1000).toFixed(1) : 0 };
  }
  close() { this.db.close(); }
}
