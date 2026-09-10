"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Bell,
  Boxes,
  Calendar,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  DatabaseBackup,
  Download,
  FileLock,
  Info,
  Layers2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  PackageSearch,
  Plug,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Activity,
  SlidersHorizontal,
  Upload,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { DebtAiChat } from "@/components/DebtAiChat";
import { FilterPanel } from "@/components/FilterPanel";
import { LoginScreen } from "@/components/LoginScreen";
import { OperationsConsole, OPERATION_TABS, SpeedGoDashboard, type OperationTab } from "@/components/OperationsConsole";
import { type Language, type DatePeriod } from "@/components/DashboardCharts";
import { type StaffSubTab } from "@/components/StaffConsole";
import { type WarehouseSubTab } from "@/components/WarehouseConsolePro";
import { RecordModal, type EditableRow, type ModalKind, type RecordPayload } from "@/components/RecordModal";
import { RouteManagement } from "@/components/RouteManagement";
import { SalesRouteManagement } from "@/components/SalesRouteManagement";
import { SummaryCards } from "@/components/SummaryCards";
import { ZaloContacts } from "@/components/ZaloContacts";
import { UpsTracking } from "@/components/UpsTracking";
import { money, toNumber } from "@/lib/format";
import { TAB_ROUTES } from "@/lib/routes";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  EMPTY_FILTERS,
  type AppSettings,
  type CustomerOption,
  type DebtRow,
  type Filters,
  type PaymentRow,
  type ReturnRow,
  type SpeegoOrderRow,
  type TabKey,
} from "@/lib/types";

const DEFAULT_SETTINGS: AppSettings = { max_debt: 0, debt_terms: [15, 30, 45, 60] };
const SPEEGO_SELECT = "id,source_order_id,source_order_code,order_id,tracking_code,customer_name,phone,email,address,city,state,postal_code,country,marketing_staff,sales_person,customer_service_staff,delivery_person,shipping_unit,order_date,amount,unit_price,currency,exchange_rate,total_amount_vnd,source_updated_at,source_synced_at,edd,collected,status,raw_status,checked_at,error,history,created_at,updated_at";

function getStaffTitle(sub: StaffSubTab, lang: "vi" | "en") {
  if (sub === "activity") return lang === "en" ? "Activity & Status" : "Hoạt động & trạng thái";
  if (sub === "groups") return lang === "en" ? "Staff groups" : "Nhóm nhân viên";
  if (sub === "tiers") return lang === "en" ? "Access permissions" : "Quyền truy cập";
  return lang === "en" ? "Staff accounts" : "Tài khoản nhân viên";
}

function getStaffDesc(sub: StaffSubTab, lang: "vi" | "en") {
  if (sub === "activity") return lang === "en" ? "Staff account status, last login, and action history." : "Trạng thái tài khoản nhân viên, lần đăng nhập gần nhất và lịch sử thao tác.";
  if (sub === "groups") return lang === "en" ? "Divide staff into groups. Each group has isolated order and revenue data." : "Chia nhân viên thành nhóm. Mỗi nhóm có dữ liệu đơn hàng và doanh thu riêng.";
  if (sub === "tiers") return lang === "en" ? "Define staff roles and view permission list for each role." : "Đặt tên vai trò nhân viên và xem danh sách quyền trong từng vai trò.";
  return lang === "en" ? "Admin initiates and manages staff accounts." : "Admin khởi tạo và quản lý tài khoản nhân viên.";
}

function isOperationTab(tab: TabKey): tab is OperationTab {
  return (OPERATION_TABS as readonly string[]).includes(tab);
}

const PERIOD_LABELS: Record<DatePeriod, { vi: string; en: string }> = {
  today: { vi: "Hôm nay", en: "Today" },
  yesterday: { vi: "Hôm qua", en: "Yesterday" },
  "7days": { vi: "7 ngày qua", en: "Last 7 days" },
  "30days": { vi: "30 ngày qua", en: "Last 30 days" },
  this_month: { vi: "Tháng này", en: "This month" },
  last_month: { vi: "Tháng trước", en: "Last month" },
  all: { vi: "Tất cả", en: "All time" },
};

