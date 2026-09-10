"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Runner = {
  enabled: boolean; requested_concurrency: number; requested_profiles: number; heartbeat_at: string | null; machine_name: string | null;
  stats: { total?: number; due?: number; active?: number; outbox?: number; successfulPerMinute?: number;
    failed?: number; p95Seconds?: number; concurrency?: number; cooldownUntil?: number; lastError?: string; adaptationReason?: string;
    version?: string; configuredProfiles?: number; workers?: { id: string; online: boolean; extension: string }[] };
};

const RUNNER_VERSION = "0.4.4";

export function UpsRunner({ onBusy, manualRunning }: { onBusy: (busy: boolean) => void; manualRunning: boolean }) {
  const [runner, setRunner] = useState<Runner | null>(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [online, setOnline] = useState(false);
  const [clock, setClock] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const { data, error } = await supabase.from("speego_runner").select("enabled,requested_concurrency,requested_profiles,heartbeat_at,machine_name,stats").eq("id", true).maybeSingle();
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
  async function control(patch: Partial<Pick<Runner, "enabled" | "requested_concurrency" | "requested_profiles">>) {
    setUpdating(true); setError("");
    try {
      const { data, error } = await supabase.from("speego_runner").update(patch).eq("id", true).select("enabled,requested_concurrency,requested_profiles,heartbeat_at,machine_name,stats").maybeSingle();
      if (error || !data) throw new Error("Không đổi được cấu hình. Chỉ quản trị viên được điều khiển máy chạy.");
      setRunner(data as Runner);
      onBusy(Boolean(online && (data.enabled || (data.stats as Runner["stats"]).active)));
    } catch (error) { setError(error instanceof Error ? error.message : "Lỗi điều khiển máy chạy."); }
    finally { setUpdating(false); }
  }
  const stats = runner?.stats;
  const selectedProfiles = runner?.requested_profiles || 3;
  const profileRows = Array.from({ length: selectedProfiles }, (_, index) => {
    const id = `profile-${index + 1}`;
    const worker = stats?.workers?.find((item) => item.id === id);
    return { id, ready: Boolean(online && worker?.online && worker.extension === "0.4.0") };
  });
  return <div className="ups-runner-panel">
    <div className="ups-runner-heading"><div><strong>Máy tra UPS tự động</strong><p>
      {online ? `${runner?.machine_name} · ${runner?.enabled ? "Đang bật" : "Đã tạm dừng"}` : "Máy chưa kết nối hoặc đã ngắt"}
      {runner?.heartbeat_at && ` · Liên lạc ${new Date(runner.heartbeat_at).toLocaleString("vi-VN")}`}
    </p></div><div className="ups-runner-downloads"><a className="secondary-button" href="/speego-runner.zip" download>Tải bộ chạy + tiện ích</a><a className="secondary-button" href="/ups-tracking-extension.zip?v=0.4.0" download>Chỉ tải tiện ích UPS</a></div></div>
    <div className="ups-runner-setup" aria-label="Các bước cài máy quét UPS">
      <span><b>1</b>Tải và giải nén bộ chạy</span><span><b>2</b>Chọn số profile Chrome</span>
      <span><b>3</b>Cài tiện ích vào từng profile</span><span><b>4</b>Dán mã và bấm Quét ngay</span>
    </div>
    <div className="ups-runner-metrics">
      <span>Đến hạn <b>{stats?.due ?? "—"}</b></span><span>Đang xử lý <b>{stats?.active ?? "—"}</b></span>
      <span>Tab hiện tại <b>{stats?.concurrency ?? "—"}</b></span><span>Chờ lưu <b>{stats?.outbox ?? "—"}</b></span>
      <span>Đơn/phút (15p) <b>{stats?.successfulPerMinute ?? "—"}</b></span><span>Lỗi (15p) <b>{stats?.failed ?? "—"}</b></span>
    </div>
    <div className="ups-actions"><button className="primary-button" disabled={!runner || updating || manualRunning}
      onClick={() => void control({ enabled: !runner?.enabled })}>{runner?.enabled ? "Tạm dừng quét" : "Bật máy quét"}</button>
      <label>Số profile Chrome <select aria-label="Số profile Chrome cần chạy" value={selectedProfiles} disabled={!runner || updating}
        onChange={(event) => {
          const profiles = Number(event.target.value);
          void control({ requested_profiles: profiles, requested_concurrency: Math.min(runner?.requested_concurrency || 30, profiles * 10) });
        }}>
        {[1, 2, 3].map((number) => <option key={number} value={number}>{number} profile</option>)}
      </select></label>
      <label>Tổng tab tối đa <select aria-label="Tổng tab UPS tối đa" value={runner?.requested_concurrency ?? 30} disabled={!runner || updating}
        onChange={(event) => void control({ requested_concurrency: Number(event.target.value) })}>
        {Array.from({ length: selectedProfiles * 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select></label>
      <small>Giảm profile sẽ chờ tab đang chạy xong rồi đóng · Mỗi đơn tra lại sau 30 phút</small>
    </div>
    {stats?.adaptationReason && <p>{stats.adaptationReason}</p>}
    <div className="ups-runner-profiles">{profileRows.map((profile) => <span key={profile.id} className={profile.ready ? "ready" : ""}><i />{profile.id}: {profile.ready ? "sẵn sàng" : "chưa sẵn sàng"}</span>)}</div>
    {online && stats?.version !== RUNNER_VERSION && <p role="alert">Bộ chạy đang là {stats?.version || "bản cũ"}. Hãy tải Runner {RUNNER_VERSION} để đổi số profile trực tiếp trên web.</p>}
    {Boolean(stats?.cooldownUntil && stats.cooldownUntil > clock) && <p role="status">UPS yêu cầu xác minh. Đang nghỉ đến {new Date(stats!.cooldownUntil!).toLocaleTimeString("vi-VN")}.</p>}
    {(error || stats?.lastError) && <p role="alert">{error || stats?.lastError}</p>}
  </div>;
}
