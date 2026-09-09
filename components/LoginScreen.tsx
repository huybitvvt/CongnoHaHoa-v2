"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { Database, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasSupabaseConfig) return;
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError("Email hoặc mật khẩu không đúng.");
    setLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-brand-compact">
          <div className="brand-logo-wrap"><Image src="/logo-ha-hoa.jpg" alt="Hà Hoà" width={76} height={76} priority /></div>
          <div><span className="live-badge"><i /> Hệ thống trực tuyến</span><h1>NPP HÀ HOÀ</h1><p>Quản lý công nợ & vận hành phân phối</p></div>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-heading"><p className="eyebrow">HỆ THỐNG NỘI BỘ</p><h2>Đăng nhập tài khoản</h2><p className="muted">Nhập thông tin được cấp để vào không gian làm việc.</p></div>

          {!hasSupabaseConfig && (
            <div className="setup-notice">
              <strong>Chưa kết nối Supabase</strong>
              <span>Sao chép <code>.env.example</code> thành <code>.env.local</code> và điền URL/anon key.</span>
            </div>
          )}

          <label className="field">
            <span>Email</span>
            <div className="input-icon">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@hahoanpp.vn"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="field">
            <span>Mật khẩu</span>
            <div className="input-icon">
              <LockKeyhole size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button className="icon-button input-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Hiện mật khẩu">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <p className="form-error">{error}</p>}
          <button className="primary-button login-button" type="submit" disabled={loading || !hasSupabaseConfig}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <div className="login-security"><Database size={16} /><span>Dữ liệu được đồng bộ và bảo vệ bởi Supabase</span></div>
        </form>
        <p className="login-footer">© {new Date().getFullYear()} NPP Hà Hoà · Hệ thống quản trị nội bộ</p>
      </section>
    </main>
  );
}
