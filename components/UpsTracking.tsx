"use client";

import { StaffIdentity } from "@/components/StaffIdentity";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Grid,
  House,
  MapPin,
  MoreVertical,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  TriangleAlert,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { UpsRunner } from "@/components/UpsRunner";
import { supabase } from "@/lib/supabase";
import {
  localDateKey,
  matchesOrderDate,
  parseTrackingCodes,
  trackingOrderId,
  type SpeegoPeriod,
} from "@/lib/speego-order-utils";

type TrackingEvent = {
  status: string;
  rawStatus: string;
  date?: string;
  time?: string;
  location?: string;
  details?: string;
};

type Row = {
  id?: string;
  code: string;
  orderId?: string;
  sourceOrderId?: string;
  sourceOrderCode?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  marketingStaff?: string;
  salesPerson?: string;
  customerServiceStaff?: string;
  deliveryPerson?: string;
  shippingUnit?: string;
  createdAt?: string;
  amount?: number;
  unitPrice?: number;
  currency?: string;
  exchangeRate?: number;
  totalAmountVnd?: number;
  sourceSyncedAt?: string;
  edd?: string;
  collected?: boolean;
  status?: string;
  rawStatus?: string;
  checkedAt?: string;
  error?: string;
  history?: TrackingEvent[];
};

type Response = Partial<Row> & { ok: boolean; fatal?: boolean; version?: string };
type SyncResponse = { ok: boolean; error?: string; sourceRows?: number; supabaseRows?: number; speedGoRows?: number; speedGoTrackingRows?: number; inserted?: number; updated?: number; from?: string; before?: string };
type ShipmentStep = 1 | 2 | 3 | 4 | 5;
type TrackingDetailTab = "timeline" | "time" | "status";
type ManualDraft = {
  orderId: string;
  trackingCode: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  salesPerson: string;
  deliveryPerson: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  orderDate: string;
};

type SpeegoRecord = {
  id: string;
  order_id: string;
  tracking_code: string;
  source_order_id: string | null;
  source_order_code: string | null;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  marketing_staff: string | null;
  sales_person: string | null;
  customer_service_staff: string | null;
  delivery_person: string | null;
  shipping_unit: string | null;
  order_date: string;
  amount: number | string | null;
  unit_price: number | string | null;
  currency: string | null;
  exchange_rate: number | string | null;
  total_amount_vnd: number | string | null;
  source_synced_at: string | null;
  edd: string | null;
  collected: boolean;
  status: string | null;
  raw_status: string | null;
  checked_at: string | null;
  error: string | null;
  history: unknown;
};

const UPS_EXTENSION_VERSION = "0.4.0";
const TRACKING_CONCURRENCY = 6;
const DATABASE_PAGE_SIZE = 1000;
const MAX_ORDERS = 5000;
const LOCAL_CACHE_LIMIT = 100;
const DATABASE_WRITE_BATCH_SIZE = 100;
const SPEEGO_SELECT = "id,source_order_id,source_order_code,order_id,tracking_code,customer_name,phone,email,address,city,state,postal_code,country,marketing_staff,sales_person,customer_service_staff,delivery_person,shipping_unit,order_date,amount,unit_price,currency,exchange_rate,total_amount_vnd,source_synced_at,edd,collected,status,raw_status,checked_at,error,history";

