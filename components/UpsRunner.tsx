"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Runner = {
  enabled: boolean; requested_concurrency: number; heartbeat_at: string | null; machine_name: string | null;
  stats: { total?: number; due?: number; active?: number; outbox?: number; successfulPerMinute?: number;
    failed?: number; p95Seconds?: number; concurrency?: number; cooldownUntil?: number; lastError?: string; adaptationReason?: string;
    workers?: { id: string; online: boolean; extension: string }[] };
};

export function UpsRunner({ onBusy, manualRunning }: { onBusy: (busy: boolean) => void; manualRunning: boolean }) {
  const [runner, setRunner] = useState<Runner | null>(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [online, setOnline] = useState(false);
  const [clock, setClock] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const { data, error } = await supabase.from("speego_runner").select("enabled,requested_concurrency,heartbeat_at,machine_name,stats").eq("id", true).maybeSingle();
      if (cancelled) return;
      if (error) { setOnline(false); onBusy(true); setError("Chưa đọc được bộ chạy tự động. Kiểm tra kết nối hoặc migration speego_runner."); return; }
      const value = data as Runner | null;
      setClock(Date.now());
      const alive = Boolean(value?.heartbeat_at && Date.now() - Date.parse(value.heartbeat_at) < 60_000);
      setRunner(value); setOnline(alive);
      onBusy(Boolean(alive && (value?.enabled || value?.stats.active)));
    };
    void poll();
    const timer = setInterval(() => void poll(), 10_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [onBusy]);
  async function control(patch: Partial<Pick<Runner, "enabled" | "requested_concurrency">>) {
    setUpdating(true); setError("");
    try {
      const { data, error } = await supabase.from("speego_runner").update(patch).eq("id", true).select("enabled,requested_concurrency,heartbeat_at,machine_name,stats").maybeSingle();
      if (error || !data) throw new Error("Không đổi được cấu hình. Chỉ quản trị viên được điều khiển máy chạy.");
      setRunner(data as Runner);
      onBusy(Boolean(online && (data.enabled || (data.stats as Runner["stats"]).active)));
    } catch (error) { setError(error instanceof Error ? error.message : "Lỗi điều khiển máy chạy."); }
    finally { setUpdating(false); }
  }
  const stats = runner?.stats;
  return <div className="ups-runner-panel">
    <div className="ups-runner-heading"><div><strong>Máy tra UPS tự động</strong><p>
      {online ? `${runner?.machine_name} · ${runner?.enabled ? "Đang bật" : "Đã tạm dừng"}` : "Máy chưa kết nối hoặc đã ngắt"}
      {runner?.heartbeat_at && ` · Liên lạc ${new Date(runner.heartbeat_at).toLocaleString("vi-VN")}`}
    </p></div><a className="secondary-button" href="/speego-runner.zip" download>Tải bộ chạy máy nhà</a></div>
    <div className="ups-runner-metrics">
      <span>Đến hạn <b>{stats?.due ?? "—"}</b></span><span>Đang xử lý <b>{stats?.active ?? "—"}</b></span>
      <span>Tab hiện tại <b>{stats?.concurrency ?? "—"}</b></span><span>Chờ lưu <b>{stats?.outbox ?? "—"}</b></span>
      <span>Đơn/phút (15p) <b>{stats?.successfulPerMinute ?? "—"}</b></span><span>Lỗi (15p) <b>{stats?.failed ?? "—"}</b></span>
    </div>
    <div className="ups-actions"><button className="primary-button" disabled={!runner || updating || manualRunning}
      onClick={() => void control({ enabled: !runner?.enabled })}>{runner?.enabled ? "Tạm dừng tự động" : "Bật tự động"}</button>
      <label>Tổng tab tối đa <select aria-label="Tổng tab UPS tối đa" value={runner?.requested_concurrency ?? 30} disabled={!runner || updating}
        onChange={(event) => void control({ requested_concurrency: Number(event.target.value) })}>
        {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select></label>
      <small>Mỗi đơn tra lại sau 30 phút · Tạm dừng vẫn lưu các lượt đang chạy</small>
    </div>
    {stats?.adaptationReason && <p>{stats.adaptationReason}</p>}
    {stats?.workers && <p>{stats.workers.map((w) => `${w.id}: ${w.online && w.extension === "0.4.0" ? "sẵn sàng" : "chưa sẵn sàng"}`).join(" · ")}</p>}
    {Boolean(stats?.cooldownUntil && stats.cooldownUntil > clock) && <p role="status">UPS yêu cầu xác minh. Đang nghỉ đến {new Date(stats!.cooldownUntil!).toLocaleTimeString("vi-VN")}.</p>}
    {(error || stats?.lastError) && <p role="alert">{error || stats?.lastError}</p>}
  </div>;
}
