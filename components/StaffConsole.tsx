"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Users,
  Activity,
  SlidersHorizontal,
  Plus,
  Search,
  RefreshCw,
  Settings,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  UserX,
  UserCheck,
  UserMinus,
  ShoppingBag,
  DollarSign,
  AlertCircle,
  Globe,
  Eye,
  ChevronRight,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loadStaffDirectory, type StaffDirectoryEntry } from "@/lib/staff-directory";
import type { SpeegoOrderRow, DebtRow } from "@/lib/types";

export type StaffSubTab = "sellers" | "activity" | "groups" | "tiers";

interface StaffConsoleProps {
  orders?: SpeegoOrderRow[];
  debts?: DebtRow[];
  lang?: "vi" | "en";
  initialSubTab?: StaffSubTab;
  onSubTabChange?: (tab: StaffSubTab) => void;
}

const INITIAL_GROUPS = [
  {
    id: "grp-1",
    name: "LUMI GLOBAL",
    code: "LUMI",
    memberCount: 15,
    teamLead: "Thanh Thương Cao Võ, Tran Tan Hung + 13",
    ordersCount: 31,
    ordersSub: "14 đang giao",
    deliverySuccess: "16 thành công",
    deliveryFailed: "1 thất bại · 94.1% thành công",
    revenue: "6.925,00 US$",
    revenueSub: "31 đơn đã thu",
    status: "Đang dùng",
  },
  {
    id: "grp-2",
    name: "Teabreaths",
    code: "TT-Tea",
    memberCount: 1,
    teamLead: "Chưa có trưởng nhóm",
    ordersCount: 13,
    ordersSub: "0 đang giao",
    deliverySuccess: "0 thành công",
    deliveryFailed: "13 thất bại · 0% thành công",
    revenue: "2.650,00 US$",
    revenueSub: "13 đơn đã thu",
    status: "Đang dùng",
  },
];

const TIERS_LIST = [
  {
    id: "tier-1",
    name: "Khách hàng",
    badgeColor: "#059669",
    bgColor: "rgba(5, 150, 105, 0.15)",
    borderColor: "rgba(5, 150, 105, 0.35)",
  },
  {
    id: "tier-2",
    name: "Seller",
    badgeColor: "#6b7280",
    bgColor: "rgba(107, 114, 128, 0.15)",
    borderColor: "rgba(107, 114, 128, 0.35)",
  },
  {
    id: "tier-3",
    name: "Nhân viên vận hành SpeeGo",
    badgeColor: "#2563eb",
    bgColor: "rgba(37, 99, 235, 0.15)",
    borderColor: "rgba(37, 99, 235, 0.35)",
  },
  {
    id: "tier-4",
    name: "Leader SpeeGo",
    badgeColor: "#16a34a",
    bgColor: "rgba(22, 163, 74, 0.15)",
    borderColor: "rgba(22, 163, 74, 0.35)",
  },
  {
    id: "tier-5",
    name: "Kế toán",
    badgeColor: "#d97706",
    bgColor: "rgba(217, 119, 6, 0.15)",
    borderColor: "rgba(217, 119, 6, 0.35)",
  },
  {
    id: "tier-6",
    name: "Manager SpeeGo",
    badgeColor: "#1d4ed8",
    bgColor: "rgba(29, 78, 216, 0.15)",
    borderColor: "rgba(29, 78, 216, 0.35)",
  },
];

