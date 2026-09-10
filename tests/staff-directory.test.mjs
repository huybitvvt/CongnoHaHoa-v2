import assert from 'node:assert/strict';
import test from 'node:test';
import { loadStaffDirectory } from '../lib/staff-directory.ts';

function clientFor(rows, failure = null) {
  const ranges = [];
  const client = { from(table) {
    assert.equal(table, 'staff_members');
    return { select(columns) {
      assert.ok(!columns.includes('password'));
      return { order() { return this; }, range(start, end) {
        ranges.push([start, end]);
        return Promise.resolve({ data: rows.slice(start, end + 1), error: failure });
      } };
    } };
  } };
  return { client, ranges };
}

test('loads every employee beyond the first database page', async () => {
  const rows = Array.from({ length: 517 }, (_, i) => ({ id: String(i), name: `Staff ${i}`, account: `staff${i}@example.com`, created_at: '2026-09-10T00:00:00Z' }));
  const { client, ranges } = clientFor(rows);
  const result = await loadStaffDirectory(client);
  assert.equal(result.length, 517);
  assert.deepEqual(ranges, [[0, 499], [500, 999]]);
  assert.equal(result[516].id, '516');
  assert.equal(result[0].status, 'unknown');
  assert.equal(result[0].activatedAt, '—');
  assert.equal(result[0].hasSession, null);
});

test('empty source stays empty instead of loading samples', async () => {
  assert.deepEqual(await loadStaffDirectory(clientFor([]).client), []);
});

test('database errors are surfaced instead of reporting a fake count', async () => {
  await assert.rejects(loadStaffDirectory(clientFor([], { message: 'Permission denied' }).client), /Permission denied/);
});
