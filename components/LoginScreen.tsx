"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Check, Eye, EyeOff, Info, X } from "lucide-react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [modalType, setModalType] = useState<"none" | "forgot" | "register">("none");
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("speego_remember_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasSupabaseConfig) return;
    setLoading(true);
    setError("");
    setInfoMessage("");

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Email hoặc mật khẩu không đúng.");
    } else {
      try {
        if (rememberMe) {
          localStorage.setItem("speego_remember_email", email);
        } else {
          localStorage.removeItem("speego_remember_email");
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    setLoading(false);
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Vui lòng nhập email trước khi yêu cầu cấp lại mật khẩu.");
      setModalType("none");
      return;
    }
    setLoading(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (resetError) {
      setError("Không thể gửi email đặt lại mật khẩu: " + resetError.message);
    } else {
      setResetEmailSent(true);
      setInfoMessage(`Đã gửi hướng dẫn đặt lại mật khẩu tới ${email}`);
    }
  }

  return (
    <main className="speego-auth-container">
      {/* Cột trái: Poster 3D đồ họa SpeeGo Logistics */}
      <section className="speego-auth-visual">
        <div className="speego-poster-card">
          <Image
            src="/login-banner-2x.png"
            alt="SpeeGo Logistics Fulfillment & OMS"
            width={758}
            height={948}
            unoptimized
            priority
            className="speego-poster-image"
          />
        </div>
      </section>

      {/* Cột phải: Form Đăng nhập phong cách Dark Mode */}
      <section className="speego-auth-panel">
        <div className="speego-form-wrapper">
          {/* Logo ngang SpeeGo Logistics */}
          <div className="speego-form-logo">
            <Image
              src="/speego-logo-dark-2x.png"
              alt="SpeeGo Logistics"
              width={142}
              height={38}
              priority
              className="speego-brand-img"
            />
          </div>

          {/* Tiêu đề */}
          <div className="speego-heading-group">
            <h1 className="speego-form-title">Đăng nhập</h1>
            <p className="speego-form-subtitle">Nhập email và mật khẩu để tiếp tục.</p>
          </div>

          {!hasSupabaseConfig && (
            <div className="speego-config-warning">
              <Info size={16} />
              <div>
                <strong>Chưa cấu hình Supabase</strong>
                <span>Vui lòng điền biến môi trường trong <code>.env.local</code>.</span>
              </div>
            </div>
          )}

          {error && <div className="speego-error-message">{error}</div>}
          {infoMessage && <div className="speego-info-message">{infoMessage}</div>}

          {/* Form nhập liệu */}
          <form className="speego-auth-form" onSubmit={handleSubmit}>
            {/* Trường Email */}
            <div className="speego-field-group">
              <label htmlFor="auth-email" className="speego-field-label">
                Email
              </label>
              <div className="speego-input-container email-container">
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@example.com"
                  autoComplete="email"
                  required
                  className="speego-input-field email-field"
                />
              </div>
            </div>

            {/* Trường Mật khẩu */}
            <div className="speego-field-group">
              <div className="speego-field-header">
                <label htmlFor="auth-password" className="speego-field-label">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  className="speego-forgot-link"
                  onClick={() => {
                    setError("");
                    setInfoMessage("");
                    setResetEmailSent(false);
                    setModalType("forgot");
                  }}
                >
                  Quên mật khẩu?
                </button>
              </div>

              <div className="speego-input-container password-container">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="speego-input-field password-field"
                />
                <button
                  type="button"
                  className="speego-eye-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Checkbox Ghi nhớ đăng nhập */}
            <label className="speego-remember-row">
              <span className={`speego-checkbox-box ${rememberMe ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="speego-hidden-checkbox"
                />
                {rememberMe && <Check size={14} strokeWidth={3} className="speego-check-icon" />}
              </span>
              <span className="speego-remember-text">Ghi nhớ đăng nhập</span>
            </label>

            {/* Nút Đăng nhập chính */}
            <button
              type="submit"
              className="speego-submit-button"
              disabled={loading || !hasSupabaseConfig}
            >
              {loading ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>

            {/* Phân cách Chưa có tài khoản? */}
            <div className="speego-divider-wrap">
              <div className="speego-divider-line" />
              <span className="speego-divider-text">Chưa có tài khoản?</span>
            </div>

            {/* Nút Đăng ký nhân viên */}
            <button
              type="button"
              className="speego-register-button"
              onClick={() => {
                setError("");
                setInfoMessage("");
                setModalType("register");
              }}
            >
              Đăng ký nhân viên
            </button>
          </form>
        </div>
      </section>

      {/* Modal hỗ trợ: Quên mật khẩu */}
      {modalType === "forgot" && (
        <div className="speego-modal-backdrop" onClick={() => setModalType("none")}>
          <div className="speego-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="speego-modal-header">
              <h3>Khôi phục mật khẩu</h3>
              <button
                type="button"
                className="speego-modal-close"
                onClick={() => setModalType("none")}
              >
                <X size={18} />
              </button>
            </div>
            {resetEmailSent ? (
              <div className="speego-modal-body">
                <p className="speego-modal-text">
                  Đường dẫn đặt lại mật khẩu đã được gửi tới <strong>{email}</strong>. Vui lòng kiểm tra hộp thư đến (và mục spam).
                </p>
                <button
                  type="button"
                  className="speego-submit-button"
                  onClick={() => setModalType("none")}
                >
                  Đã hiểu
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="speego-modal-body">
                <p className="speego-modal-text">
                  Nhập địa chỉ email tài khoản SpeedGo để nhận link đặt lại mật khẩu:
                </p>
                <div className="speego-field-group">
                  <label className="speego-field-label">Email tài khoản</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seller@example.com"
                    required
                    className="speego-input-field email-field"
                  />
                </div>
                <div className="speego-modal-actions">
                  <button
                    type="button"
                    className="speego-register-button"
                    onClick={() => setModalType("none")}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="speego-submit-button"
                    disabled={loading}
                  >
                    {loading ? "Đang gửi…" : "Gửi link khôi phục"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal hỗ trợ: Đăng ký nhân viên */}
      {modalType === "register" && (
        <div className="speego-modal-backdrop" onClick={() => setModalType("none")}>
          <div className="speego-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="speego-modal-header">
              <h3>Đăng ký tài khoản nhân viên</h3>
              <button
                type="button"
                className="speego-modal-close"
                onClick={() => setModalType("none")}
              >
                <X size={18} />
              </button>
            </div>
            <div className="speego-modal-body">
              <p className="speego-modal-text">
                Hệ thống <strong>SpeedGo Logistics OMS</strong> là không gian làm việc nội bộ dành cho nhân viên vận hành, kho và quản lý.
              </p>
              <div className="speego-support-info">
                <div className="support-item">
                  <span className="support-label">Quản trị viên (Admin):</span>
                  <span className="support-val">admin@speedgo.com</span>
                </div>
                <div className="support-item">
                  <span className="support-label">Hotline IT nội bộ:</span>
                  <span className="support-val">1900 6868 (Ext: 102)</span>
                </div>
                <div className="support-item">
                  <span className="support-label">Phạm vi cấp quyền:</span>
                  <span className="support-val">Kho, Fulfillment, Vận đơn, Kế toán</span>
                </div>
              </div>
              <p className="speego-modal-note">
                Vui lòng liên hệ Trưởng bộ phận hoặc Quản trị viên hệ thống để được khởi tạo tài khoản và phân quyền thao tác.
              </p>
              <button
                type="button"
                className="speego-submit-button"
                onClick={() => setModalType("none")}
              >
                Quay lại Đăng nhập
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
