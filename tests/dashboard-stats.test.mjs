import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardStats } from '../lib/dashboard-stats.ts';

const now = new Date('2026-09-10T06:00:00Z');
const order = (status, date = '2026-09-10') => ({ status, order_date: date });

test('empty dataset keeps zero counts and a flat series', () => {
  const stats = dashboardStats([], 'this_month', now);
  assert.equal(stats.total, 0);
  assert.equal(stats.counts.delivered, 0);
  assert.equal(stats.series.length, 10);
  assert.ok(stats.series.every(day => day.cumulative === 0));
});

test('delivery attempts, failures and delivered orders are mutually exclusive', () => {
  const stats = dashboardStats([
    order('Delivered'), order('Undeliverable'), order('Out for delivery'),
    order('Đang giao hàng'), order('Giao thất bại'), order('Đã giao thành công'),
    order('Return to sender'), order('Cancelled'), order('Label created'), order('Unknown'),
  ], 'all', now);
  assert.deepEqual(stats.counts, { delivered: 2, failed: 2, shipping: 2, processing: 1, returned: 1, cancelled: 1, unknown: 1 });
  assert.equal(Object.values(stats.counts).reduce((a, b) => a + b, 0), stats.total);
});

test('period selection excludes dates outside bounds and fills daily gaps', () => {
  const rows = [order('Delivered', '2026-08-31'), order('Delivered', '2026-09-01'), order('Delivered', '2026-09-03'), order('Delivered', '2026-09-11')];
  const stats = dashboardStats(rows, 'this_month', now);
  assert.equal(stats.total, 2);
  assert.deepEqual(stats.series.slice(0, 3).map(day => [day.daily, day.cumulative]), [[1, 1], [0, 1], [1, 2]]);
  assert.equal(dashboardStats(rows, 'last_month', now).total, 1);
});

test('Vietnam date boundary and rolling periods', () => {
  const rows = [order('Delivered', '2026-09-04'), order('Delivered', '2026-09-09'), order('Delivered', '2026-09-10')];
  const midnight = new Date('2026-09-09T17:05:00Z');
  assert.equal(dashboardStats(rows, 'today', midnight).total, 1);
  assert.equal(dashboardStats(rows, 'yesterday', midnight).selected[0].order_date, '2026-09-09');
  assert.equal(dashboardStats(rows, '7days', midnight).total, 3);
  assert.equal(dashboardStats([order('Delivered', '2026-08-12'), order('Delivered', '2026-08-11')], '30days', midnight).total, 1);
});