function createManualDraft(): ManualDraft {
  return {
    orderId: "",
    trackingCode: "",
    customerName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    salesPerson: "",
    deliveryPerson: "",
    amount: "",
    currency: "USD",
    exchangeRate: "0",
    orderDate: localDateKey(),
  };
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function numberValue(value: unknown) {
  const result = Number(value);
  return value != null && Number.isFinite(result) ? result : undefined;
}

function formatMoney(value?: number, currency = "USD") {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toLocaleString("vi-VN")} ${currency}`;
  }
}

async function fetchSpeegoRows() {
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ORDERS; from += DATABASE_PAGE_SIZE) {
    const { data, error } = await supabase.from("speego").select(SPEEGO_SELECT)
      .order("order_date", { ascending: false }).order("created_at", { ascending: false })
      .range(from, from + DATABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data as unknown as SpeegoRecord[]).map(fromSpeegoRecord);
    rows.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) break;
  }
  return rows;
}

function formatOrderDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed)
    : value;
}

function normalizeHistory(value: unknown): TrackingEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const status = cleanString(record.status, 120);
    const rawStatus = cleanString(record.rawStatus, 160);
    if (!status || !rawStatus) return [];
    return [{
      status,
      rawStatus,
      date: cleanString(record.date, 80) || undefined,
      time: cleanString(record.time, 40) || undefined,
      location: cleanString(record.location, 180) || undefined,
      details: cleanString(record.details, 320) || undefined,
    }];
  });
}

function normalizeSavedRow(value: unknown): Row | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const code = cleanString(record.code, 34).toUpperCase();
  if (!/^[A-Z0-9]{7,34}$/.test(code)) return null;
  const amount = Number(record.amount);
  return {
    id: cleanString(record.id, 50) || undefined,
    code,
    orderId: cleanString(record.orderId, 32) || trackingOrderId(code),
    sourceOrderId: cleanString(record.sourceOrderId, 160) || undefined,
    sourceOrderCode: cleanString(record.sourceOrderCode, 160) || undefined,
    customerName: cleanString(record.customerName, 120) || undefined,
    phone: cleanString(record.phone, 40) || undefined,
    email: cleanString(record.email, 200) || undefined,
    address: cleanString(record.address, 500) || undefined,
    city: cleanString(record.city, 160) || undefined,
    state: cleanString(record.state, 160) || undefined,
    postalCode: cleanString(record.postalCode, 40) || undefined,
    country: cleanString(record.country, 120) || undefined,
    marketingStaff: cleanString(record.marketingStaff, 160) || undefined,
    salesPerson: cleanString(record.salesPerson, 160) || undefined,
    customerServiceStaff: cleanString(record.customerServiceStaff, 160) || undefined,
    deliveryPerson: cleanString(record.deliveryPerson, 160) || undefined,
    shippingUnit: cleanString(record.shippingUnit, 160) || undefined,
    createdAt: cleanString(record.createdAt, 24) || undefined,
    amount: Number.isFinite(amount) && amount >= 0 ? amount : undefined,
    unitPrice: numberValue(record.unitPrice),
    currency: cleanString(record.currency, 3) || undefined,
    exchangeRate: numberValue(record.exchangeRate),
    totalAmountVnd: numberValue(record.totalAmountVnd),
    sourceSyncedAt: cleanString(record.sourceSyncedAt, 50) || undefined,
    edd: cleanString(record.edd, 24) || undefined,
    collected: record.collected === true,
    status: cleanString(record.status, 120) || undefined,
    rawStatus: cleanString(record.rawStatus, 160) || undefined,
    checkedAt: cleanString(record.checkedAt, 50) || undefined,
    error: cleanString(record.error, 500) || undefined,
    history: normalizeHistory(record.history),
  };
}

function fromSpeegoRecord(record: SpeegoRecord): Row {
  return {
    id: record.id,
    code: record.tracking_code,
    orderId: record.order_id,
    sourceOrderId: record.source_order_id || undefined,
    sourceOrderCode: record.source_order_code || undefined,
    customerName: record.customer_name || undefined,
    phone: record.phone || undefined,
    email: record.email || undefined,
    address: record.address || undefined,
    city: record.city || undefined,
    state: record.state || undefined,
    postalCode: record.postal_code || undefined,
    country: record.country || undefined,
    marketingStaff: record.marketing_staff || undefined,
    salesPerson: record.sales_person || undefined,
    customerServiceStaff: record.customer_service_staff || undefined,
    deliveryPerson: record.delivery_person || undefined,
    shippingUnit: record.shipping_unit || undefined,
    createdAt: record.order_date,
    amount: numberValue(record.amount),
    unitPrice: numberValue(record.unit_price),
    currency: record.currency || undefined,
    exchangeRate: numberValue(record.exchange_rate),
    totalAmountVnd: numberValue(record.total_amount_vnd),
    sourceSyncedAt: record.source_synced_at || undefined,
    edd: record.edd || undefined,
    collected: record.collected,
    status: record.status || undefined,
    rawStatus: record.raw_status || undefined,
    checkedAt: record.checked_at || undefined,
    error: record.error || undefined,
    history: normalizeHistory(record.history),
  };
}


function shipmentStep(row: Row): ShipmentStep {
  const status = `${row.rawStatus || ""} ${row.status || ""}`.toLowerCase();
  if (/delivered|đã giao hàng/.test(status)) return 5;
  if (/out for delivery|on the way|in transit|departed|arrived|processing|đang giao|đang vận chuyển|đã đến|đã rời/.test(status)) return 4;
  if (/we have your package|drop-?off|dropped off|ups đã nhận|đã gửi tại/.test(status)) return 3;
  if (/label created|đã tạo nhãn/.test(status)) return 2;
  return 1;
}

function orderState(row: Row) {
  const step = shipmentStep(row);
  if (step === 5) return { label: "Đã giao", className: "delivered" };
  if (step === 4) return { label: "Đang giao", className: "shipping" };
  if (step === 3) return { label: "Đã gửi", className: "sent" };
  if (step === 2) return { label: "Đã nhận tin", className: "received" };
  return { label: "Mới", className: "new" };
}

function connectionLabel(response: Response) {
  if (!response.ok) return response.error || "Chưa kết nối";
  if (response.version !== UPS_EXTENSION_VERSION) {
    return `Cần cập nhật tiện ích ${UPS_EXTENSION_VERSION} (đang dùng ${response.version || "bản cũ"})`;
  }
  return `Đã kết nối UPS ${response.version}`;
}

function request(action: "ping" | "track", code?: string): Promise<Response> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const finish = (result: Response) => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
      resolve(result);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin
        || event.data?.source !== "hahoa-ups-extension" || event.data.requestId !== requestId) return;
      finish(event.data);
    };
    const timer = window.setTimeout(() => finish({ ok: false, fatal: true,
      error: action === "ping" ? "Chưa kết nối tiện ích UPS. Cài tiện ích rồi tải lại trang."
        : "Tiện ích không phản hồi. Kiểm tra tab UPS và tải lại tiện ích trước khi thử lại.",
    }), action === "ping" ? 2000 : 60000);
    window.addEventListener("message", receive);
    window.postMessage({ source: "hahoa-ups-page", requestId, action, code }, location.origin);
  });
}

function OrderStepper({ step }: { step: ShipmentStep }) {
  const stepClass = (number: ShipmentStep) => `shipment-step step-${number}${step >= number ? " active" : ""}${step === number ? " current" : ""}`;
  const lineClass = (number: ShipmentStep) => `shipment-line${step >= number ? " active" : ""}`;
  return <div className="shipment-stepper" aria-label={`Tiến độ giao hàng bước ${step} trên 5`}>
    <span className={stepClass(1)} title="Tạo đơn"><Check size={12} /></span>
    <i className={lineClass(2)} />
    <span className={stepClass(2)} title="Xử lý / Nhãn"><FileText size={12} /></span>
    <i className={lineClass(3)} />
    <span className={stepClass(3)} title="UPS đã nhận"><Package size={12} /></span>
    <i className={lineClass(4)} />
    <span className={stepClass(4)} title="Đang giao hàng"><Truck size={12} /></span>
    <i className={lineClass(5)} />
    <span className={stepClass(5)} title="Đã giao"><House size={12} /></span>
  </div>;
}


function shortOrderCode(row: Row): string {
  if (row.sourceOrderCode?.startsWith("#SG")) return row.sourceOrderCode;
  if (row.orderId?.startsWith("#SG")) return row.orderId;
  const base = row.sourceOrderCode || row.orderId || row.code;
  const clean = base.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (clean.length > 5) {
    return `#${clean.slice(-4)}`;
  }
  return `#${clean || "2A94"}`;
}

function formatSpeegoDate(dateStr?: string | null): string {
  if (!dateStr) return "9 thg 9, 2026";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "9 thg 9, 2026";
  return `${date.getDate()} thg ${date.getMonth() + 1}, ${date.getFullYear()}`;
}

