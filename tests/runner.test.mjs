import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Queue, INTERVAL, LEASE, mergeHistory, validateResult } from '../runner/queue.mjs';
import { shouldDiscard } from '../runner/observations.mjs';

const row = (id = 'a') => ({ id, tracking_code: `1Z00000000000000${id.toUpperCase().padStart(2, '0')}`, checked_at: null, history: [] });
const result = (code, at, overrides = {}) => ({ ok: true, code, mode: 'full', status: 'Đang vận chuyển', rawStatus: 'On the Way',
  checkedAt: new Date(at).toISOString(), history: [{ status: 'Đã nhận', rawStatus: 'Origin Scan', date: '09/10/2026', time: '1:00 PM' }], ...overrides });
const receive = (q, job, at, overrides) => q.receive('profile-1', job.token, result(job.code, at, overrides), at);

test('one lease per code, next job can start before another finishes', () => {
  const q = new Queue(':memory:'); q.sync([row('a'), row('b'), row('c')], 1000);
  const first = q.claim('profile-1', 1000), second = q.claim('profile-2', 1000);
  assert.notEqual(first.code, second.code);
  receive(q, first, 2000); const item = q.pending()[0]; q.acknowledge(item, row('a'), 2000);
  assert.equal(q.claim('profile-1', 2000).code, row('c').tracking_code);
  assert.equal(q.stats(2000).active, 2); q.close();
});

test('expired worker recovers, late and wrong-worker results cannot replace its successor', () => {
  const q = new Queue(':memory:'); q.sync([row()], 0); const first = q.claim('profile-1', 0);
  assert.equal(q.receive('profile-2', first.token, result(first.code, 1), 1), false);
  q.expire(LEASE + 1);
  const next = q.claim('profile-2', LEASE + 60_002);
  assert.ok(next); assert.notEqual(next.token, first.token);
  assert.equal(receive(q, first, LEASE + 60_003), false); q.close();
});

test('outbox survives process restart and blocks duplicate work even after lease expiry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speego-test-')); const file = path.join(dir, 'queue.db');
  let q = new Queue(file); q.sync([row()], 0); const job = q.claim('profile-1', 0);
  receive(q, job, 1000); q.close(); q = new Queue(file);
  assert.equal(q.pending().length, 1); assert.equal(q.claim('profile-2', LEASE * 2), null);
  q.acknowledge(q.pending()[0], row(), 5000); assert.equal(q.claim('profile-1', 5000 + INTERVAL - 1), null);
  assert.ok(q.claim('profile-1', 5000 + INTERVAL)); q.close();
  fs.rmSync(dir, { recursive: true }); // Only this freshly-created test directory.
});

test('quick observations preserve history and changes schedule an immediate full reconciliation', () => {
  const q = new Queue(':memory:'); q.sync([row()], 0); let job = q.claim('profile-1', 0);
  receive(q, job, 1000); q.acknowledge(q.pending()[0], { ...row(), checked_at: new Date(1000).toISOString() }, 1000);
  job = q.claim('profile-1', 1000 + INTERVAL); assert.equal(job.mode, 'quick');
  const quick = { mode: 'quick', history: undefined, currentEvent: { rawStatus: 'On the Way', status: 'Đang vận chuyển', location: 'New city' } };
  receive(q, job, 2000 + INTERVAL, quick); q.acknowledge(q.pending()[0], { ...row(), checked_at: new Date(2000 + INTERVAL).toISOString() }, 2000 + INTERVAL);
  assert.equal(q.claim('profile-1', 2000 + INTERVAL).mode, 'full');
  const previous = result(row().tracking_code, 1000).history;
  assert.deepEqual(mergeHistory(previous, []), previous); assert.equal(mergeHistory(previous, previous).length, 1); q.close();
});

test('failed reads back off without fabricating success; malformed results rejected', () => {
  const q = new Queue(':memory:'); q.sync([row()], 0); const job = q.claim('profile-1', 0);
  receive(q, job, 1000, { code: 'WRONG' }); assert.equal(JSON.parse(q.pending()[0].payload).ok, false);
  q.acknowledge(q.pending()[0], row(), 1000);
  assert.equal(q.claim('profile-1', 60_999), null); assert.ok(q.claim('profile-1', 61_000));
  assert.equal(validateResult(result(job.code, 1000, { history: null }), job.code), false); q.close();
});

test('deleted records stop being scheduled; duplicate result delivery is idempotent', () => {
  const q = new Queue(':memory:'); q.sync([row()], 0); const job = q.claim('profile-1', 0);
  receive(q, job, 1000); receive(q, job, 1001);
  assert.equal(q.pending().length, 1); assert.equal(q.stats(1001).samples, 1);
  q.acknowledge(q.pending()[0], row(), 2000); q.sync([], 3000);
  assert.equal(q.claim('profile-1', INTERVAL * 2), null); q.close();
});

for (const slotCount of [6, 30]) test(`2000 jobs drain across ${slotCount} slots without loss, duplicate leases, or an unbounded outbox`, () => {
  const q = new Queue(':memory:');
  let time = 1_800_000_000_000;
  q.sync(Array.from({ length: 2000 }, (_, i) => row(String(i))), time);
  const slots = Array.from({ length: slotCount }, (_, i) => ({ worker: `profile-${i % 3 + 1}`, job: null }));
  let completed = 0;
  while (completed < 2000) {
    for (const slot of slots) if (!slot.job) slot.job = q.claim(slot.worker, time);
    const live = slots.filter((slot) => slot.job);
    assert.equal(new Set(live.map((slot) => slot.job.code)).size, live.length);
    assert.ok(live.length > 0);
    // Deliberately finish in reverse order, not as a batch.
    const slot = live[live.length - 1]; time += 5;
    assert.equal(q.receive(slot.worker, slot.job.token, result(slot.job.code, time), time), true);
    const pending = q.pending(); assert.equal(pending.length, 1);
    q.acknowledge(pending[0], { ...row(slot.job.id), checked_at: new Date(time).toISOString() }, time);
    slot.job = null; completed++;
  }
  const stats = q.stats(time);
  assert.equal(stats.total, 2000); assert.equal(stats.successful, 2000);
  assert.equal(stats.active, 0); assert.equal(stats.outbox, 0); assert.equal(stats.due, 0);
  q.close();
});

