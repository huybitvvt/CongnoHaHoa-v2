// Evaluate distinct 30-second windows, never the same samples twice.
export class AdaptiveLimit {
  constructor(max = 30, now = Date.now()) {
    this.limit = Math.min(9, max); this.at = now; this.samples = [];
    this.busyTicks = 0; this.ticks = 0; this.probe = null; this.holdUntil = 0;
    this.reason = 'Khởi động tối đa 3 tab/profile';
  }
  record(ok) { this.samples.push(Boolean(ok)); }
  reset(now) { this.at = now; this.samples = []; this.busyTicks = 0; this.ticks = 0; }
  evaluate({ now, max, freeMB, active, due, enabled, outbox = 0 }) {
    if (this.limit > max) { this.limit = max; this.probe = null; this.reset(now); }
    if (freeMB < 1024 && this.limit > 1) {
      this.limit = 1; this.probe = null; this.holdUntil = now + 120000;
      this.reason = 'RAM trống dưới 1 GB'; this.reset(now); return this.limit;
    }
    if (freeMB < 2048 && this.limit > 3) {
      this.limit = 3; this.probe = null; this.holdUntil = now + 120000;
      this.reason = 'RAM trống dưới 2 GB'; this.reset(now); return this.limit;
    }
    this.ticks++;
    if (enabled && due > 0 && active >= this.limit - 1 && !outbox) this.busyTicks++;
    if (now - this.at < 30000) return this.limit;
    const count = this.samples.length, successes = this.samples.filter(Boolean).length;
    const rate = successes * 60000 / (now - this.at);
    const failures = count ? 1 - successes / count : 0;
    const saturated = this.busyTicks / this.ticks >= 0.7;
    if (count >= 10 && failures > 0.15) {
      this.limit = Math.max(1, Math.floor(this.limit / 2)); this.probe = null;
      this.holdUntil = now + 120000; this.reason = 'Giảm tải vì lỗi trên 15%';
    } else if (enabled && count >= 20 && saturated && freeMB >= 3072 && failures < 0.05 && now >= this.holdUntil) {
      if (this.probe && rate < this.probe.rate * 1.05) {
        this.limit = this.probe.limit; this.probe = null; this.holdUntil = now + 300000;
        this.reason = 'Quay về mức trước: tốc độ chưa tăng ít nhất 5%';
      } else if (this.limit < max) {
        this.probe = { limit: this.limit, rate };
        this.limit = Math.min(max, this.limit + 3);
        this.reason = 'Đủ mẫu ổn định: thử tăng tối đa 3 tab';
      } else { this.probe = null; this.reason = 'Đã đạt trần cấu hình'; }
    } else {
      // An idle/interrupted window cannot be compared to a saturated baseline.
      this.probe = null;
      this.reason = 'Giữ tải: chờ đủ mẫu, hàng đợi hoặc RAM';
    }
    this.reset(now); return this.limit;
  }
}

export function profileLimit(total, onlineProfiles, perProfile) {
  return Math.min(perProfile, Math.max(1, Math.ceil(total / Math.max(1, onlineProfiles))));
}
