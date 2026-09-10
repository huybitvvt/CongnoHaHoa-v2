import assert from "node:assert/strict";
import test from "node:test";

import {
  matchesOrderDate,
  parseTrackingCodes,
  trackingOrderId,
} from "../lib/speego-order-utils.ts";

test("parseTrackingCodes chuẩn hóa, khử trùng và báo mã sai", () => {
  assert.deepEqual(parseTrackingCodes("1z999aa10123456784, 1Z999AA10123456784\nABC1234 bad!"), {
    valid: ["1Z999AA10123456784", "ABC1234"],
    invalid: ["BAD!"],
  });
});

test("trackingOrderId luôn đúng giới hạn order_id và ổn định", () => {
  const code = "1Z12345678901234567890123456789012";
  const orderId = trackingOrderId(code);
  assert.match(orderId, /^#[A-Z0-9-]{2,31}$/);
  assert.equal(orderId, trackingOrderId(code));
  assert.notEqual(orderId, trackingOrderId(`${code.slice(0, -1)}3`));
});

test("matchesOrderDate lọc chính xác theo ngày, tháng và khoảng nhanh", () => {
  assert.equal(matchesOrderDate("2026-09-11", { day: "2026-09-11" }), true);
  assert.equal(matchesOrderDate("2026-09-10", { day: "2026-09-11" }), false);
  assert.equal(matchesOrderDate("2026-09-01", { month: "2026-09" }), true);
  assert.equal(matchesOrderDate("2026-08-31", { month: "2026-09" }), false);
  assert.equal(matchesOrderDate("2026-09-10", { period: "yesterday", today: "2026-09-11" }), true);
  assert.equal(matchesOrderDate("2026-08-31", { period: "last_month", today: "2026-09-11" }), true);
  assert.equal(matchesOrderDate("2026-09-01", { period: "last_month", today: "2026-09-11" }), false);
});