test('100 -> 200 -> 400 while working preserves leases, schedules and successful observations', () => {
  const q = new Queue(':memory:'); const base = 1_800_000_000_000;
  const rows = Array.from({ length: 400 }, (_, i) => row(String(i).padStart(3, '0')));
  q.sync(rows.slice(0, 100), base);
  const working = q.claim('profile-1', base);
  q.sync(rows.slice(0, 200), base + 1000);
  assert.equal(q.stats(base + 1000).total, 200);
  assert.equal(q.db.prepare('SELECT token FROM jobs WHERE id=?').get(working.id).token, working.token);
  receive(q, working, base + 2000);
  const current = { ...rows.find((r) => r.id === working.id), checked_at: new Date(base + 2000).toISOString() };
  q.acknowledge(q.pending()[0], current, base + 2000);
  const due = q.db.prepare('SELECT due FROM jobs WHERE id=?').get(working.id).due;
  q.sync(rows, base + 3000); q.sync(rows, base + 4000);
  assert.equal(q.stats(base + 4000).total, 400);
  assert.equal(q.db.prepare('SELECT due FROM jobs WHERE id=?').get(working.id).due, due);
  assert.equal(q.stats(base + 4000).due, 399);
  q.close();
});

test('refresh during a quick lease cannot change its requested mode or baseline', () => {
  const q = new Queue(':memory:'); const base = 1_800_000_000_000;
  q.sync([row()], base); let job = q.claim('profile-1', base);
  receive(q, job, base + 1000); const current = { ...row(), checked_at: new Date(base + 1000).toISOString() };
  q.acknowledge(q.pending()[0], current, base + 1000);
  job = q.claim('profile-1', base + INTERVAL + 1000);
  assert.equal(job.mode, 'quick');
  q.sync([row()], base + INTERVAL + 2000); // A concurrent reset on the website.
  receive(q, job, base + INTERVAL + 3000, { mode: 'quick', history: undefined });
  assert.equal(JSON.parse(q.pending()[0].payload).ok, true);
  assert.equal(JSON.parse(q.pending()[0].snapshot).checked_at, current.checked_at);
  q.close();
});

test('changing an idle tracking code resets full-read state and retry cooldown', () => {
  const q = new Queue(':memory:'); const base = 1_800_000_000_000;
  q.sync([row()], base); const job = q.claim('profile-1', base);
  receive(q, job, base + 1000); q.acknowledge(q.pending()[0], { ...row(), checked_at: new Date(base).toISOString() }, base + 1000);
  q.sync([{ ...row(), tracking_code: row('b').tracking_code }], base + 2000);
  const next = q.claim('profile-1', base + 2000);
  assert.equal(next.code, row('b').tracking_code); assert.equal(next.mode, 'full'); q.close();
});

test('late result for a reassigned shipment is discarded, new code receives a full read', () => {
  const q = new Queue(':memory:'); q.sync([row()], 1000); const job = q.claim('profile-1', 1000);
  const replacement = { ...row(), tracking_code: row('b').tracking_code };
  q.sync([replacement], 1500); receive(q, job, 2000);
  const item = q.pending()[0]; assert.equal(shouldDiscard(item, replacement), true);
  q.discard(item, replacement, 3000);
  const next = q.claim('profile-1', 3000);
  assert.equal(next.code, replacement.tracking_code); assert.equal(next.mode, 'full');
  assert.equal(q.pending().length, 0); q.close();
});

test('deleting an in-flight shipment retains its capacity until its result is discarded', () => {
  const q = new Queue(':memory:'); q.sync([row()], 1000); const job = q.claim('profile-1', 1000);
  q.sync([], 1500); assert.equal(q.stats(1500).active, 1);
  receive(q, job, 2000); const item = q.pending()[0];
  assert.equal(shouldDiscard(item, null), true); q.discard(item, null, 3000);
  assert.equal(q.stats(3000).active, 0); assert.equal(q.claim('profile-1', 3000), null); q.close();
});

test('an old failed attempt cannot overwrite a newer successful observation', () => {
  const snapshot = row(); const current = { ...row(), checked_at: new Date(2000).toISOString() };
  const item = { code: row().tracking_code, snapshot: JSON.stringify(snapshot), payload: JSON.stringify({ ok: false, error: 'timeout' }) };
  assert.equal(shouldDiscard(item, current), true);
  assert.equal(shouldDiscard(item, snapshot), false);
  item.payload = JSON.stringify(result(item.code, 1000));
  assert.equal(shouldDiscard(item, current), true);
  item.payload = JSON.stringify(result(item.code, 3000));
  assert.equal(shouldDiscard(item, current), false);
});

test('new additions cannot jump ahead of existing overdue jobs forever', () => {
  const q = new Queue(':memory:'); q.sync([row('z')], 1000);
  q.sync([row('z'), row('a')], 2000);
  assert.equal(q.claim('profile-1', 2000).code, row('z').tracking_code); q.close();
});
