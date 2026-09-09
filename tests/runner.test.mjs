import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Queue, INTERVAL, LEASE, mergeHistory, validateResult } from '../runner/queue.mjs';

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

test('2000 jobs drain across six slots without loss, duplicate leases, or an unbounded outbox', () => {
  const q = new Queue(':memory:');
  let time = 1_800_000_000_000;
  q.sync(Array.from({ length: 2000 }, (_, i) => row(String(i))), time);
  const slots = Array.from({ length: 6 }, (_, i) => ({ worker: `profile-${i % 2 + 1}`, job: null }));
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
