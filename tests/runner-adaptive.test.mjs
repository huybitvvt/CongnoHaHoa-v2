import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveLimit, profileLimit } from '../runner/adaptive.mjs';

function window(c, successes = 40, failures = 0, extra = {}) {
  for (let i = 0; i < successes; i++) c.record(true);
  for (let i = 0; i < failures; i++) c.record(false);
  const start = c.at;
  for (let i = 1; i <= 30; i++) c.evaluate({ now: start + i * 1000, max: 30,
    freeMB: 6000, active: c.limit, due: 1000, enabled: true, ...extra });
  return c.limit;
}
test('starts at nine, three per profile; a disconnected profile releases capacity', () => {
  assert.equal(new AdaptiveLimit(30, 0).limit, 9);
  assert.equal(profileLimit(9, 3, 10), 3);
  assert.equal(profileLimit(9, 2, 10), 5);
  assert.equal(profileLimit(30, 2, 10), 10);
});
test('rises to 30 only with improving throughput, never beyond global cap', () => {
  const c = new AdaptiveLimit(30, 0);
  for (let i = 0; i < 10; i++) window(c, 40 + i * 10);
  assert.equal(c.limit, 30);
});
test('flat throughput rolls back and holds for five minutes', () => {
  const c = new AdaptiveLimit(30, 0);
  assert.equal(window(c), 12); assert.equal(window(c), 9);
  for (let i = 0; i < 9; i++) assert.equal(window(c), 9);
  assert.equal(window(c), 12);
});
test('idle, paused, pending uploads or too few samples never cause an increase', () => {
  for (const extra of [{ due: 0 }, { enabled: false }, { outbox: 1 }, { freeMB: 2500 }]) {
    assert.equal(window(new AdaptiveLimit(30, 0), 40, 0, extra), 9);
  }
  assert.equal(window(new AdaptiveLimit(30, 0), 19), 9);
});
test('memory protection acts without samples and errors halve the limit', () => {
  const c = new AdaptiveLimit(30, 0);
  assert.equal(c.evaluate({ now: 1, max: 30, freeMB: 1800 }), 3);
  assert.equal(c.evaluate({ now: 2, max: 30, freeMB: 900 }), 1);
  assert.equal(window(new AdaptiveLimit(30, 0), 20, 10), 4);
});
test('remote ceiling is respected and an interrupted probe is discarded', () => {
  const c = new AdaptiveLimit(30, 0);
  window(c); window(c, 40, 0, { enabled: false }); assert.equal(c.probe, null);
  window(c, 40, 0, { max: 5 }); assert.equal(c.limit, 5);
});