export function StaffConsole({
  orders = [],
  debts = [],
  lang = "vi",
  initialSubTab = "sellers",
  onSubTabChange,
}: StaffConsoleProps) {
  const [subTab, setSubTab] = useState<StaffSubTab>(initialSubTab);
  const [staffList, setStaffList] = useState<StaffDirectoryEntry[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    void loadStaffDirectory(supabase, controller.signal).then(rows => {
      if (!controller.signal.aborted) { setStaffList(rows); setStaffError(""); }
    }).catch(error => {
      if (!controller.signal.aborted) setStaffError(error instanceof Error ? error.message : "Không tải được nhân viên.");
    }).finally(() => { if (!controller.signal.aborted) setStaffLoading(false); });
    return () => controller.abort();
  }, [reloadKey]);
  function reloadStaff() { setStaffLoading(true); setReloadKey(key => key + 1); }
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activityMode, setActivityMode] = useState<"user_status" | "history">("user_status");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"add_staff" | "add_group" | "preview_role">("add_staff");
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  // Sync state if initialSubTab prop changes
  React.useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  function handleSubTabSelect(tab: StaffSubTab) {
    setSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "sellers") {
        url.searchParams.delete("sub");
      } else {
        url.searchParams.set("sub", tab);
      }
      window.history.pushState({}, "", url.toString());
    }
  }

  function toggleSelectAll() {
    if (filteredStaff.length > 0 && filteredStaff.every(s => selectedStaffIds.includes(s.id))) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(filteredStaff.map((s) => s.id));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function deleteStaff(id: string) {
    void id;
    setStaffError("Danh sách đang ở chế độ chỉ đọc; chưa kết nối thao tác xóa tài khoản.");
  }

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          s.name.toLowerCase().includes(q) ||
          s.fullName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q) ||
          s.organization.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [staffList, searchQuery]);

  return (
    <div className="staff-console-container">
      {staffError && <p className="staff-load-error" role="alert">{staffError} <button type="button" onClick={reloadStaff}>Thử lại</button></p>}
      {staffLoading && <p role="status">{lang === "en" ? "Loading staff…" : "Đang tải nhân viên…"}</p>}
      <p className="staff-source-note">{lang === "en" ? "Source: staff directory. Account status and activation dates are not available." : "Nguồn: danh sách nhân viên. Chưa có dữ liệu trạng thái tài khoản, kích hoạt và hạn sử dụng."}</p>
      {/* 4 Views Router */}
      {subTab === "sellers" && (
        <SellersView
          staff={filteredStaff}
          totalCount={staffList.length}
          onReload={reloadStaff}
          selectedIds={selectedStaffIds}
          onSelectAll={toggleSelectAll}
          onSelectOne={toggleSelectOne}
          onDelete={deleteStaff}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onAdd={() => {
            setModalType("add_staff");
            setModalOpen(true);
          }}
          lang={lang}
        />
      )}

      {subTab === "activity" && (
        <ActivityView
          staff={filteredStaff}
          totalCount={staffList.length}
          onReload={reloadStaff}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          mode={activityMode}
          onModeChange={setActivityMode}
          lang={lang}
        />
      )}

      {subTab === "groups" && (
        <GroupsView
          groups={INITIAL_GROUPS}
          onAddGroup={() => {
            setModalType("add_group");
            setModalOpen(true);
          }}
          lang={lang}
        />
      )}

      {subTab === "tiers" && (
        <TiersView
          tiers={TIERS_LIST}
          onPreview={(roleName: string) => {
            setPreviewRole(roleName);
            setModalType("preview_role");
            setModalOpen(true);
          }}
          lang={lang}
        />
      )}

      {/* Simple Action Modal */}
      {modalOpen && (
        <div className="speego-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="speego-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">TÀI KHOẢN NHÂN VIÊN</p>
                <h2>
                  {modalType === "add_staff"
                    ? "Tạo tài khoản nhân viên"
                    : modalType === "add_group"
                    ? "Tạo nhóm nhân viên mới"
                    : `Xem trước UI vai trò: ${previewRole}`}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 0", color: "#ded7d2", fontSize: "13.5px" }}>
              {modalType === "add_staff" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label className="field">
                    <span>Họ và tên</span>
                    <input placeholder="VD: Nguyễn Văn A" />
                  </label>
                  <label className="field">
                    <span>Email nhân viên</span>
                    <input placeholder="VD: staff@speego.com" type="email" />
                  </label>
                  <label className="field">
                    <span>Vai trò (Tier)</span>
                    <select>
                      <option>Seller</option>
                      <option>Nhân viên vận hành SpeeGo</option>
                      <option>Leader SpeeGo</option>
                      <option>Kế toán</option>
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      alert("Chức năng tạo tài khoản đã sẵn sàng.");
                      setModalOpen(false);
                    }}
                  >
                    Tạo tài khoản
                  </button>
                </div>
              )}

              {modalType === "add_group" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label className="field">
                    <span>Tên nhóm</span>
                    <input placeholder="VD: LUMI GLOBAL" />
                  </label>
                  <label className="field">
                    <span>Mã nhóm</span>
                    <input placeholder="VD: LUMI" />
                  </label>
                  <button
                    className="primary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      alert("Đã thêm nhóm mới.");
                      setModalOpen(false);
                    }}
                  >
                    Lưu nhóm
                  </button>
                </div>
              )}

              {modalType === "preview_role" && (
                <div>
                  <p>
                    Đang hiển thị chế độ phân quyền và góc nhìn giao diện cho vai trò:{" "}
                    <strong style={{ color: "#ea580c" }}>{previewRole}</strong>.
                  </p>
                  <p style={{ color: "#8c8078", fontSize: "12px" }}>
                    Quyền hạn bao gồm xem đơn hàng, quản lý kho tương ứng và các giới hạn đối soát.
                  </p>
                  <button
                    className="secondary-button"
                    style={{ marginTop: "12px", width: "100%" }}
                    onClick={() => setModalOpen(false)}
                  >
                    Đóng xem trước
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subview 1: Sellers / Staff List (Screenshot 2)
// -----------------------------------------------------------------------------
function SellersView({
  staff,
  totalCount,
  onReload,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onDelete,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onAdd,
  lang,
}: any) {
  return (
    <div className="staff-view-pane">
      {/* Top action header */}
      <div className="staff-header-row">
        <div>
          <h2 className="staff-pane-title">
            {lang === "en" ? "Staff accounts" : "Tài khoản nhân viên"}
          </h2>
          <p className="staff-pane-subtitle">
            {lang === "en"
              ? "Admin initiates and manages staff accounts."
              : "Admin khởi tạo và quản lý tài khoản nhân viên."}
          </p>
        </div>
        <button type="button" className="staff-create-btn" onClick={onAdd}>
          <Plus size={16} />
          <span>{lang === "en" ? "Create account" : "Tạo tài khoản"}</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="staff-toolbar-row">
        <div className="staff-filter-pills">
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => onFilterChange("all")}
          >
            <span>{lang === "en" ? "All" : "Tất cả"}</span>
            <b className="pill-count">{totalCount ?? staff.length}</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "pending" ? "active" : ""}`}
            disabled title="Chưa có dữ liệu trạng thái tài khoản"
          >
            <span>{lang === "en" ? "Need action" : "Cần xử lý"}</span>
            <b className="pill-count">0</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "api" ? "active" : ""}`}
            disabled title="Chưa có dữ liệu trạng thái tài khoản"
          >
            <span>{lang === "en" ? "API Integration" : "Tích hợp API"}</span>
            <b className="pill-count">0</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "new" ? "active" : ""}`}
            disabled title="Chưa có dữ liệu trạng thái tài khoản"
          >
            <span>{lang === "en" ? "New registers" : "Đăng ký mới"}</span>
            <b className="pill-count">0</b>
          </button>
        </div>

        <div className="staff-search-box">
          <Search size={15} />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              lang === "en"
                ? "Search by name, email, phone..."
                : "Tìm theo tên, email, SĐT..."
            }
          />
          <button type="button" className="staff-refresh-icon-btn" title="Làm mới" onClick={onReload}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="staff-table-card staff-directory-table" tabIndex={0} role="region" aria-label="Danh sách nhân viên">
        <table className="staff-data-table">
          <thead>
            <tr>
              <th style={{ width: "36px" }}>
                <input
                  type="checkbox"
                  checked={staff.length > 0 && staff.every((person: StaffDirectoryEntry) => selectedIds.includes(person.id))}
                  onChange={onSelectAll}
                  className="staff-checkbox"
                />
              </th>
              <th>{lang === "en" ? "STAFF" : "NHÂN VIÊN"}</th>
              <th className="staff-tier-column">TIER</th>
              <th>{lang === "en" ? "STATUS" : "TRẠNG THÁI"}</th>
              <th>{lang === "en" ? "ACTIVATED" : "KÍCH HOẠT"}</th>
              <th>{lang === "en" ? "EXPIRES" : "HẾT HẠN"}</th>
              <th>{lang === "en" ? "CREATED AT" : "NGÀY TẠO"}</th>
              <th style={{ textAlign: "right", paddingRight: "16px" }}>
                {lang === "en" ? "ACTIONS" : "THAO TÁC"}
              </th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={8} className="staff-empty-cell">
                  {lang === "en"
                    ? "No staff accounts found."
                    : "Chưa có tài khoản nhân viên nào."}
                </td>
              </tr>
            ) : (
              staff.map((s: any) => (
                <tr key={s.id} className={selectedIds.includes(s.id) ? "selected" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => onSelectOne(s.id)}
                      className="staff-checkbox"
                    />
                  </td>
                  <td>
                    <div className="staff-user-cell">
                      <div
                        className="staff-avatar-circle"
                        style={{ backgroundColor: s.avatarBg }}
                      >
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="staff-user-info">
                        <strong className="staff-name">{s.name}</strong>
                        <span className="staff-email">{s.email}</span>
                        <span className="staff-subline">
                          {s.organization}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`tier-tag ${
                        s.tier.includes("SpeeGo") ? "blue" : "grey"
                      }`}
                    >
                      {s.tier === "Nhân viên vận hành SpeeGo" ? "Vận hành" : s.tier}
                    </span>
                  </td>
                  <td>
                    <span className="staff-status-badge">
                      {s.status === "unknown" ? "—" : s.status}
                    </span>
                  </td>
                  <td className="staff-date-text">{s.activatedAt}</td>
                  <td className="staff-date-text">
                    <span style={{ color: "#a89e97" }}>{s.expiresAt}</span>
                  </td>
                  <td className="staff-date-text">{s.createdAt}</td>
                  <td>
                    <div className="staff-action-btns">
                      <button
                        type="button"
                        className="staff-icon-action-btn"
                        title="Cài đặt"
                      >
                        <Settings size={15} />
                      </button>
                      <button
                        type="button"
                        className="staff-icon-action-btn delete"
                        title="Xóa"
                        onClick={() => onDelete(s.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subview 2: Activity & Status (Screenshot 3)
// -----------------------------------------------------------------------------
function ActivityView({
  staff,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  mode,
  onModeChange,
  lang,
}: any) {
  return (
    <div className="staff-view-pane">
      {/* Header */}
      <div className="staff-header-row">
        <div>
          <h2 className="staff-pane-title">
            {lang === "en" ? "Activity & Status" : "Hoạt động & trạng thái"}
          </h2>
          <p className="staff-pane-subtitle">
            {lang === "en"
              ? "Staff account status, last login, and action history."
              : "Trạng thái tài khoản nhân viên, lần đăng nhập gần nhất và lịch sử thao tác."}
          </p>
        </div>
        <button type="button" className="staff-icon-button" title="Làm mới">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* 4 Metric Cards */}
      <div className="staff-metric-grid-4">
        <div className="staff-metric-card">
          <div className="metric-icon-wrap orange">
            <Users size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">{lang === "en" ? "Staff" : "Nhân viên"}</span>
            <strong className="metric-val">{staff.length}</strong>
            <small className="metric-sub neutral">—</small>
          </div>
        </div>

        <div className="staff-metric-card">
          <div className="metric-icon-wrap green">
            <CheckCircle size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">
              {lang === "en" ? "Active" : "Đang hoạt động"}
            </span>
            <strong className="metric-val">—</strong>
            <small className="metric-sub neutral">—</small>
          </div>
        </div>

        <div className="staff-metric-card">
          <div className="metric-icon-wrap amber">
            <Clock size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">
              {lang === "en" ? "Pending activation" : "Chờ kích hoạt"}
            </span>
            <strong className="metric-val">0</strong>
            <small className="metric-sub neutral">—</small>
          </div>
        </div>

        <div className="staff-metric-card">
          <div className="metric-icon-wrap red">
            <UserX size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">
              {lang === "en" ? "Locked / Expired" : "Tạm khóa / hết hạn"}
            </span>
            <strong className="metric-val">0</strong>
            <small className="metric-sub neutral">—</small>
          </div>
        </div>
      </div>

      {/* Mode Toggle [ Trạng thái user | Lịch sử hoạt động ] */}
      <div className="staff-mode-toggle-wrap">
        <button
          type="button"
          className={`staff-mode-btn ${mode === "user_status" ? "active" : ""}`}
          onClick={() => onModeChange("user_status")}
        >
          <Users size={15} />
          <span>{lang === "en" ? "User Status" : "Trạng thái user"}</span>
        </button>
        <button
          type="button"
          className={`staff-mode-btn ${mode === "history" ? "active" : ""}`}
          onClick={() => onModeChange("history")}
        >
          <Clock size={15} />
          <span>{lang === "en" ? "Activity History" : "Lịch sử hoạt động"}</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="staff-toolbar-row">
        <div className="staff-filter-pills wrap">
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => onFilterChange("all")}
          >
            <span>{lang === "en" ? "All" : "Tất cả"}</span>
            <b className="pill-count">{staff.length}</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "pending" ? "active" : ""}`}
            disabled title="Chưa có dữ liệu trạng thái tài khoản"
          >
            <span>{lang === "en" ? "Need action" : "Cần xử lý"}</span>
            <b className="pill-count">3</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "api" ? "active" : ""}`}
            disabled title="Chưa có dữ liệu trạng thái tài khoản"
          >
            <span>{lang === "en" ? "API Integration" : "Tích hợp API"}</span>
            <b className="pill-count">0</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "active" ? "active" : ""}`}
            onClick={() => onFilterChange("active")}
          >
            <span>{lang === "en" ? "Active" : "Đang hoạt động"}</span>
            <b className="pill-count">{staff.length}</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "waiting" ? "active" : ""}`}
            onClick={() => onFilterChange("waiting")}
          >
            <span>{lang === "en" ? "Waiting activation" : "Chờ kích hoạt"}</span>
            <b className="pill-count">0</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "locked" ? "active" : ""}`}
            onClick={() => onFilterChange("locked")}
          >
            <span>{lang === "en" ? "Locked" : "Tạm khóa"}</span>
            <b className="pill-count">0</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${activeFilter === "expired" ? "active" : ""}`}
            onClick={() => onFilterChange("expired")}
          >
            <span>{lang === "en" ? "Expired" : "Hết hạn"}</span>
            <b className="pill-count">0</b>
          </button>
        </div>

        <div className="staff-search-box">
          <Search size={15} />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              lang === "en" ? "Search by name, email..." : "Tìm theo tên, email..."
            }
          />
        </div>
      </div>

      {/* Activity Table */}
      <div className="staff-table-card">
        <table className="staff-data-table">
          <thead>
            <tr>
              <th>USER</th>
              <th>EMAIL</th>
              <th>{lang === "en" ? "STATUS" : "TRẠNG THÁI"}</th>
              <th>PARTNER API</th>
              <th>{lang === "en" ? "LAST LOGIN" : "ĐĂNG NHẬP GẦN NHẤT"}</th>
              <th>{lang === "en" ? "SESSION" : "PHIÊN"}</th>
              <th>{lang === "en" ? "EXPIRES" : "HẾT HẠN"}</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s: any) => (
              <tr key={s.id}>
                <td>
                  <div className="staff-user-cell">
                    <div
                      className="staff-avatar-circle"
                      style={{ backgroundColor: s.avatarBg }}
                    >
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="staff-user-info">
                      <strong className="staff-name">{s.fullName}</strong>
                      <span className="staff-subline">{s.name}</span>
                    </div>
                  </div>
                </td>
                <td style={{ color: "#d9d2cc", fontSize: "12.5px" }}>{s.email}</td>
                <td>
                  <span className="staff-status-badge">{s.status === "unknown" ? "—" : s.status}</span>
                </td>
                <td style={{ color: "#7a6e67" }}>—</td>
                <td className="staff-date-text">{s.lastLogin}</td>
                <td>
                  <span className="session-badge green">
                    {s.hasSession === null ? "—" : s.hasSession ? (lang === "en" ? "Active session" : "Có phiên") : "—"}
                  </span>
                </td>
                <td style={{ color: "#7a6e67" }}>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subview 3: Staff Groups (Screenshot 4)
// -----------------------------------------------------------------------------
function GroupsView({ groups, onAddGroup, lang }: any) {
  return (
    <div className="staff-view-pane">
      {/* Header */}
      <div className="staff-header-row">
        <div>
          <h2 className="staff-pane-title">
            {lang === "en" ? "Staff groups" : "Nhóm nhân viên"}
          </h2>
          <p className="staff-pane-subtitle">
            {lang === "en"
              ? "Divide staff into groups. Each group has isolated order and revenue data."
              : "Chia nhân viên thành nhóm. Mỗi nhóm có dữ liệu đơn hàng và doanh thu riêng."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button type="button" className="staff-dark-action-btn">
            <Globe size={15} />
            <span>{lang === "en" ? "Assign group to old orders" : "Gán nhóm cho đơn cũ"}</span>
          </button>
          <button type="button" className="staff-create-btn" onClick={onAddGroup}>
            <Plus size={16} />
            <span>{lang === "en" ? "Create group" : "Tạo nhóm"}</span>
          </button>
        </div>
      </div>

      {/* 7 KPI Cards (Row 1: 4 cards, Row 2: 3 cards) */}
      <div className="staff-metric-grid-4">
        <div className="staff-metric-card">
          <div className="metric-icon-wrap orange">
            <Users size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">{lang === "en" ? "Total groups" : "Tổng số nhóm"}</span>
            <strong className="metric-val">2</strong>
          </div>
        </div>
        <div className="staff-metric-card">
          <div className="metric-icon-wrap orange">
            <UserCheck size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">{lang === "en" ? "Active groups" : "Nhóm đang dùng"}</span>
            <strong className="metric-val">2</strong>
          </div>
        </div>
        <div className="staff-metric-card">
          <div className="metric-icon-wrap amber">
            <UserMinus size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">{lang === "en" ? "Without group" : "Chưa có nhóm"}</span>
            <strong className="metric-val">1</strong>
          </div>
        </div>
        <div className="staff-metric-card">
          <div className="metric-icon-wrap orange">
            <ShoppingBag size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">{lang === "en" ? "Orders by group" : "Đơn theo nhóm"}</span>
            <strong className="metric-val">44</strong>
            <small className="metric-sub neutral">—</small>
          </div>
        </div>
      </div>

      <div className="staff-metric-grid-3">
        <div className="staff-metric-card">
          <div className="metric-icon-wrap green">
            <CheckCircle size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">{lang === "en" ? "Delivered success" : "Giao thành công"}</span>
            <strong className="metric-val">16</strong>
            <small className="metric-sub neutral">—</small>
          </div>
        </div>
        <div className="staff-metric-card">
          <div className="metric-icon-wrap red">
            <AlertCircle size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">{lang === "en" ? "Delivery failed" : "Giao thất bại"}</span>
            <strong className="metric-val">14</strong>
            <small className="metric-sub negative">Trên tổng 44 đơn</small>
          </div>
        </div>
        <div className="staff-metric-card">
          <div className="metric-icon-wrap orange">
            <DollarSign size={18} />
          </div>
          <div className="metric-content">
            <span className="metric-label">{lang === "en" ? "Group Revenue" : "Doanh thu theo nhóm"}</span>
            <strong className="metric-val">9.575,00 US$</strong>
            <small className="metric-sub neutral">—</small>
          </div>
        </div>
      </div>

      {/* Explanatory callout note */}
      <div className="staff-info-callout">
        {lang === "en"
          ? "Orders and revenue are calculated by group. Group leaders can view all group orders; regular staff can only see their own orders, but group revenue reflects the entire group."
          : "Đơn hàng và doanh thu được tính theo nhóm. Trưởng nhóm xem được toàn bộ đơn của nhóm, nhân viên thường chỉ xem đơn của mình nhưng số liệu doanh thu là của cả nhóm."}
      </div>

      {/* Groups Table */}
      <div className="staff-table-card">
        <table className="staff-data-table">
          <thead>
            <tr>
              <th>{lang === "en" ? "GROUP" : "NHÓM"}</th>
              <th>{lang === "en" ? "TEAM" : "ĐỘI NHÓM"}</th>
              <th>{lang === "en" ? "ORDERS" : "ĐƠN HÀNG"}</th>
              <th>{lang === "en" ? "DELIVERY" : "GIAO HÀNG"}</th>
              <th>{lang === "en" ? "REVENUE" : "DOANH THU"}</th>
              <th>{lang === "en" ? "STATUS" : "TRẠNG THÁI"}</th>
              <th style={{ textAlign: "right", paddingRight: "16px" }}>
                {lang === "en" ? "ACTIONS" : "THAO TÁC"}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g: any) => (
              <tr key={g.id}>
                <td>
                  <div className="group-name-cell">
                    <Users size={16} color="#ff7a35" />
                    <div>
                      <strong className="staff-name">{g.name}</strong>
                      <span className="staff-subline">{g.code}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="group-team-cell">
                    <div className="stacked-avatars">
                      <span className="stacked-dot bg-1">T</span>
                      <span className="stacked-dot bg-2">C</span>
                      <span className="stacked-dot bg-3">V</span>
                      {g.memberCount > 3 && (
                        <span className="stacked-dot bg-more">+{g.memberCount - 3}</span>
                      )}
                    </div>
                    <div>
                      <strong style={{ fontSize: "12.5px" }}>{g.memberCount} nhân viên</strong>
                      <span className="staff-subline">{g.teamLead}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div>
                    <strong>{g.ordersCount}</strong>
                    <span className="staff-subline">{g.ordersSub}</span>
                  </div>
                </td>
                <td>
                  <div>
                    <strong style={{ color: "#34d399" }}>{g.deliverySuccess}</strong>
                    <span className="staff-subline">{g.deliveryFailed}</span>
                  </div>
                </td>
                <td>
                  <div>
                    <strong style={{ color: "#f8fafc" }}>{g.revenue}</strong>
                    <span className="staff-subline">{g.revenueSub}</span>
                  </div>
                </td>
                <td>
                  <span className="group-status-badge green">{g.status}</span>
                </td>
                <td>
                  <div className="staff-action-btns">
                    <button type="button" className="staff-pill-action-btn">
                      <Edit2 size={13} />
                      <span>{lang === "en" ? "Edit" : "Sửa"}</span>
                    </button>
                    <button type="button" className="staff-pill-action-btn delete">
                      <Trash2 size={13} />
                      <span>{lang === "en" ? "Delete" : "Xoá"}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="staff-footer-note">
        1 nhân viên chưa thuộc nhóm nào — họ chỉ thấy dữ liệu của chính mình.
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subview 4: Access Tiers / Permissions (Screenshot 5)
// -----------------------------------------------------------------------------
function TiersView({ tiers, onPreview, lang }: any) {
  return (
    <div className="staff-view-pane">
      {/* Header */}
      <div className="staff-header-row">
        <div>
          <h2 className="staff-pane-title">
            {lang === "en" ? "Access permissions" : "Quyền truy cập"}
          </h2>
          <p className="staff-pane-subtitle">
            {lang === "en"
              ? "Define staff roles and view permission list for each role."
              : "Đặt tên vai trò nhân viên và xem danh sách quyền trong từng vai trò."}
          </p>
        </div>
        <button type="button" className="staff-icon-button" title="Làm mới">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Roles Card Container */}
      <div className="staff-roles-container-card">
        <div className="roles-container-header">
          <div>
            <h3 className="roles-title">
              {lang === "en" ? "Staff Roles" : "Vai trò nhân viên"}
            </h3>
            <p className="roles-desc">
              {lang === "en"
                ? "Each card is a role for staff accounts. Permission list matches SpeeGo product, inventory, and order flows."
                : "Mỗi thẻ là một vai trò cho tài khoản nhân viên. Danh sách quyền khớp luồng sản phẩm, tồn kho và đơn hàng SpeeGo."}
            </p>
          </div>
          <span className="roles-last-updated">
            Cập nhật lần cuối 14:17 5 thg 9, 2026
          </span>
        </div>

        <div className="roles-list-column">
          {tiers.map((t: any) => (
            <div
              key={t.id}
              className="role-row-card"
              style={{
                borderColor: t.borderColor,
                background: "linear-gradient(180deg, #17110e 0%, #1c1411 100%)",
              }}
            >
              <div className="role-tag-box">
                <span
                  className="role-pill-badge"
                  style={{
                    backgroundColor: t.badgeColor,
                    color: "#ffffff",
                  }}
                >
                  {t.name}
                </span>
              </div>

              <div className="role-actions-right">
                <button
                  type="button"
                  className="role-preview-btn"
                  onClick={() => onPreview(t.name)}
                >
                  <Eye size={15} />
                  <span>{lang === "en" ? "Preview UI" : "Xem trước UI"}</span>
                </button>
                <button type="button" className="role-configure-btn">
                  <Settings size={15} />
                  <span>{lang === "en" ? "Configure" : "Điều chỉnh"}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