export function AppShell({ activeTab }: { activeTab: TabKey }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [speegoOrders, setSpeegoOrders] = useState<SpeegoOrderRow[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatPrompt, setAiChatPrompt] = useState<string | null>(null);
  const [aiChatImages, setAiChatImages] = useState<string[]>([]);
  const [modal, setModal] = useState<{ open: boolean; kind: ModalKind; record: EditableRow | null; presetDebtId?: string | null }>({ open: false, kind: "debts", record: null });
  const [saving, setSaving] = useState(false);

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [lang, setLang] = useState<Language>("vi");
  const [period, setPeriod] = useState<DatePeriod>("this_month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [staffSubTab, setStaffSubTab] = useState<StaffSubTab>("sellers");
  const [warehouseSubTab, setWarehouseSubTab] = useState<WarehouseSubTab>("inventory");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sub = params.get("sub");
      if (activeTab === "staff" || activeTab === "permissions") {
        if (sub && ["sellers", "activity", "groups", "tiers"].includes(sub)) {
          setStaffSubTab(sub as StaffSubTab);
        } else if (activeTab === "permissions") {
          setStaffSubTab("tiers");
        } else {
          setStaffSubTab("sellers");
        }
      } else if (activeTab === "warehouse") {
        if (sub && ["inventory", "inbound", "outbound", "products"].includes(sub)) {
          setWarehouseSubTab(sub as WarehouseSubTab);
        } else {
          setWarehouseSubTab("inventory");
        }
      }
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      const savedTheme = (localStorage.getItem("speego_theme") as "dark" | "light") || "dark";
      setTheme(savedTheme);
      if (savedTheme === "light") {
        document.documentElement.classList.add("light-theme");
      } else {
        document.documentElement.classList.remove("light-theme");
      }

      const savedLang = (localStorage.getItem("speego_lang") as Language) || "vi";
      setLang(savedLang);
    } catch {
      // ignore SSR or restricted localStorage
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("speego_theme", next);
      } catch {
        // ignore
      }
      if (next === "light") {
        document.documentElement.classList.add("light-theme");
      } else {
        document.documentElement.classList.remove("light-theme");
      }
      return next;
    });
  }, []);

  const switchLang = useCallback((nextLang: Language) => {
    setLang(nextLang);
    try {
      localStorage.setItem("speego_lang", nextLang);
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError("");

    const [debtResult, paymentResult, returnResult, customerResult, settingResult, speegoResult] = await Promise.all([
      fetchPaged((from, to) => supabase.from("debt_overview").select("*").order("order_date", { ascending: false }).range(from, to)),
      fetchPaged((from, to) => supabase.from("payments").select("id,debt_id,amount,paid_at,notes,sales_person,delivery_person,created_at,debt:debts(amount,order_date,customer:customers(name))").order("paid_at", { ascending: false }).range(from, to)),
      fetchPaged((from, to) => supabase.from("returns").select("id,debt_id,customer_id,product_name,quantity,unit_price,total_amount,returned_at,notes,created_at,customer:customers(name)").order("returned_at", { ascending: false }).range(from, to)),
      fetchPaged((from, to) => supabase.from("customers").select("id,code,name,phone,address,region").order("name").range(from, to)),
      supabase.from("organization_settings").select("max_debt,debt_terms").eq("id", 1).maybeSingle(),
      fetchPaged((from, to) => supabase.from("speego").select(SPEEGO_SELECT).order("order_date", { ascending: false }).range(from, to)),
    ]);

    const firstError = debtResult.error || paymentResult.error || returnResult.error || customerResult.error || settingResult.error || speegoResult.error;
    if (firstError) {
      setError(firstError.message);
    } else {
      setDebts(((debtResult.data || []) as unknown as DebtRow[]).map(normalizeDebt));
      setPayments(((paymentResult.data || []) as unknown as PaymentRow[]).map(normalizePayment));
      setReturns(((returnResult.data || []) as unknown as ReturnRow[]).map(normalizeReturn));
      setCustomers((customerResult.data || []) as CustomerOption[]);
      setSpeegoOrders(((speegoResult.data || []) as unknown as SpeegoOrderRow[]).map(normalizeSpeegoOrder));
      if (settingResult.data) setSettings({ max_debt: Number(settingResult.data.max_debt), debt_terms: settingResult.data.debt_terms });
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const initialLoad = window.setTimeout(() => void loadData(), 0);
    const channel = supabase
      .channel("cong-no-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "returns" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "speego" }, () => void loadData(true))
      .subscribe();
    return () => { window.clearTimeout(initialLoad); void supabase.removeChannel(channel); };
  }, [session, loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredDebts = useMemo(() => debts.filter((row) => matchDebt(row, filters)), [debts, filters]);
  const debtsByDueDate = useMemo(() => sortDebtsByDueDate(filteredDebts), [filteredDebts]);
  const filteredDebtIds = useMemo(() => new Set(filteredDebts.map((row) => row.id)), [filteredDebts]);
  const filteredCustomerIds = useMemo(() => new Set(filteredDebts.map((row) => row.customer_id)), [filteredDebts]);
  const filteredPayments = useMemo(() => payments.filter((row) => {
    if ((filters.customer || filters.sales || filters.delivery || filters.region || filters.status) && !filteredDebtIds.has(row.debt_id)) return false;
    if (filters.from && row.paid_at < filters.from) return false;
    if (filters.to && row.paid_at > filters.to) return false;
    if (filters.search && !`${getPaymentCustomerName(row, debts)} ${row.notes || ""}`.toLocaleLowerCase("vi").includes(filters.search.toLocaleLowerCase("vi"))) return false;
    return true;
  }), [payments, filters, filteredDebtIds, debts]);
  const paymentsWithCustomer = useMemo(() => filteredPayments.map((row) => enrichPayment(row, debts)), [filteredPayments, debts]);
  const unsettledDebts = useMemo(() => sortDebtsByDueDate(filteredDebts.filter((row) => row.remaining_amount > 0)), [filteredDebts]);
  const filteredReturns = useMemo(() => returns.filter((row) => {
    if ((filters.customer || filters.sales || filters.delivery || filters.region || filters.status) && !filteredCustomerIds.has(row.customer_id)) return false;
    if (filters.from && row.returned_at < filters.from) return false;
    if (filters.to && row.returned_at > filters.to) return false;
    if (filters.search && !`${row.customer?.name || ""} ${row.product_name} ${row.notes || ""}`.toLocaleLowerCase("vi").includes(filters.search.toLocaleLowerCase("vi"))) return false;
    return true;
  }), [returns, filters, filteredCustomerIds]);

  const totals = useMemo(() => {
    const debt = filteredDebts.reduce((sum, row) => sum + row.amount, 0);
    const paid = filteredDebts.reduce((sum, row) => sum + row.paid_amount, 0);
    const returned = filteredReturns.reduce((sum, row) => sum + row.total_amount, 0);
    return { debt, paid, returned, remaining: Math.max(debt - paid - returned, 0), overdueCount: filteredDebts.filter((row) => row.status === "overdue").length };
  }, [filteredDebts, filteredReturns]);

  if (!hasSupabaseConfig) return <LoginScreen />;
  if (session === undefined) return <div className="app-loading"><Image src="/speego-logistics.jpg" alt="SpeeGo Logistics" width={96} height={72} priority /><span>Đang khởi tạo hệ thống…</span></div>;
  if (!session) return <LoginScreen />;

  const activeRows = activeTab === "payments" ? paymentsWithCustomer : activeTab === "returns" ? filteredReturns : activeTab === "debts" ? debtsByDueDate : filteredDebts;
  const isOperationsPage = isOperationTab(activeTab);
  const quotaUsed = Math.min(8000, speegoOrders.length || debts.length + payments.length + returns.length);
  const quotaPercent = Math.max(2, Math.round((quotaUsed / 8000) * 100));
  const orderBadge = speegoOrders.length || debts.length || undefined;
  const alertCount = speegoOrders.filter((row) => row.error || `${row.status || ""} ${row.raw_status || ""}`.toLocaleLowerCase("vi").includes("fail")).length || totals.overdueCount;
  const userDisplayName = cleanSpeedGoUserName(session.user.user_metadata?.full_name);
  const staffSectionActive = activeTab === "staff" || activeTab === "permissions";
  const orderSectionActive = activeTab === "ups_tracking" || activeTab === "fulfillment" || activeTab === "returns" || activeTab === "customers_list";
  const warehouseSectionActive = activeTab === "warehouse" || activeTab === "warehouse_locations" || activeTab === "warehouse_expiry" || activeTab === "warehouse_serials" || activeTab === "warehouse_combos";

  function openCreate() {
    if (activeTab === "sales_routes") return;
    const kind: ModalKind = activeTab === "payments" || activeTab === "returns" ? activeTab : "debts";
    setModal({ open: true, kind, record: null, presetDebtId: null });
  }

  function openPayment(debt: DebtRow) {
    setModal({ open: true, kind: "payments", record: null, presetDebtId: debt.id });
  }

  function closeModal() {
    setModal({ open: false, kind: "debts", record: null, presetDebtId: null });
  }

  async function saveRecord(payload: RecordPayload) {
    setSaving(true);
    setError("");
    try {
      if (modal.kind === "debts") await saveDebt(payload);
      else if (modal.kind === "payments") await savePayment(payload);
      else await saveReturn(payload);
      setModal((current) => ({ ...current, open: false, presetDebtId: null }));
      setToast(modal.record ? "Đã lưu thay đổi." : modal.presetDebtId ? "Đã ghi nhận thanh toán." : "Đã thêm dữ liệu mới.");
      await loadData(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDebt(payload: RecordPayload) {
    let customerId = String(payload.customer_id || "");
    const newCustomer = String(payload.new_customer || "").trim();
    if (!modal.record && newCustomer) {
      const normalized = newCustomer.toLocaleLowerCase("vi");
      const existing = customers.find((customer) => customer.name.trim().toLocaleLowerCase("vi") === normalized);
      if (existing) customerId = existing.id;
      else {
        const { data, error: customerError } = await supabase.from("customers").insert({ name: newCustomer, code: payload.customer_code || null, phone: payload.phone || null, region: payload.region || null }).select("id").single();
        if (customerError) throw customerError;
        customerId = data.id;
      }
    }
    if (!customerId) throw new Error("Cần chọn hoặc tạo khách hàng.");

    const amount = Number(payload.amount);
    const editing = modal.record as DebtRow | null;
    const existingOutstanding = debts.filter((row) => row.customer_id === customerId && row.id !== editing?.id).reduce((sum, row) => sum + row.remaining_amount, 0);
    const adjustedAmount = Math.max(amount - (editing?.paid_amount || 0) - (editing?.returned_amount || 0), 0);
    if (settings.max_debt > 0 && existingOutstanding + adjustedAmount > settings.max_debt) {
      throw new Error(`Khoản nợ vượt hạn mức ${money.format(settings.max_debt)} của khách hàng.`);
    }

    const row = clean({
      customer_id: customerId,
      amount,
      order_date: payload.order_date,
      due_days: payload.due_days,
      sales_person: payload.sales_person,
      delivery_person: payload.delivery_person,
      product_name: payload.product_name,
      quantity: payload.quantity,
      unit_price: payload.unit_price,
      notes: payload.notes,
    });
    const query = editing ? supabase.from("debts").update(row).eq("id", editing.id) : supabase.from("debts").insert(row);
    const { error: saveError } = await query;
    if (saveError) throw saveError;
  }

  async function savePayment(payload: RecordPayload) {
    const editing = modal.record as PaymentRow | null;
    const debt = debts.find((row) => row.id === payload.debt_id);
    if (!debt) throw new Error("Không tìm thấy khoản nợ đã chọn.");
    const allowed = debt.remaining_amount + (editing?.amount || 0);
    if (Number(payload.amount) > allowed) throw new Error(`Số tiền trả vượt dư nợ ${money.format(allowed)}.`);
    const row = clean({ debt_id: payload.debt_id, amount: payload.amount, paid_at: payload.paid_at, sales_person: payload.sales_person, delivery_person: payload.delivery_person, notes: payload.notes });
    const query = editing ? supabase.from("payments").update(row).eq("id", editing.id) : supabase.from("payments").insert(row);
    const { error: saveError } = await query;
    if (saveError) throw saveError;
  }

  async function saveReturn(payload: RecordPayload) {
    const editing = modal.record as ReturnRow | null;
    const row = clean({ customer_id: payload.customer_id, debt_id: payload.debt_id, product_name: payload.product_name, quantity: payload.quantity, unit_price: payload.unit_price, returned_at: payload.returned_at, notes: payload.notes });
    const query = editing ? supabase.from("returns").update(row).eq("id", editing.id) : supabase.from("returns").insert(row);
    const { error: saveError } = await query;
    if (saveError) throw saveError;
  }

  async function deleteRecord(kind: ModalKind, id: string) {
    if (!window.confirm("Xoá bản ghi này? Thao tác không thể hoàn tác.")) return;
    const { error: deleteError } = await supabase.from(kind).delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else { setToast("Đã xoá bản ghi."); await loadData(true); }
  }

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-brand-card">
        <div className="sidebar-brand">
          <Link href={TAB_ROUTES.overview} onClick={() => setMenuOpen(false)} className="sidebar-brand-link">
            <Image
              src="/speego-logo-light.png"
              alt="SpeeGo LOGISTICS"
              width={1122}
              height={237}
              unoptimized
              priority
              className="sidebar-logo"
            />
          </Link>
          <button className="sidebar-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X size={19} /></button>
        </div>

          <div className="sidebar-live-block">
            <span className="live-pill">Live Production</span>
            <small>{lang === "en" ? "Live mode — orders and warehouse are running live." : "Chế độ live — đơn hàng và kho đang chạy thật."}</small>
          </div>
        </div>

        <div className="sidebar-scroll">
          <div className="sidebar-quota">
            <div className="quota-top">
              <span>{lang === "en" ? "THIS MONTH'S QUOTA" : "QUOTA THÁNG NÀY"}</span>
              <button type="button" aria-label="Thông tin quota" className="quota-info-btn">i</button>
            </div>
            <strong className="quota-label">{lang === "en" ? "Orders" : "Đơn hàng"}</strong>
            <i className="quota-track"><b style={{ width: `${quotaPercent}%` }} /></i>
            <small className="quota-val">{quotaUsed.toLocaleString("vi-VN")}/8.000</small>
          </div>

          <SidebarSection title={lang === "en" ? "MANAGEMENT" : "QUẢN TRỊ"}>
            <NavButton href={TAB_ROUTES.overview} icon={<LayoutDashboard />} label={lang === "en" ? "Overview" : "Tổng quan"} active={activeTab === "overview"} onNavigate={() => setMenuOpen(false)} />
            <NavButton href={TAB_ROUTES.staff} icon={<Users />} label={lang === "en" ? "Staff accounts" : "Tài khoản nhân viên"} active={activeTab === "staff" && (!staffSubTab || staffSubTab === "sellers")} onNavigate={() => setMenuOpen(false)} />
            {staffSectionActive && (
              <div className="sidebar-subnav">
                <NavButton href="/nhan-su?sub=activity" icon={<Activity size={16} />} label={lang === "en" ? "Activity & Status" : "Hoạt động & trạng thái"} active={staffSubTab === "activity"} onNavigate={() => setMenuOpen(false)} />
                <NavButton href="/nhan-su?sub=groups" icon={<Users size={16} />} label={lang === "en" ? "Staff groups" : "Nhóm nhân viên"} active={staffSubTab === "groups"} onNavigate={() => setMenuOpen(false)} />
                <NavButton href="/nhan-su?sub=tiers" icon={<SlidersHorizontal size={16} />} label={lang === "en" ? "Access permissions" : "Quyền truy cập"} active={staffSubTab === "tiers" || activeTab === "permissions"} onNavigate={() => setMenuOpen(false)} />
              </div>
            )}
            <NavButton href={TAB_ROUTES.warehouse} icon={<Warehouse />} label={lang === "en" ? "Warehouse system" : "Hệ thống kho"} active={warehouseSectionActive && (!warehouseSubTab || warehouseSubTab === "inventory")} onNavigate={() => setMenuOpen(false)} />
            {warehouseSectionActive && (
              <div className="sidebar-subnav">
                <NavButton href="/he-thong-kho?sub=inventory" icon={<Boxes size={16} />} label={lang === "en" ? "Inventory" : "Tồn kho"} active={warehouseSubTab === "inventory"} onNavigate={() => setMenuOpen(false)} />
                <NavButton href="/he-thong-kho?sub=inbound" icon={<Upload size={16} />} label={lang === "en" ? "Inbound" : "Nhập kho"} active={warehouseSubTab === "inbound"} onNavigate={() => setMenuOpen(false)} />
                <NavButton href="/he-thong-kho?sub=outbound" icon={<Download size={16} />} label={lang === "en" ? "Outbound" : "Xuất kho"} active={warehouseSubTab === "outbound"} onNavigate={() => setMenuOpen(false)} />
                <NavButton href="/he-thong-kho?sub=products" icon={<Layers2 size={16} />} label={lang === "en" ? "Products" : "Sản phẩm"} active={warehouseSubTab === "products"} onNavigate={() => setMenuOpen(false)} />
              </div>
            )}
            <NavButton href={TAB_ROUTES.ups_tracking} icon={<PackageSearch />} label={lang === "en" ? "Orders" : "Đơn hàng"} badge={orderBadge || 28} active={orderSectionActive} onNavigate={() => setMenuOpen(false)} />
            {orderSectionActive && (
              <div className="sidebar-subnav">
                <NavButton href={TAB_ROUTES.ups_tracking} icon={<ReceiptText />} label={lang === "en" ? "Orders list" : "Danh sách đơn"} badge={orderBadge || 28} active={activeTab === "ups_tracking"} onNavigate={() => setMenuOpen(false)} />
                <NavButton href={TAB_ROUTES.fulfillment} icon={<PackageCheck />} label="Fulfillment" active={activeTab === "fulfillment"} onNavigate={() => setMenuOpen(false)} />
                <NavButton href={TAB_ROUTES.returns} icon={<RotateCcw />} label="Return & Refund" badge={returns.length || undefined} active={activeTab === "returns"} onNavigate={() => setMenuOpen(false)} />
                <NavButton href={TAB_ROUTES.customers_list} icon={<Users />} label={lang === "en" ? "Customers" : "Khách hàng"} active={activeTab === "customers_list"} onNavigate={() => setMenuOpen(false)} />
              </div>
            )}
            <NavButton href={TAB_ROUTES.backup} icon={<DatabaseBackup />} label={lang === "en" ? "Backup & restore" : "Sao lưu & khôi phục"} active={activeTab === "backup"} onNavigate={() => setMenuOpen(false)} />
          </SidebarSection>
          <SidebarSection title={lang === "en" ? "FINANCE" : "TÀI CHÍNH"}>
            <NavButton href={TAB_ROUTES.settlements} icon={<ReceiptText />} label={lang === "en" ? "Settlements" : "Đối soát"} active={activeTab === "settlements"} onNavigate={() => setMenuOpen(false)} />
            <NavButton href={TAB_ROUTES.payout} icon={<CreditCard />} label="Payout" active={activeTab === "payout"} onNavigate={() => setMenuOpen(false)} />
          </SidebarSection>
          <SidebarSection title={lang === "en" ? "SETTINGS" : "CÀI ĐẶT"}>
            <NavButton href={TAB_ROUTES.app_settings} icon={<Settings />} label={lang === "en" ? "Settings" : "Cài đặt"} active={activeTab === "app_settings"} onNavigate={() => setMenuOpen(false)} />
            <NavButton href={TAB_ROUTES.help} icon={<Info />} label={lang === "en" ? "Help" : "Trợ giúp"} active={activeTab === "help"} onNavigate={() => setMenuOpen(false)} />
            <NavButton href={TAB_ROUTES.api_integrations} icon={<Plug />} label={lang === "en" ? "API Integrations" : "Tích hợp API"} active={activeTab === "api_integrations"} onNavigate={() => setMenuOpen(false)} />
            <NavButton href={TAB_ROUTES.privacy_policy} icon={<FileLock />} label={lang === "en" ? "Privacy Policy" : "Chính sách & Quyền riêng tư"} active={activeTab === "privacy_policy"} onNavigate={() => setMenuOpen(false)} />
          </SidebarSection>
        </div>

        <div className="sidebar-bottom-bar">
          <button type="button" className="sidebar-collapse-btn" title="Thu gọn" aria-label="Thu gọn sidebar">
            <ChevronLeft size={16} />
          </button>
        </div>
      </aside>
      {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Đóng menu" />}

      <div className="app-workspace">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Mở menu"><Menu size={21} /></button>
          <Link className="mobile-brand" href={TAB_ROUTES.overview}>
            <Image src="/speego-logo-dark-2x.png" alt="SpeeGo Logistics" width={110} height={28} style={{ objectFit: "contain" }} />
          </Link>
          <div className="topbar-context">
            <div className="top-search">
              <Search size={16} />
              <input readOnly value="" placeholder="Tìm sản phẩm, đơn, kho... (cách = VÀ, dấu phẩy = HOẶC)" aria-label="Tìm kiếm hệ thống" />
            </div>
          </div>
          <div className="top-actions">
            {/* Notification bell with exact 29 pill */}
            <button className="icon-button topbar-notification-btn" title="Thông báo" aria-label="Xem thông báo" onClick={() => setFilters({ ...EMPTY_FILTERS, status: "overdue" })}>
              <Bell size={18} />
              <span className="topbar-bell-badge">29</span>
            </button>

            {/* Dark / Light Theme toggle */}
            <button
              className="icon-button topbar-theme-btn"
              title={theme === "dark" ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"}
              aria-label="Đổi chế độ sáng tối"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Language toggle [ EN | VI ] */}
            <div className="topbar-lang-pill">
              <button
                type="button"
                className={`lang-sub-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => switchLang("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-sub-btn ${lang === "vi" ? "active" : ""}`}
                onClick={() => switchLang("vi")}
              >
                VI
              </button>
            </div>

            {/* User Profile Card */}
            <div className="topbar-user-profile" onClick={() => setSettingsOpen(true)}>
              <div className="topbar-avatar-ring">
                <Image
                  src="/admin-avatar.png"
                  alt="Avatar"
                  width={38}
                  height={38}
                  className="topbar-avatar-img"
                  priority
                />
              </div>
              <div className="topbar-user-info">
                <div className="topbar-email-line">
                  <span>admin@speedgo.com</span>
                  <span className="topbar-verified-shield" title="Tài khoản đã xác thực">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#22c55e">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </span>
                </div>
                <div className="topbar-roles-line">
                  <span className="role-tag admin">ADMIN</span>
                  <span className="role-tag owner">Owner</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="main-content">
        {activeTab !== "staff" && activeTab !== "permissions" && activeTab !== "warehouse" && (
          <div className="page-heading">
            <div>
              <h1>
                {activeTab === "overview"
                  ? lang === "en" ? "Overview" : "Tổng quan"
                  : pageTitle(activeTab)}
              </h1>
              <p>
                {activeTab === "overview"
                  ? lang === "en" ? "Overview of staff operations, warehouse and orders." : "Tổng quan vận hành nhân viên, kho và đơn hàng."
                  : pageDescription(activeTab)}
              </p>
            </div>
            <div className="heading-actions">
              {activeTab === "overview" ? (
                <div className="overview-header-tools">
                  <div className="quick-period-picker-wrap">
                    <button
                      type="button"
                      className="quick-period-btn"
                      onClick={() => setPeriodOpen((prev) => !prev)}
                    >
                      <Calendar size={15} />
                      <span>{PERIOD_LABELS[period][lang]}</span>
                      <ChevronDown size={14} className={periodOpen ? "rotated" : ""} />
                    </button>
                    {periodOpen && (
                      <div className="quick-period-dropdown">
                        {(Object.keys(PERIOD_LABELS) as DatePeriod[]).map((key) => (
                          <button
                            key={key}
                            type="button"
                            className={`quick-period-option ${period === key ? "active" : ""}`}
                            onClick={() => {
                              setPeriod(key);
                              setPeriodOpen(false);
                            }}
                          >
                            {PERIOD_LABELS[key][lang]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="quick-refresh-btn"
                    title="Làm mới"
                    onClick={() => void loadData(true)}
                  >
                    <RefreshCw size={15} className={refreshing ? "spin" : ""} />
                  </button>
                </div>
              ) : (
                <>
                  <button className="secondary-button" onClick={() => setSettingsOpen(true)}><Settings size={17} /> Cấu hình</button>
                  {activeTab === "ups_tracking" && <button className="primary-button" onClick={() => window.dispatchEvent(new Event("hahoa-ups-add-new"))}><Plus size={18} /> Thêm mới</button>}
                  {!["overview", "sales_routes", "zalo_contacts", "customers_list", "staff", "routes", "ups_tracking"].includes(activeTab) && !isOperationsPage && <button className="primary-button" onClick={openCreate}><Plus size={18} /> {addLabel(activeTab)}</button>}
                </>
              )}
            </div>
          </div>
        )}

        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}><X size={17} /></button></div>}
        {toast && <div className="toast-message">{toast}</div>}

        {isOperationsPage ? <OperationsConsole activeTab={activeTab as OperationTab} orders={speegoOrders} debts={filteredDebts} payments={paymentsWithCustomer} returns={filteredReturns} totals={totals} lang={lang} initialStaffSubTab={staffSubTab} initialWarehouseSubTab={warehouseSubTab} />
          : activeTab === "sales_routes" ? <SalesRouteManagement />
          : activeTab === "ups_tracking" ? <UpsTracking key={session.user.id} userId={session.user.id} />
          : activeTab === "zalo_contacts" ? <ZaloContacts accessToken={session.access_token} onOpenDebtAi={(prompt, imageDataUrls = []) => { setAiChatPrompt(prompt || null); setAiChatImages(imageDataUrls); setAiChatOpen(true); }} />
          : activeTab === "routes" ? <RouteManagement />
          : activeTab === "overview" ? <SpeedGoDashboard orders={speegoOrders} debts={filteredDebts} payments={paymentsWithCustomer} returns={filteredReturns} totals={totals} lang={lang} period={period} />
          : <>
          <SummaryCards {...totals} />
          <FilterPanel filters={filters} rows={debts} onChange={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} />

          {loading ? <TableSkeleton /> : activeTab === "payments" ? (
            <div className="payments-layout">
              <DataTable
                kind="debts"
                title="Khoản nợ chưa tất toán"
                rows={unsettledDebts}
                onPay={openPayment}
              />
              <DataTable
                kind="payments"
                title="Lịch sử trả nợ"
                rows={paymentsWithCustomer}
                onEdit={(row) => setModal({ open: true, kind: "payments", record: row, presetDebtId: null })}
                onDelete={(id) => void deleteRecord("payments", id)}
              />
            </div>
          ) : (
            <DataTable
              kind={activeTab}
              rows={activeRows}
              onPay={activeTab === "debts" ? openPayment : undefined}
              onEdit={(row) => setModal({ open: true, kind: activeTab as ModalKind, record: row, presetDebtId: null })}
              onDelete={(id) => void deleteRecord(activeTab as ModalKind, id)}
            />
          )}
        </>}
        </main>

        <nav className="mobile-bottom-nav" aria-label="Điều hướng chính">
          <NavButton href={TAB_ROUTES.overview} icon={<LayoutDashboard />} label="Tổng quan" active={activeTab === "overview"} />
          <NavButton href={TAB_ROUTES.ups_tracking} icon={<PackageSearch />} label="Đơn hàng" active={activeTab === "ups_tracking"} />
          <NavButton href={TAB_ROUTES.warehouse} icon={<Warehouse />} label="Kho" active={activeTab === "warehouse"} />
          <NavButton href={TAB_ROUTES.settlements} icon={<ReceiptText />} label="Đối soát" active={activeTab === "settlements"} />
          <button type="button" className={menuOpen ? "active" : ""} onClick={() => setMenuOpen(true)}><Menu /><span>Menu</span></button>
        </nav>
      </div>

      {settingsOpen && <SettingsDrawer settings={settings} onClose={() => setSettingsOpen(false)} onSaved={(next) => { setSettings(next); setToast("Đã cập nhật cấu hình."); setSettingsOpen(false); }} onLogout={() => void supabase.auth.signOut()} />}
      {aiChatOpen && <DebtAiChat key={aiChatPrompt || "debt-ai"} accessToken={session.access_token} initialPrompt={aiChatPrompt} initialImageDataUrls={aiChatImages} onClose={() => { setAiChatOpen(false); setAiChatPrompt(null); setAiChatImages([]); }} />}
      {modal.open && <RecordModal key={`${modal.kind}-${modal.record?.id || modal.presetDebtId || "new"}`} open kind={modal.kind} record={modal.record} presetDebtId={modal.presetDebtId} customers={customers} debts={debts} settings={settings} saving={saving} onClose={closeModal} onSave={saveRecord} />}
    </div>
  );
}

function NavButton({ href, icon, label, active, badge, onNavigate, onClick }: { href?: string; icon: React.ReactNode; label: string; active: boolean; badge?: number | string; onNavigate?: () => void; onClick?: () => void }) {
  if (href) {
    return (
      <Link href={href} className={active ? "active" : ""} onClick={onNavigate}>
        {icon}
        <span>{label}</span>
        {badge != null && <b className="nav-badge">{badge}</b>}
      </Link>
    );
  }
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span>{badge != null && <b className="nav-badge">{badge}</b>}</button>;
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="sidebar-section"><p>{title}</p><nav>{children}</nav></section>;
}

function SettingsDrawer({ settings, onClose, onSaved, onLogout }: { settings: AppSettings; onClose: () => void; onSaved: (next: AppSettings) => void; onLogout: () => void }) {
  const [maxDebt, setMaxDebt] = useState(String(settings.max_debt));
  const [terms, setTerms] = useState(settings.debt_terms.join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    const debtTerms = [...new Set(terms.split(/[,;\s]+/).map(Number).filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
    if (!debtTerms.length) return;
    setSaving(true);
    const next = { max_debt: toNumber(maxDebt), debt_terms: debtTerms };
    const { error } = await supabase.from("organization_settings").update(next).eq("id", 1);
    setSaving(false);
    if (!error) onSaved(next);
  }

  return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="settings-drawer"><div className="modal-heading"><div><p className="eyebrow">THIẾT LẬP</p><h2>Cấu hình vận hành</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><div className="settings-body"><label className="field"><span>Ngưỡng cảnh báo tài chính</span><input inputMode="numeric" value={maxDebt} onChange={(event) => setMaxDebt(event.target.value)} /><small>Đặt 0 nếu không giới hạn. Hiện tại: {money.format(toNumber(maxDebt))}</small></label><label className="field"><span>Chu kỳ nhắc xử lý đơn (ngày)</span><input value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="15, 30, 45, 60" /><small>Phân cách bằng dấu phẩy.</small></label><button className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? "Đang lưu…" : "Lưu cấu hình"}</button></div><div className="drawer-footer"><button className="secondary-button danger-text" onClick={onLogout}><LogOut size={17} /> Đăng xuất</button></div></aside></div>;
}

function TableSkeleton() {
  return <div className="table-card skeleton-card"><i /><i /><i /><i /><i /></div>;
}

function sortDebtsByDueDate(rows: DebtRow[]) {
  return [...rows].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.customer_name.localeCompare(b.customer_name, "vi"));
}

function matchDebt(row: DebtRow, filters: Filters) {
  if (filters.from && row.order_date < filters.from) return false;
  if (filters.to && row.order_date > filters.to) return false;
  if (filters.customer && row.customer_name !== filters.customer) return false;
  if (filters.sales && row.sales_person !== filters.sales) return false;
  if (filters.delivery && row.delivery_person !== filters.delivery) return false;
  if (filters.region && !row.region?.toLocaleLowerCase("vi").includes(filters.region.toLocaleLowerCase("vi"))) return false;
  if (filters.status && row.status !== filters.status) return false;
  if (filters.search) {
    const haystack = `${row.customer_code || ""} ${row.customer_name} ${row.phone || ""} ${row.region || ""} ${row.product_name || ""} ${row.notes || ""}`.toLocaleLowerCase("vi");
    if (!haystack.includes(filters.search.toLocaleLowerCase("vi"))) return false;
  }
  return true;
}

function normalizeDebt(row: DebtRow): DebtRow {
  return { ...row, amount: Number(row.amount), paid_amount: Number(row.paid_amount), returned_amount: Number(row.returned_amount), remaining_amount: Number(row.remaining_amount), due_days: Number(row.due_days), quantity: row.quantity == null ? null : Number(row.quantity), unit_price: row.unit_price == null ? null : Number(row.unit_price) };
}

function normalizePayment(row: PaymentRow): PaymentRow { return { ...row, amount: Number(row.amount) }; }

function normalizeSpeegoOrder(row: SpeegoOrderRow): SpeegoOrderRow {
  return {
    ...row,
    amount: row.amount == null ? null : Number(row.amount),
    unit_price: row.unit_price == null ? null : Number(row.unit_price),
    exchange_rate: row.exchange_rate == null ? null : Number(row.exchange_rate),
    total_amount_vnd: row.total_amount_vnd == null ? null : Number(row.total_amount_vnd),
    collected: Boolean(row.collected),
  };
}

function enrichPayment(row: PaymentRow, debts: DebtRow[]): PaymentRow {
  const debt = debts.find((item) => item.id === row.debt_id);
  return {
    ...row,
    customer_name: getPaymentCustomerName(row, debts),
    customer_code: debt?.customer_code ?? null,
    phone: debt?.phone ?? null,
    debt_order_date: row.debt?.order_date || debt?.order_date,
  };
}

function getPaymentCustomerName(row: PaymentRow, debts: DebtRow[]) {
  const debt = debts.find((item) => item.id === row.debt_id);
  return row.debt?.customer?.name || debt?.customer_name || "Không rõ";
}
function normalizeReturn(row: ReturnRow): ReturnRow { return { ...row, quantity: Number(row.quantity), unit_price: Number(row.unit_price), total_amount: Number(row.total_amount) }; }

function cleanSpeedGoUserName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name && !/(hà\s*hoà|ha\s*hoa|hahoanpp)/i.test(name) ? name : "Quản trị SpeedGo";
}

function clean(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === "" ? null : value]));
}

async function fetchPaged(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
) {
  const pageSize = 1000;
  const data: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) return { data, error: result.error };
    const page = result.data || [];
    data.push(...page);
    if (page.length < pageSize) break;
  }
  return { data, error: null };
}

function initials(value: string) { return value.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function pageTitle(tab: TabKey) {
  if (tab === "overview") return "Tổng quan";
  if (tab === "ups_tracking") return "Đơn hàng";
  if (tab === "staff") return "Tài khoản nhân viên";
  if (tab === "warehouse") return "Hệ thống kho";
  if (tab === "warehouse_locations") return "Vị trí kho";
  if (tab === "warehouse_expiry") return "Hạn sử dụng";
  if (tab === "warehouse_serials") return "Serial / IMEI / Batch";
  if (tab === "warehouse_combos") return "Combo hàng";
  if (tab === "fulfillment") return "Fulfillment";
  if (tab === "returns") return "Return & Refund";
  if (tab === "customers_list") return "Khách hàng";
  if (tab === "permissions") return "Phân quyền";
  if (tab === "settlements") return "Đối soát";
  if (tab === "payout") return "Payout";
  if (tab === "backup") return "Sao lưu & khôi phục";
  if (tab === "app_settings") return "Cài đặt";
  if (tab === "help") return "Trợ giúp";
  if (tab === "api_integrations") return "Tích hợp API";
  if (tab === "privacy_policy") return "Chính sách & Quyền riêng tư";
  if (tab === "debts") return "Khách hàng nợ";
  if (tab === "payments") return "Khách hàng trả nợ";
  if (tab === "sales_routes") return "Quản trị Sale theo tuyến";
  if (tab === "zalo_contacts") return "Danh bạ liên hệ";
  if (tab === "routes") return "Tuyến bán hàng";
  return "Tổng quan";
}
function pageDescription(tab: TabKey) {
  if (tab === "overview") return "Tổng quan vận hành nhân viên, kho, đơn hàng và fulfillment.";
  if (tab === "ups_tracking") return "Tất cả đơn hàng, mã vận đơn và tiến độ giao hàng UPS trong một bảng.";
  if (tab === "staff") return "Quản lý tài khoản, vai trò và phạm vi thao tác của từng nhân viên.";
  if (tab === "warehouse") return "Số hóa tồn kho, vị trí lưu trữ, FEFO, combo và serial trong một màn vận hành.";
  if (tab === "warehouse_locations") return "Bản đồ rack, dãy và ô lưu trữ để đội kho pick đúng vị trí.";
  if (tab === "warehouse_expiry") return "Theo dõi lô, hạn dùng và nguyên tắc FEFO trước khi xuất kho.";
  if (tab === "warehouse_serials") return "Quản lý serial, IMEI, batch và quét barcode cho đơn fulfillment.";
  if (tab === "warehouse_combos") return "Tự động phân rã combo và giữ tồn từng thành phần khi tạo đơn.";
  if (tab === "fulfillment") return "Quản lý pick, pack, bàn giao và phí fulfillment theo từng đơn.";
  if (tab === "returns") return "Xử lý thu hồi, kiểm hàng và hoàn phí cho đơn sau giao.";
  if (tab === "customers_list") return "Quản lý khách hàng, lịch sử đơn và trạng thái chăm sóc.";
  if (tab === "permissions") return "Ma trận phân quyền rõ vai trò xem, thêm, sửa, xóa trên hệ thống.";
  if (tab === "settlements") return "Kiểm tra phí fulfillment, trạng thái chốt và lệch đối soát.";
  if (tab === "payout") return "Theo dõi batch payout, số tiền sẵn sàng và dòng tiền chờ ngân hàng.";
  if (tab === "backup") return "Kiểm soát lịch sao lưu, nguồn dữ liệu và điểm khôi phục hệ thống.";
  if (tab === "app_settings") return "Cấu hình chế độ vận hành, quota, ngôn ngữ và quy tắc đồng bộ.";
  if (tab === "help") return "Trung tâm hỗ trợ vận hành và trạng thái dịch vụ SpeedGo.";
  if (tab === "api_integrations") return "Tổng hợp kênh đồng bộ Firestore, Supabase, UPS và webhook nội bộ.";
  if (tab === "privacy_policy") return "Quản lý chính sách dữ liệu, quyền riêng tư và nhật ký truy cập.";
  if (tab === "sales_routes") return "Theo dõi kết quả gọi khách, doanh thu, phản hồi thị trường và kế hoạch bán hàng từng tuyến.";
  if (tab === "zalo_contacts") return "Lưu liên hệ và mở đúng cuộc hội thoại chăm sóc khách hàng.";
  if (tab === "payments") return "Xem khoản nợ chưa tất toán, ghi nhận thanh toán và theo dõi lịch sử trả cho từng khách hàng.";
  if (tab === "routes") return "Quản lý tuyến bán hàng, địa điểm và nhân viên phụ trách.";
  return "Không gian vận hành SpeedGo.";
}
function addLabel(tab: TabKey) { return tab === "payments" ? "Ghi nhận trả nợ" : tab === "returns" ? "Ghi nhận thu hồi" : "Thêm khoản nợ"; }