function formatSpeegoMoney(amount?: number | null, currency = "US$"): string {
  const val = Number(amount || 0);
  const formatted = val.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${currency === "USD" || !currency ? "US$" : currency}`;
}

function OrderStepperV2({ row }: { row: Row }) {
  const step = shipmentStep(row);
  const isFailed = Boolean(row.error) || /fail|undeliver|thất bại|lỗi/i.test(row.status || "");
  const isDelivered = step >= 5 || /deliver|đã giao/i.test(row.status || "");

  return (
    <div className="shipment-stepper-v2" title={row.status || "Chưa có thông tin"}>
      {/* Node 1: Warehouse / Tạo đơn (cyan/blue) */}
      <span className="stepper-node-v2 node-blue" title="Tạo đơn / Kho">
        <House size={11} />
      </span>
      <span className="stepper-line-v2 active" />

      {/* Node 2: Payment / Label (teal/cyan) */}
      <span className="stepper-node-v2 node-teal" title="Xử lý / Nhãn / Thanh toán">
        <CreditCard size={11} />
      </span>
      <span className={`stepper-line-v2 ${step >= 2 ? "active" : ""}`} />

      {/* Node 3: Origin Facility / Pin (orange) */}
      <span className={`stepper-node-v2 ${step >= 3 ? "node-orange" : "node-muted"}`} title="Xuất kho / Trạm gốc">
        <MapPin size={11} />
      </span>
      <span className={`stepper-line-v2 ${step >= 3 ? "active" : ""}`} />

      {/* Node 4: In Transit / Truck (blue) */}
      <span className={`stepper-node-v2 ${step >= 4 ? "node-blue" : "node-muted"}`} title="Đang vận chuyển">
        <Truck size={11} />
      </span>
      <span className={`stepper-line-v2 ${step >= 4 ? "active" : ""}`} />

      {/* Node 5: Out for delivery / Destination (orange) */}
      <span className={`stepper-node-v2 ${step >= 4 ? "node-orange" : "node-muted"}`} title="Trạm phát">
        <Package size={11} />
      </span>
      <span className={`stepper-line-v2 ${step >= 5 || isFailed ? "active" : ""}`} />

      {/* Node 6: Check (green) or Alert (red) */}
      {isFailed ? (
        <span className="stepper-node-v2 node-red" title="Giao thất bại / Cần xử lý">
          <TriangleAlert size={11} />
        </span>
      ) : isDelivered ? (
        <span className="stepper-node-v2 node-green" title="Đã giao thành công">
          <Check size={11} />
        </span>
      ) : (
        <span className="stepper-node-v2 node-muted" title="Chờ giao">
          <Check size={11} />
        </span>
      )}
    </div>
  );
}

export function UpsTracking({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [trackingProgress, setTrackingProgress] = useState({ completed: 0, total: 0, batch: 0, batches: 0 });
  const [runnerBusy, setRunnerBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("Chưa kiểm tra kết nối");
  const [database, setDatabase] = useState("Đang kết nối bảng speego");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailCode, setDetailCode] = useState("");
  const [detailTab, setDetailTab] = useState<TrackingDetailTab>("timeline");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(() => createManualDraft());
  const [manualSaving, setManualSaving] = useState(false);
  const [quickCodes, setQuickCodes] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<SpeegoPeriod>("all");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [eddFilter, setEddFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [showCarrierOnly, setShowCarrierOnly] = useState(false);

  const mounted = useRef(true);
  const locked = useRef(false);
  const storageKey = `hahoa-ups-v1:${userId}`;

  useEffect(() => {
    const openManualOrder = () => {
      setManualDraft(createManualDraft());
      setManualOpen(true);
    };
    window.addEventListener("hahoa-ups-add-new", openManualOrder);
    return () => window.removeEventListener("hahoa-ups-add-new", openManualOrder);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => {
      let cached: Row[] = [];
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(saved)) {
          // Read the complete legacy cache once so older rows can still migrate to Supabase.
          cached = saved.map(normalizeSavedRow).filter((row): row is Row => Boolean(row)).slice(0, MAX_ORDERS);
          setRows(cached);
        }
      } catch { setNotice("Không đọc được bảng đã lưu trên trình duyệt."); }
      void (async () => {
        try {
          const databaseRows = await fetchSpeegoRows();
          if (!mounted.current) return;
          setRows(databaseRows);
          try { localStorage.setItem(storageKey, JSON.stringify(databaseRows.slice(0, LOCAL_CACHE_LIMIT))); }
          catch { setNotice("Đã đọc Supabase nhưng không lưu được bản sao trên trình duyệt."); }
          setDatabase("Đồng bộ Supabase · bảng speego");
        } catch (error) {
          if (!mounted.current) return;
          setDatabase("Chưa kết nối được bảng speego");
          setNotice(`Supabase chưa sẵn sàng: ${error instanceof Error ? error.message : "Lỗi không xác định"}. Dữ liệu tạm thời vẫn được giữ trên trình duyệt.`);
        }
      })();
      void request("ping").then((response) => {
        if (mounted.current) setConnection(connectionLabel(response));
      });
    }, 0);
    return () => { mounted.current = false; window.clearTimeout(timer); };
  }, [storageKey]);

  useEffect(() => {
    if (running || syncing) return;
    let stopped = false;
    let refreshing = false;
    const timer = setInterval(() => {
      if (refreshing) return;
      refreshing = true;
      void fetchSpeegoRows().then((data) => { if (!stopped) setRows(data); }).catch(() => {})
        .finally(() => { refreshing = false; });
    }, 15_000);
    return () => { stopped = true; clearInterval(timer); };
  }, [running, syncing]);

  const staffList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.salesPerson) set.add(r.salesPerson); });
    if (!set.size) { set.add("Trúc Kiều"); set.add("Ngọc Dân"); }
    return Array.from(set);
  }, [rows]);

  const speegoTabs = useMemo(() => [
    { key: "all", label: "Tất cả", count: rows.length },
    { key: "new", label: "Đơn mới tạo", count: rows.filter((r) => !r.checkedAt || orderState(r).className === "new").length },
    { key: "reprocess", label: "Đơn xử lý lại", count: rows.filter((r) => Boolean(r.error && !r.collected)).length },
    { key: "action_needed", label: "Cần xử lý", count: rows.filter((r) => Boolean(r.error)).length },
    { key: "fulfillment_waiting", label: "Chờ fulfillment", count: 0 },
    { key: "waiting", label: "Đang chờ", count: rows.filter((r) => ["received", "sent"].includes(orderState(r).className)).length },
    { key: "shipping", label: "Đang giao", count: rows.filter((r) => orderState(r).className === "shipping").length },
    { key: "failed", label: "Giao thất bại", count: rows.filter((r) => Boolean(r.error) || /fail|undeliver|thất bại|lỗi/i.test(r.status || "")).length },
  ], [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return rows.filter((row) => {
      if (query && ![row.orderId, row.sourceOrderCode, row.code, row.customerName, row.phone,
        row.email, row.address, row.salesPerson, row.deliveryPerson]
        .some((value) => value?.toLocaleLowerCase("vi").includes(query))) return false;

      // Status pill filter
      if (statusFilter === "new") {
        if (!(!row.checkedAt || orderState(row).className === "new")) return false;
      } else if (statusFilter === "reprocess") {
        if (!(row.error && !row.collected)) return false;
      } else if (statusFilter === "action_needed") {
        if (!row.error) return false;
      } else if (statusFilter === "fulfillment_waiting") {
        return false;
      } else if (statusFilter === "waiting") {
        if (!["received", "sent"].includes(orderState(row).className)) return false;
      } else if (statusFilter === "shipping") {
        if (orderState(row).className !== "shipping") return false;
      } else if (statusFilter === "failed") {
        const isFail = Boolean(row.error) || /fail|undeliver|thất bại|lỗi/i.test(row.status || "");
        if (!isFail) return false;
      } else if (statusFilter === "collected") {
        if (!row.collected) return false;
      }

      // Staff filter
      if (staffFilter !== "all" && row.salesPerson !== staffFilter) return false;

      // EDD filter
      if (eddFilter === "has_edd" && !row.edd) return false;
      if (eddFilter === "no_edd" && row.edd) return false;

      // Carrier filter
      if (carrierFilter !== "all" && (row.shippingUnit || "UPS") !== carrierFilter) return false;

      if (!matchesOrderDate(row.createdAt, { day: dayFilter, month: monthFilter, period: periodFilter })) return false;

      return true;
    });
  }, [rows, search, statusFilter, staffFilter, eddFilter, carrierFilter, dayFilter, monthFilter, periodFilter]);

  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.includes(row.code));
  const pendingCount = rows.filter((row) => !row.checkedAt).length;
  const selectedDetail = rows.find((row) => row.code === detailCode) || null;
  const statusTabs = speegoTabs;

  function save(next: Row[]) {
    setRows(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next.slice(0, LOCAL_CACHE_LIMIT))); }
    catch { setNotice("Không lưu được bản sao tạm trên trình duyệt; kết quả vẫn được đồng bộ vào Supabase."); }
  }

  async function persistRows(changed: Row[]) {
    for (const row of changed) {
      const { data: current, error: readError } = await supabase.from("speego")
        .select("history,checked_at").eq("id", row.id!).single();
      if (readError) return readError.message;
      if (current.checked_at && row.checkedAt && Date.parse(current.checked_at) > Date.parse(row.checkedAt)) continue;
      const combined = [...(row.history || []), ...normalizeHistory(current.history)];
      const seen = new Set<string>();
      const history = combined.filter((event) => {
        const key = JSON.stringify(event);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      const patch = row.error ? { error: row.error } : {
        status: row.status, raw_status: row.rawStatus, checked_at: row.checkedAt,
        ...(row.edd ? { edd: row.edd } : {}), history, error: null,
      };
      let query = supabase.from("speego").update(patch).eq("id", row.id!);
      query = current.checked_at ? query.eq("checked_at", current.checked_at) : query.is("checked_at", null);
      const { data, error } = await query.select("id");
      if (error) return error.message;
      if (!data.length) return "Dữ liệu vừa được cập nhật ở nơi khác; tải lại bảng để kiểm tra.";
    }
    return "";
  }

  async function deleteRows(codes: string[]) {
    for (let offset = 0; offset < codes.length; offset += DATABASE_WRITE_BATCH_SIZE) {
      const batch = codes.slice(offset, offset + DATABASE_WRITE_BATCH_SIZE);
      const { error } = await supabase.from("speego").delete().in("tracking_code", batch);
      if (error) {
        setDatabase("Lỗi đồng bộ bảng speego");
        return error.message;
      }
    }
    setDatabase("Đồng bộ Supabase · bảng speego");
    return "";
  }

  async function syncOrders() {
    if (running || syncing) return;
    setSyncing(true);
    setNotice("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Phiên đăng nhập đã hết hạn.");
      const response = await fetch("/api/speego/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json() as SyncResponse;
      if (!response.ok || !result.ok) throw new Error(result.error || "Đồng bộ đơn hàng thất bại.");
      const databaseRows = await fetchSpeegoRows();
      save(databaseRows);
      setDatabase("Đồng bộ Supabase · bảng speego");
      setNotice(`Đã hợp nhất ${result.sourceRows || 0} mã UPS có tiền tố 1Z (Supabase ${result.supabaseRows || 0}; SpeedGo ${result.speedGoRows || 0} đơn / ${result.speedGoTrackingRows || 0} mã): thêm ${result.inserted || 0}, cập nhật ${result.updated || 0}.`);
    } catch (error) {
      setDatabase("Lỗi đồng bộ bảng speego");
      setNotice(error instanceof Error ? error.message : "Đồng bộ đơn hàng thất bại.");
    } finally {
      setSyncing(false);
    }
  }

  async function toggleCollected(code: string) {
    if (running || syncing) return;
    const next = rows.map((row) => row.code === code ? { ...row, collected: !row.collected } : row);
    save(next);
    const changed = next.find((row) => row.code === code);
    const { error: collectionError } = changed ? await supabase.from("speego")
      .update({ collected: changed.collected }).eq("id", changed.id!) : { error: null };
    const syncError = collectionError?.message || "";
    if (syncError) setNotice(`Chưa đồng bộ trạng thái thu tiền lên Supabase: ${syncError}`);
  }

  async function createManualOrder(event: FormEvent) {
    event.preventDefault();
    if (running || syncing || manualSaving) return;
    const trackingCode = manualDraft.trackingCode.trim().toUpperCase();
    const orderId = (manualDraft.orderId.trim() || trackingOrderId(trackingCode)).toUpperCase().startsWith("#")
      ? (manualDraft.orderId.trim() || trackingOrderId(trackingCode)).toUpperCase()
      : `#${(manualDraft.orderId.trim() || trackingOrderId(trackingCode)).toUpperCase()}`;
    const currency = manualDraft.currency.trim().toUpperCase() || "USD";
    const amount = Number(manualDraft.amount || 0);
    const exchangeRate = Number(manualDraft.exchangeRate || 0);
    if (!/^[A-Z0-9]{7,34}$/.test(trackingCode)) {
      setNotice("Mã vận đơn UPS phải gồm 7-34 ký tự chữ/số.");
      return;
    }
    if (!/^#[A-Z0-9-]{2,31}$/.test(orderId)) {
      setNotice("Mã đơn phải có dạng #SG10291 hoặc #ORDER-001.");
      return;
    }
    if (rows.some((row) => row.code === trackingCode || row.orderId?.toUpperCase() === orderId)) {
      setNotice("Mã đơn hoặc mã vận đơn đã tồn tại trong bảng.");
      return;
    }
    setManualSaving(true);
    setNotice("");
    try {
      const payload = {
        order_id: orderId,
        tracking_code: trackingCode,
        source_order_code: orderId,
        customer_name: manualDraft.customerName.trim() || null,
        phone: manualDraft.phone.trim() || null,
        email: manualDraft.email.trim() || null,
        address: manualDraft.address.trim() || null,
        city: manualDraft.city.trim() || null,
        state: manualDraft.state.trim() || null,
        postal_code: manualDraft.postalCode.trim() || null,
        country: manualDraft.country.trim().toUpperCase() || null,
        sales_person: manualDraft.salesPerson.trim() || null,
        delivery_person: manualDraft.deliveryPerson.trim() || null,
        shipping_unit: "UPS",
        order_date: manualDraft.orderDate || localDateKey(),
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        unit_price: Number.isFinite(amount) && amount > 0 ? amount : null,
        currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
        exchange_rate: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : null,
        total_amount_vnd: Number.isFinite(amount) && amount > 0 && Number.isFinite(exchangeRate) && exchangeRate > 0 ? amount * exchangeRate : null,
        collected: true,
        history: [],
      };
      const { data, error } = await supabase.from("speego").insert(payload).select(SPEEGO_SELECT).single();
      if (error) throw error;
      const nextRow = fromSpeegoRecord(data as SpeegoRecord);
      save([nextRow, ...rows]);
      setManualOpen(false);
      setManualDraft(createManualDraft());
      setNotice(`Đã tạo đơn thủ công ${nextRow.orderId}; trạng thái thu tiền đã bật.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không tạo được đơn thủ công.");
    } finally {
      setManualSaving(false);
    }
  }

  async function addTrackingCodes(scanAfter = false) {
    if (running || syncing || quickAdding) return;
    const parsed = parseTrackingCodes(quickCodes);
    if (!parsed.valid.length) {
      setNotice(parsed.invalid.length ? "Không có mã hợp lệ. Mã UPS phải gồm 7-34 ký tự chữ/số." : "Hãy nhập ít nhất một mã vận đơn UPS.");
      return;
    }

    const knownCodes = new Set(rows.map((row) => row.code));
    const remainingCapacity = Math.max(0, MAX_ORDERS - rows.length);
    const newCodes = parsed.valid.filter((code) => !knownCodes.has(code)).slice(0, remainingCapacity);
    const skippedExisting = parsed.valid.length - parsed.valid.filter((code) => !knownCodes.has(code)).length;
    const skippedCapacity = parsed.valid.filter((code) => !knownCodes.has(code)).length - newCodes.length;
    if (!newCodes.length) {
      setNotice(remainingCapacity === 0 ? `Bảng đã đạt giới hạn ${MAX_ORDERS.toLocaleString("vi-VN")} đơn.` : "Các mã vừa nhập đã có trong bảng.");
      return;
    }

    setQuickAdding(true);
    setNotice("");
    try {
      let inserted = 0;
      const orderDate = localDateKey();
      for (let offset = 0; offset < newCodes.length; offset += DATABASE_WRITE_BATCH_SIZE) {
        const payload = newCodes.slice(offset, offset + DATABASE_WRITE_BATCH_SIZE).map((trackingCode) => ({
          order_id: trackingOrderId(trackingCode),
          tracking_code: trackingCode,
          source_order_code: trackingOrderId(trackingCode),
          shipping_unit: "UPS",
          order_date: orderDate,
          collected: false,
          history: [],
        }));
        const { data, error } = await supabase.from("speego")
          .upsert(payload, { onConflict: "tracking_code", ignoreDuplicates: true })
          .select("tracking_code");
        if (error) throw error;
        inserted += data?.length || 0;
      }

      const freshRows = await fetchSpeegoRows();
      save(freshRows);
      setQuickCodes("");
      const details = [
        skippedExisting ? `${skippedExisting} mã đã tồn tại` : "",
        parsed.invalid.length ? `${parsed.invalid.length} mã không hợp lệ` : "",
        skippedCapacity ? `${skippedCapacity} mã vượt giới hạn bảng` : "",
      ].filter(Boolean);
      const addedNotice = `Đã thêm ${inserted.toLocaleString("vi-VN")} mã vào bảng speego${details.length ? `; bỏ qua ${details.join(", ")}` : ""}.`;
      setNotice(addedNotice);
      if (scanAfter) await scanNow(freshRows, addedNotice);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thêm được mã vào bảng speego.");
    } finally {
      setQuickAdding(false);
    }
  }

  async function trackOne(row: Row) {
    if (running || syncing || activeCodes.includes(row.code)) return;
    setNotice("");
    setActiveCodes((codes) => [...codes, row.code]);
    try {
      const ping = await request("ping");
      setConnection(connectionLabel(ping));
      if (!ping.ok) throw new Error(ping.error || "Chưa kết nối tiện ích UPS.");
      if (ping.version !== UPS_EXTENSION_VERSION) throw new Error(`Hãy tải tiện ích UPS ${UPS_EXTENSION_VERSION}, giải nén thay bản cũ rồi bấm Tải lại trong Chrome/Edge.`);
      const result = await request("track", row.code);
      let changed: Row;
      if (result.ok && result.code === row.code && typeof result.status === "string" && typeof result.checkedAt === "string") {
        const edd = cleanString(result.edd, 10);
        changed = {
          ...row,
          status: result.status,
          rawStatus: result.rawStatus,
          checkedAt: result.checkedAt,
          edd: /^\d{4}-\d{2}-\d{2}$/.test(edd) ? edd : row.edd,
          history: normalizeHistory(result.history),
          error: undefined,
        };
      } else {
        changed = { ...row, error: result.error || "Kết quả không khớp mã yêu cầu." };
      }
      const next = rows.map((item) => item.code === row.code ? changed : item);
      save(next);
      const syncError = changed.id ? await persistRows([changed]) : "";
      if (syncError) setNotice(`Đã cập nhật trên trình duyệt nhưng chưa lưu được Supabase: ${syncError}`);
      else setNotice(`Đã cập nhật tracking ${row.code}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không tra được vận đơn.");
    } finally {
      setActiveCodes((codes) => codes.filter((code) => code !== row.code));
    }
  }

  async function scanNow(sourceRows: Row[] = rows, prefix = "") {
    if (running || syncing) return;
    const waiting = sourceRows.filter((row) => !row.checkedAt).length;
    if (!waiting) {
      setNotice(`${prefix ? `${prefix} ` : ""}Không có vận đơn chưa tra.`);
      return;
    }

    try {
      const { data: machine } = await supabase.from("speego_runner")
        .select("enabled,heartbeat_at").eq("id", true).maybeSingle();
      const machineOnline = Boolean(machine?.heartbeat_at && Date.now() - Date.parse(machine.heartbeat_at) < 60_000);
      if (machineOnline) {
        const { error } = await supabase.from("speego_runner").update({ enabled: true }).eq("id", true);
        if (!error) {
          setRunnerBusy(true);
          setNotice(`${prefix ? `${prefix} ` : ""}Đã bật máy quét tự động. Runner sẽ nhận ${waiting.toLocaleString("vi-VN")} đơn chưa tra trong tối đa khoảng 60 giây.`);
          return;
        }
      }

      const ping = await request("ping");
      setConnection(connectionLabel(ping));
      if (!ping.ok || ping.version !== UPS_EXTENSION_VERSION) {
        setNotice(`${prefix ? `${prefix} ` : ""}Chưa quét: hãy mở Runner máy nhà hoặc cài tiện ích UPS ${UPS_EXTENSION_VERSION} vào trình duyệt này rồi tải lại trang.`);
        return;
      }
      await run(sourceRows);
    } catch (error) {
      setNotice(`${prefix ? `${prefix} ` : ""}${error instanceof Error ? error.message : "Không bật được máy quét."}`);
    }
  }

  async function run(sourceRows: Row[] = rows) {
    if (locked.current || runnerBusy) return;
    locked.current = true;
    setRunning(true);
    setNotice("");
    let next = [...sourceRows];
    let successful = 0;
    let failed = 0;
    let syncFailed = 0;
    try {
      const ping = await request("ping");
      if (!mounted.current) return;
      setConnection(connectionLabel(ping));
      if (!ping.ok) { setNotice(ping.error || "Chưa kết nối tiện ích UPS."); return; }
      if (ping.version !== UPS_EXTENSION_VERSION) {
        setNotice(`Hãy tải tiện ích UPS ${UPS_EXTENSION_VERSION}, giải nén thay bản cũ rồi bấm Tải lại trong Chrome/Edge.`);
        return;
      }
      const candidates = next.filter((row) => !row.checkedAt);
      if (!candidates.length) {
        setNotice("Không có vận đơn chưa tra. Các vận đơn đã có kết quả được giữ nguyên.");
        return;
      }
      setTrackingProgress({ completed: 0, total: candidates.length, batch: 0, batches: 0 });
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(TRACKING_CONCURRENCY, candidates.length) }, async () => {
        while (cursor < candidates.length && mounted.current) {
          const row = candidates[cursor++];
          setActiveCodes((codes) => [...codes, row.code]);
          const result = await request("track", row.code);
          if (!mounted.current) return;
          if (result.ok && result.code === row.code && typeof result.status === "string"
            && typeof result.checkedAt === "string") {
            successful++;
            const edd = cleanString(result.edd, 10);
            next = next.map((item) => item.code === row.code ? { ...item, status: result.status,
              rawStatus: result.rawStatus, checkedAt: result.checkedAt,
              edd: /^\d{4}-\d{2}-\d{2}$/.test(edd) ? edd : item.edd,
              history: normalizeHistory(result.history), error: undefined } : item);
          } else {
            failed++;
            next = next.map((item) => item.code === row.code ? { ...item, error: result.error || "Kết quả không khớp mã yêu cầu." } : item);
          }
          save(next);
          const changed = next.find((item) => item.code === row.code);
          if (changed && await persistRows([changed])) syncFailed++;
          setActiveCodes((codes) => codes.filter((code) => code !== row.code));
          setTrackingProgress((progress) => ({ ...progress, completed: progress.completed + 1 }));
        }
      }));
      setDatabase(syncFailed ? `Có ${syncFailed} đơn chưa đồng bộ Supabase` : "Đồng bộ Supabase · bảng speego");
      setNotice(`Đã tra ${candidates.length} vận đơn với tối đa ${TRACKING_CONCURRENCY} tab liên tục: ${successful} thành công, ${failed} lỗi.${syncFailed ? ` ${syncFailed} kết quả chưa lưu được lên Supabase.` : " Kết quả đã lưu vào bảng speego."}`);
    } finally {
      locked.current = false;
      if (mounted.current) {
        setRunning(false);
        setActiveCodes([]);
        setTrackingProgress({ completed: 0, total: 0, batch: 0, batches: 0 });
      }
    }
  }

  function exportCsv() {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const historyRows = rows.flatMap((row) => (row.history?.length ? row.history : [{
      status: row.status || "", rawStatus: row.rawStatus || "",
    }]).map((event) => [row.sourceOrderCode || row.orderId, row.code, row.customerName, row.phone,
      row.email, row.address, row.city, row.state, row.postalCode, row.country, row.marketingStaff,
      row.salesPerson, row.customerServiceStaff, row.deliveryPerson, row.shippingUnit, row.createdAt,
      row.unitPrice, row.currency, row.exchangeRate, row.totalAmountVnd, row.edd,
      row.collected ? "Đã thu tiền" : "Chưa thu", event.status, event.rawStatus,
      event.date, event.time, event.location, event.details, row.checkedAt, row.error]));
    const csv = [["Mã đơn", "Mã UPS", "Khách hàng", "SĐT", "Email", "Địa chỉ", "Thành phố",
      "Bang/Tỉnh", "Mã bưu chính", "Quốc gia", "NV marketing", "NV sale", "CSKH", "NV vận đơn",
      "Đơn vị vận chuyển", "Ngày tạo", "Số tiền", "Tiền tệ", "Tỷ giá", "Tổng tiền VND", "EDD",
      "Thu tiền", "Trạng thái sự kiện", "Trạng thái gốc", "Ngày UPS", "Giờ UPS", "Địa điểm",
      "Chi tiết", "Lần tra thành công", "Lỗi lần tra mới nhất"], ...historyRows]
      .map((line) => line.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "speego-orders-ups.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toggleAll() {
    const visibleCodes = filteredRows.map((row) => row.code);
    setSelected(allSelected ? selected.filter((code) => !visibleCodes.includes(code))
      : [...new Set([...selected, ...visibleCodes])]);
  }

  async function removeSelected() {
    if (!selected.length || !window.confirm(`Xóa ${selected.length} đơn đã chọn khỏi bảng?`)) return;
    save(rows.filter((row) => !selected.includes(row.code)));
    const error = await deleteRows(selected);
    if (error) setNotice(`Đã xóa trên trình duyệt nhưng chưa xóa được ở Supabase: ${error}`);
    setSelected([]);
  }

  return <section className="ups-tracking ups-orders-page">
    <UpsRunner onBusy={setRunnerBusy} manualRunning={running} />
    <div className="ups-order-tools">
      <div className="ups-order-tools-main">
        <div className="ups-connection-state"><i className={connection.startsWith("Đã kết nối") && database.startsWith("Đồng bộ") ? "connected" : ""} /><div><strong>{connection}</strong><small>{database} · Hàng đợi liên tục, tối đa 6 tab khi tra tại đây</small></div></div>
        <div className="ups-order-tool-actions">
          <button className="secondary-button" disabled={running || syncing} onClick={async () => {
            const result = await request("ping");
            setConnection(connectionLabel(result));
          }}>Kiểm tra kết nối</button>
          <button className="secondary-button" disabled={!rows.length} onClick={exportCsv}>Xuất CSV</button>
          <button className="primary-button" disabled={running || syncing || runnerBusy || !pendingCount} onClick={() => void scanNow()}>{running ? `Đang quét ${trackingProgress.completed}/${trackingProgress.total}` : runnerBusy ? "Máy đang quét" : `Quét ngay ${pendingCount} đơn`}</button>
          <button className="primary-button" disabled={running || syncing} onClick={() => void syncOrders()}>{syncing ? "Đang đồng bộ…" : "Đồng bộ đơn tháng 9"}</button>
        </div>
      </div>

      <p className="ups-order-note">Nút đồng bộ chỉ đọc bảng <strong>orders</strong>, chỉ lấy đơn tháng 9 có mã vận đơn bắt đầu bằng <strong>1Z</strong>, rồi tự thêm hoặc cập nhật bảng <strong>speego</strong>.</p>
      <div role="status" aria-live="polite">{activeCodes.length > 0 && <p>Đang xử lý {activeCodes.length} tab UPS; đã xong {trackingProgress.completed}/{trackingProgress.total} vận đơn…</p>}{notice && <p>{notice}</p>}</div>
    </div>

        {/* SPEEGO OS ORDERS SECTION */}
    <div className="speego-orders-panel">
      {/* Top Header Row with Actions */}
      <div className="speego-orders-header">
        <div className="speego-orders-heading">
          <h2>Đơn hàng</h2>
          <p>Tất cả đơn OMS trên các tài khoản nhân viên.</p>
        </div>
        <div className="speego-orders-actions">
          <button type="button" className="speego-subtle-btn" disabled={running || syncing || runnerBusy || !pendingCount} onClick={() => void scanNow()}>
            <ScanLine size={15} />
            <span>Quét ngay</span>
          </button>
          <button type="button" className="speego-subtle-btn" onClick={exportCsv}>
            <Upload size={15} />
            <span>Xuất</span>
          </button>
          <button type="button" className="speego-subtle-btn" onClick={() => void syncOrders()}>
            <Download size={15} />
            <span>Nhập</span>
          </button>
          <button type="button" className="speego-create-btn" onClick={() => setManualOpen(true)}>
            <Plus size={16} />
            <span>Tạo đơn</span>
          </button>
          <button
            type="button"
            className="speego-icon-btn"
            title="Làm mới dữ liệu"
            onClick={async () => {
              const fresh = await fetchSpeegoRows();
              save(fresh);
              setNotice("Đã làm mới dữ liệu đơn hàng từ Supabase.");
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="speego-quick-add" aria-label="Thêm nhanh mã vận đơn UPS">
        <div>
          <strong>Thêm mã UPS vào bảng</strong>
          <span>Dán một hoặc nhiều mã, ngăn cách bằng dòng mới, dấu phẩy hoặc khoảng trắng.</span>
        </div>
        <textarea
          value={quickCodes}
          onChange={(event) => setQuickCodes(event.target.value.toUpperCase())}
          placeholder={"1Z...\n1Z..."}
          rows={2}
          disabled={quickAdding || running || syncing}
          aria-label="Danh sách mã vận đơn UPS"
        />
        <div className="speego-quick-add-actions">
          <button type="button" className="speego-subtle-btn" disabled={quickAdding || running || syncing || !quickCodes.trim()} onClick={() => void addTrackingCodes()}>
            <Plus size={16} /><span>{quickAdding ? "Đang thêm" : "Chỉ thêm mã"}</span>
          </button>
          <button type="button" className="speego-create-btn" disabled={quickAdding || running || syncing || !quickCodes.trim()} onClick={() => void addTrackingCodes(true)}>
            <ScanLine size={16} /><span>{quickAdding ? "Đang xử lý" : "Thêm & quét ngay"}</span>
          </button>
        </div>
      </div>

      {/* Filter Pills Row */}
      <div className="speego-filter-pills-row" role="tablist" aria-label="Lọc trạng thái đơn hàng">
        {speegoTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`speego-filter-pill ${statusFilter === tab.key ? "active" : ""}`}
            onClick={() => setStatusFilter(tab.key)}
          >
            <span>{tab.label}</span>
            <b className="speego-pill-badge">{tab.count}</b>
          </button>
        ))}
      </div>

      {/* Filter Bar with Search, Dropdowns & Tools */}
      <div className="speego-filter-bar">
        <div className="speego-search-box">
          <Search size={15} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo đơn, nhân viên,..."
          />
        </div>

        <div className="speego-dropdown-filters">
          <select
            value={periodFilter}
            onChange={(event) => {
              setPeriodFilter(event.target.value as SpeegoPeriod);
              setDayFilter("");
              setMonthFilter("");
            }}
            aria-label="Lọc khoảng thời gian"
          >
            <option value="all">Mọi thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="this_month">Tháng này</option>
            <option value="last_month">Tháng trước</option>
          </select>

          <label className="speego-date-filter">
            <span>Ngày</span>
            <input
              type="date"
              value={dayFilter}
              onChange={(event) => {
                setDayFilter(event.target.value);
                setMonthFilter("");
                setPeriodFilter("all");
              }}
              aria-label="Lọc theo ngày tạo đơn"
            />
          </label>

          <label className="speego-date-filter">
            <span>Tháng</span>
            <input
              type="month"
              value={monthFilter}
              onChange={(event) => {
                setMonthFilter(event.target.value);
                setDayFilter("");
                setPeriodFilter("all");
              }}
              aria-label="Lọc theo tháng tạo đơn"
            />
          </label>

          <select
            value={eddFilter}
            onChange={(e) => setEddFilter(e.target.value)}
            aria-label="Lọc EDD"
          >
            <option value="all">EDD</option>
            <option value="has_edd">Có ngày giao</option>
            <option value="no_edd">Chưa có ngày</option>
          </select>

          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            aria-label="Lọc nhân viên"
          >
            <option value="all">Tất cả nhân viên</option>
            {staffList.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            aria-label="Lọc nhóm"
          >
            <option value="all">Tất cả nhóm</option>
            <option value="team1">Team HN</option>
            <option value="team2">Team HCM</option>
          </select>

          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            aria-label="Lọc hãng vận đơn"
          >
            <option value="all">Tất cả vận đơn</option>
            <option value="UPS">UPS</option>
            <option value="GHN">GHN</option>
            <option value="J&T">J&T</option>
          </select>

          <button
            type="button"
            className={`speego-tool-icon-btn ${showCarrierOnly ? "active" : ""}`}
            title="Ẩn / Hiện mã hãng vận đơn"
            onClick={() => setShowCarrierOnly((prev) => !prev)}
          >
            <Eye size={15} />
          </button>

          {(search || statusFilter !== "all" || periodFilter !== "all" || dayFilter || monthFilter || eddFilter !== "all" || staffFilter !== "all" || groupFilter !== "all" || carrierFilter !== "all") && (
            <button
              type="button"
              className="speego-clear-filter"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPeriodFilter("all");
                setDayFilter("");
                setMonthFilter("");
                setEddFilter("all");
                setStaffFilter("all");
                setGroupFilter("all");
                setCarrierFilter("all");
              }}
            >
              Xóa lọc · {filteredRows.length.toLocaleString("vi-VN")} đơn
            </button>
          )}

          <button
            type="button"
            className="speego-tool-icon-btn"
            title="Chế độ hiển thị dạng bảng"
            onClick={() => {}}
          >
            <Grid size={15} />
          </button>
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="speego-orders-table-card">
        <div className="speego-orders-table-wrap">
          <table className="speego-orders-table">
            <thead>
              <tr>
                <th className="select-cell">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả đơn"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th>ĐƠN</th>
                <th>SỰ KIỆN SHIPMENT</th>
                <th>NHÂN VIÊN</th>
                <th>KHÁCH HÀNG</th>
                <th>SẢN PHẨM</th>
                <th>SỐ LƯỢNG</th>
                <th>GHI CHÚ</th>
                <th>NGÀY</th>
                <th>SỐ TIỀN</th>
                <th>PHÍ FULFILLMENT</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const shortCode = shortOrderCode(row);
                const orderDateFormatted = formatSpeegoDate(row.createdAt);
                const amountUsd = formatSpeegoMoney(row.unitPrice ?? row.amount, row.currency);
                const quantity = row.amount ? Math.max(1, Math.round(Number(row.amount) / 25)) : 8;

                return (
                  <tr key={row.code} className={selected.includes(row.code) ? "selected" : ""}>
                    <td className="select-cell">
                      <input
                        type="checkbox"
                        aria-label={`Chọn đơn ${row.orderId}`}
                        checked={selected.includes(row.code)}
                        onChange={() =>
                          setSelected((currentIds) =>
                            currentIds.includes(row.code)
                              ? currentIds.filter((code) => code !== row.code)
                              : [...currentIds, row.code]
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="speego-order-code-badge"
                        title={`Xem chi tiết đơn ${row.orderId || row.code}`}
                        onClick={() => {
                          setDetailCode(row.code);
                          setDetailTab("timeline");
                        }}
                      >
                        {shortCode}
                      </button>
                    </td>
                    <td>
                      <OrderStepperV2 row={row} />
                    </td>
                    <td className="speego-staff-cell">
                      <StaffIdentity value={row.salesPerson} />
                    </td>
                    <td className="speego-customer-cell">
                      <strong>{row.customerName || "Khách hàng"}</strong>
                      <small>{row.phone || "808-304-7633"}</small>
                    </td>
                    <td className="speego-product-cell">
                      <span>Dán Kinoki</span>
                    </td>
                    <td className="speego-qty-cell">
                      <span>{quantity}</span>
                    </td>
                    <td className="speego-notes-cell">
                      <span className="speego-dash">—</span>
                    </td>
                    <td className="speego-date-cell">
                      <span>{orderDateFormatted}</span>
                    </td>
                    <td className="speego-amount-cell">
                      <strong>{amountUsd}</strong>
                    </td>
                    <td className="speego-fulfillment-fee-cell">
                      <div className="speego-fee-wrap">
                        <span>0,00 US$</span>
                        <button
                          type="button"
                          className={`speego-payment-badge ${row.collected ? "paid" : "unpaid"}`}
                          disabled={running || syncing}
                          onClick={() => toggleCollected(row.code)}
                          title="Bấm để đổi trạng thái thu tiền"
                        >
                          ● {row.collected ? "Đã thanh toán" : "Chưa thanh toán"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={11} className="ups-orders-empty">
                    Không tìm thấy đơn hàng phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {selectedDetail && <TrackingModal row={selectedDetail} activeTab={detailTab} running={running || syncing || activeCodes.includes(selectedDetail.code)} onTabChange={setDetailTab} onClose={() => setDetailCode("")} onToggleCollected={() => void toggleCollected(selectedDetail.code)} onTrack={() => void trackOne(selectedDetail)} />}
    {manualOpen && <ManualOrderModal draft={manualDraft} saving={manualSaving} onChange={(patch) => setManualDraft((current) => ({ ...current, ...patch }))} onClose={() => setManualOpen(false)} onSubmit={createManualOrder} />}
  </section>;
}

function TrackingModal({
  row,
  activeTab,
  running,
  onTabChange,
  onClose,
  onToggleCollected,
  onTrack,
}: {
  row: Row;
  activeTab: TrackingDetailTab;
  running: boolean;
  onTabChange: (tab: TrackingDetailTab) => void;
  onClose: () => void;
  onToggleCollected: () => void;
  onTrack: () => void;
}) {
  const state = orderState(row);
  const history = row.history || [];
  const steps = [
    { step: 1, label: "Đã lấy hàng", active: shipmentStep(row) >= 3 },
    { step: 2, label: "Đang giao", active: shipmentStep(row) >= 4 },
    { step: 3, label: "Đã giao", active: shipmentStep(row) >= 5 },
  ];
  return (
    <div className="modal-backdrop tracking-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="tracking-modal-card" role="dialog" aria-modal="true" aria-labelledby="tracking-modal-title">
        <header className="tracking-modal-header">
          <div>
            <span><Truck size={18} /></span>
            <div><h2 id="tracking-modal-title">Theo dõi vận đơn</h2><p>Mở trạng thái cuối cùng và chuyển đến tab mới.</p></div>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>

        <div className="tracking-modal-tabs" role="tablist" aria-label="Chi tiết vận đơn">
          <button type="button" className={activeTab === "timeline" ? "active" : ""} onClick={() => onTabChange("timeline")}><b>1</b><span>Lịch trình</span></button>
          <button type="button" className={activeTab === "time" ? "active" : ""} onClick={() => onTabChange("time")}><b>2</b><span>Thời gian</span></button>
          <button type="button" className={activeTab === "status" ? "active" : ""} onClick={() => onTabChange("status")}><b>3</b><span>Trạng thái</span></button>
        </div>

        <div className="tracking-modal-body">
          <main className="tracking-main-pane">
            {activeTab === "timeline" && (
              <div className="tracking-timeline">
                {history.length ? history.map((event, index) => (
                  <article key={`${event.rawStatus}-${event.date || ""}-${event.time || ""}-${index}`}>
                    <i />
                    <div>
                      <p><time>{[event.time, event.date].filter(Boolean).join(" · ") || "UPS chưa hiển thị giờ"}</time><span className={`order-status ${index === 0 ? state.className : "shipping"}`}>{index === 0 ? state.label : event.status}</span></p>
                      <strong>{event.rawStatus || event.status}</strong>
                      {event.location && <span>{event.location}</span>}
                      {event.details && <small>{event.details}</small>}
                    </div>
                  </article>
                )) : (
                  <div className="tracking-empty">
                    <PackageCheck size={36} />
                    <strong>Chưa có lịch sử UPS</strong>
                    <span>Bấm cập nhật tracking để lấy timeline từ tiện ích UPS hiện tại.</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "time" && (
              <div className="tracking-time-grid">
                <article><span>Ngày tạo đơn</span><strong>{formatOrderDate(row.createdAt)}</strong></article>
                <article><span>EDD dự kiến</span><strong>{row.edd ? formatOrderDate(row.edd) : "Chưa có"}</strong></article>
                <article><span>Lần tra thành công</span><strong>{row.checkedAt && Number.isFinite(Date.parse(row.checkedAt)) ? new Date(row.checkedAt).toLocaleString("vi-VN") : "Chưa tra"}</strong></article>
                <article><span>Số sự kiện UPS</span><strong>{history.length.toLocaleString("vi-VN")}</strong></article>
              </div>
            )}

            {activeTab === "status" && (
              <div className="tracking-status-grid">
                <article><span>Khách hàng</span><strong>{row.customerName || "Chưa có tên khách"}</strong><small>{[row.phone, row.email].filter(Boolean).join(" · ") || "Chưa có liên hệ"}</small></article>
                <article><span>Địa chỉ</span><strong>{[row.address, row.city, row.state, row.postalCode, row.country].filter(Boolean).join(", ") || "Chưa có"}</strong></article>
                <article><span>Nhân viên</span><strong>{[row.salesPerson && `Sale: ${row.salesPerson}`, row.deliveryPerson && `Vận đơn: ${row.deliveryPerson}`].filter(Boolean).join(" · ") || "Chưa phân công"}</strong></article>
                <article><span>Giá trị đơn</span><strong>{formatMoney(row.unitPrice ?? row.amount, row.currency)}</strong><small>{row.totalAmountVnd != null ? formatMoney(row.totalAmountVnd, "VND") : "Chưa quy đổi VND"}</small></article>
                <article><span>Thu tiền</span><button className={`collection-toggle${row.collected ? " is-collected" : ""}`} disabled={running} onClick={onToggleCollected}>{row.collected ? "Đã thu tiền" : "Chưa thu"}</button></article>
                <article><span>Lỗi gần nhất</span><strong>{row.error || "Không có"}</strong></article>
              </div>
            )}
          </main>

          <aside className="tracking-side-pane">
            <div className="tracking-code-card">
              <span>Thông tin vận đơn</span>
              <strong>Mã vận đơn</strong>
              <div>
                <b>UPS</b>
                <code>{row.code}</code>
                <button type="button" aria-label="Sao chép mã vận đơn" onClick={() => void navigator.clipboard?.writeText(row.code)}><Copy size={15} /></button>
              </div>
            </div>
            <div className="tracking-state-card">
              <span>Trạng thái vận đơn</span>
              <strong><i className={state.className} /> {state.label}</strong>
            </div>
            <div className="tracking-step-card">
              <span>Các mốc</span>
              {steps.map((item) => <p key={item.step} className={item.active ? "active" : ""}><b>{item.step}</b>{item.label}</p>)}
            </div>
            <a className="secondary-button tracking-open-link" href={`https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(row.code)}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Mở trang hàng</a>
          </aside>
        </div>

        <footer className="tracking-modal-footer">
          <button className="secondary-button" type="button" onClick={onClose}>Hủy</button>
          <button className="primary-button" type="button" disabled={running} onClick={onTrack}><Clock3 size={16} /> {running ? "Đang cập nhật" : "Cập nhật tracking"}</button>
        </footer>
      </section>
    </div>
  );
}

function ManualOrderModal({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ManualDraft;
  saving: boolean;
  onChange: (patch: Partial<ManualDraft>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card manual-order-modal" role="dialog" aria-modal="true" aria-labelledby="manual-order-title">
        <div className="modal-heading">
          <div><p className="eyebrow">ĐƠN HÀNG UPS</p><h2 id="manual-order-title">Tạo đơn thủ công</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-grid ups-manual-grid">
            <label className="field"><span>Mã đơn</span><input value={draft.orderId} onChange={(event) => onChange({ orderId: event.target.value })} placeholder="#SG10291" /></label>
            <label className="field"><span>Mã vận đơn UPS *</span><input value={draft.trackingCode} onChange={(event) => onChange({ trackingCode: event.target.value.toUpperCase() })} placeholder="1Z..." required /></label>
            <label className="field"><span>Khách hàng</span><input value={draft.customerName} onChange={(event) => onChange({ customerName: event.target.value })} placeholder="Tên người nhận" /></label>
            <label className="field"><span>Số điện thoại</span><input value={draft.phone} onChange={(event) => onChange({ phone: event.target.value })} placeholder="+1..." /></label>
            <label className="field"><span>Email</span><input type="email" value={draft.email} onChange={(event) => onChange({ email: event.target.value })} placeholder="customer@email.com" /></label>
            <label className="field"><span>Ngày tạo</span><input type="date" value={draft.orderDate} onChange={(event) => onChange({ orderDate: event.target.value })} required /></label>
            <label className="field span-2"><span>Địa chỉ</span><input value={draft.address} onChange={(event) => onChange({ address: event.target.value })} placeholder="Street, apartment..." /></label>
            <label className="field"><span>City</span><input value={draft.city} onChange={(event) => onChange({ city: event.target.value })} /></label>
            <label className="field"><span>State</span><input value={draft.state} onChange={(event) => onChange({ state: event.target.value })} /></label>
            <label className="field"><span>Postal code</span><input value={draft.postalCode} onChange={(event) => onChange({ postalCode: event.target.value })} /></label>
            <label className="field"><span>Country</span><input value={draft.country} onChange={(event) => onChange({ country: event.target.value.toUpperCase() })} /></label>
            <label className="field"><span>Nhân viên sale</span><input value={draft.salesPerson} onChange={(event) => onChange({ salesPerson: event.target.value })} /></label>
            <label className="field"><span>Nhân viên vận đơn</span><input value={draft.deliveryPerson} onChange={(event) => onChange({ deliveryPerson: event.target.value })} /></label>
            <label className="field"><span>Số tiền</span><input inputMode="decimal" value={draft.amount} onChange={(event) => onChange({ amount: event.target.value })} placeholder="0" /></label>
            <label className="field"><span>Tiền tệ</span><input value={draft.currency} onChange={(event) => onChange({ currency: event.target.value.toUpperCase().slice(0, 3) })} placeholder="USD" /></label>
            <label className="field span-2"><span>Tỷ giá VND</span><input inputMode="decimal" value={draft.exchangeRate} onChange={(event) => onChange({ exchangeRate: event.target.value })} placeholder="0" /></label>
          </div>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Hủy</button>
            <button className="primary-button" type="submit" disabled={saving}><Plus size={16} /> {saving ? "Đang tạo" : "Tạo đơn đã thanh toán"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
