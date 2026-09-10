"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, House, MoreVertical, Package, Search, Truck } from "lucide-react";
import { UpsRunner } from "@/components/UpsRunner";
import { supabase } from "@/lib/supabase";

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

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function defaultOrderId(code: string) {
  return `#${code.slice(-4).toUpperCase()}`;
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
    orderId: cleanString(record.orderId, 32) || defaultOrderId(code),
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
  const [expanded, setExpanded] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const mounted = useRef(true);
  const locked = useRef(false);
  const storageKey = `hahoa-ups-v1:${userId}`;

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

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return rows.filter((row) => {
      if (query && ![row.orderId, row.sourceOrderCode, row.code, row.customerName, row.phone,
        row.email, row.address, row.salesPerson, row.deliveryPerson]
        .some((value) => value?.toLocaleLowerCase("vi").includes(query))) return false;
      if (statusFilter === "collected") return row.collected;
      if (statusFilter !== "all" && orderState(row).className !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.includes(row.code));
  const pendingCount = rows.filter((row) => !row.checkedAt).length;

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

  async function run() {
    if (locked.current || runnerBusy) return;
    locked.current = true;
    setRunning(true);
    setNotice("");
    let next = [...rows];
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
          <a className="secondary-button" href={`/ups-tracking-extension.zip?v=${UPS_EXTENSION_VERSION}`} download>Tải tiện ích</a>
          <button className="secondary-button" disabled={running || syncing} onClick={async () => {
            const result = await request("ping");
            setConnection(connectionLabel(result));
          }}>Kiểm tra kết nối</button>
          <button className="secondary-button" disabled={!rows.length} onClick={exportCsv}>Xuất CSV</button>
          <button className="secondary-button" disabled={running || syncing || runnerBusy || !pendingCount} onClick={() => void run()}>{running ? `Đang tra ${trackingProgress.completed}/${trackingProgress.total}` : `Tra ${pendingCount} đơn chưa tra`}</button>
          <button className="primary-button" disabled={running || syncing} onClick={() => void syncOrders()}>{syncing ? "Đang đồng bộ…" : "Đồng bộ đơn tháng 9"}</button>
        </div>
      </div>

      <p className="ups-order-note">Nút đồng bộ chỉ đọc bảng <strong>orders</strong>, chỉ lấy đơn tháng 9 có mã vận đơn bắt đầu bằng <strong>1Z</strong>, rồi tự thêm hoặc cập nhật bảng <strong>speego</strong>.</p>
      <div role="status" aria-live="polite">{activeCodes.length > 0 && <p>Đang xử lý {activeCodes.length} tab UPS; đã xong {trackingProgress.completed}/{trackingProgress.total} vận đơn…</p>}{notice && <p>{notice}</p>}</div>
    </div>

    <div className="ups-order-filter">
      <div className="ups-order-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã đơn, khách hàng, vận đơn..." /></div>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái đơn">
        <option value="all">Tất cả trạng thái</option>
        <option value="new">Mới</option>
        <option value="received">Đã nhận tin</option>
        <option value="sent">Đã gửi</option>
        <option value="shipping">Đang giao</option>
        <option value="delivered">Đã giao</option>
        <option value="collected">Đã thu tiền</option>
      </select>
      {(search || statusFilter !== "all") && <button className="text-button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Đặt lại bộ lọc</button>}
      <span>{filteredRows.length.toLocaleString("vi-VN")} kết quả</span>
      {selected.length > 0 && <button className="text-button danger-text" disabled={running || syncing} onClick={removeSelected}>Xóa {selected.length} đơn đã chọn</button>}
    </div>

    <div className="ups-orders-table-card">
      <div className="ups-orders-table-wrap">
        <table className="ups-orders-table">
          <caption>{rows.length.toLocaleString("vi-VN")} tổng đơn · {rows.filter((row) => row.collected).length} đã thu tiền · {rows.filter((row) => row.error).length} mã lỗi</caption>
          <thead><tr>
            <th className="select-cell"><input type="checkbox" aria-label="Chọn tất cả đơn đang hiển thị" checked={allSelected} onChange={toggleAll} /></th>
            <th>Mã đơn</th><th>Sự kiện Shipment</th><th>Khách hàng</th><th>Nhân viên</th><th>Ngày tạo</th><th className="number-cell">Số tiền</th><th>Trạng thái đơn</th><th>Hãng / Vận đơn</th><th>EDD dự kiến</th><th aria-label="Thao tác" />
          </tr></thead>
          <tbody>{filteredRows.map((row) => {
            const state = orderState(row);
            const isExpanded = expanded === row.code;
            return <Fragment key={row.code}>
              <tr className={selected.includes(row.code) ? "selected" : ""}>
                <td className="select-cell"><input type="checkbox" aria-label={`Chọn đơn ${row.orderId}`} checked={selected.includes(row.code)} onChange={() => setSelected((currentIds) => currentIds.includes(row.code) ? currentIds.filter((code) => code !== row.code) : [...currentIds, row.code])} /></td>
                <td><button className="order-id-button" onClick={() => setExpanded(isExpanded ? "" : row.code)}>{row.sourceOrderCode || row.orderId || defaultOrderId(row.code)}</button></td>
                <td><OrderStepper step={shipmentStep(row)} /></td>
                <td><div className="order-customer"><strong>{row.customerName || "Chưa có tên khách"}</strong>{row.phone && <small>{row.phone}</small>}{row.email && <small>{row.email}</small>}</div></td>
                <td><div className="order-customer"><strong>{row.salesPerson || "Chưa có NV sale"}</strong>{row.deliveryPerson && <small>Vận đơn: {row.deliveryPerson}</small>}</div></td>
                <td className="order-date">{formatOrderDate(row.createdAt)}</td>
                <td className="number-cell order-amount"><strong>{formatMoney(row.unitPrice ?? row.amount, row.currency)}</strong>{row.totalAmountVnd != null && <small>{formatMoney(row.totalAmountVnd, "VND")}</small>}{row.collected && <button disabled={running || syncing} onClick={() => toggleCollected(row.code)}>● Đã thu tiền</button>}</td>
                <td><span className={`order-status ${state.className}`}>● {activeCodes.includes(row.code) ? "Đang tra" : state.label}</span></td>
                <td><div className="order-carrier"><b>UPS</b><a href={`https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(row.code)}`} target="_blank" rel="noreferrer">{row.code}</a></div></td>
                <td className="order-date">{row.edd ? formatOrderDate(row.edd) : "Chưa có"}</td>
                <td><button className="order-more" aria-label={`Xem chi tiết đơn ${row.orderId}`} onClick={() => setExpanded(isExpanded ? "" : row.code)}><MoreVertical size={17} /></button></td>
              </tr>
              {isExpanded && <tr className="ups-order-detail-row"><td colSpan={11}>
                <div className="ups-order-expanded">
                  <div className="ups-order-detail-meta">
                    <div><span>Địa chỉ khách hàng</span><strong>{[row.address, row.city, row.state, row.postalCode, row.country].filter(Boolean).join(", ") || "—"}</strong></div>
                    <div><span>Liên hệ</span><strong>{[row.phone, row.email].filter(Boolean).join(" · ") || "—"}</strong></div>
                    <div><span>Nhân viên</span><strong>{[row.marketingStaff && `Marketing: ${row.marketingStaff}`, row.salesPerson && `Sale: ${row.salesPerson}`, row.customerServiceStaff && `CSKH: ${row.customerServiceStaff}`, row.deliveryPerson && `Vận đơn: ${row.deliveryPerson}`].filter(Boolean).join(" · ") || "—"}</strong></div>
                    <div><span>Giá / tiền tệ</span><strong>{formatMoney(row.unitPrice ?? row.amount, row.currency)}{row.exchangeRate != null ? ` · Tỷ giá ${row.exchangeRate.toLocaleString("vi-VN")}` : ""}</strong></div>
                    <div><span>Tổng tiền quy đổi</span><strong>{formatMoney(row.totalAmountVnd, "VND")}</strong></div>
                    <div><span>Đơn vị vận chuyển</span><strong>{row.shippingUnit || "—"}</strong></div>
                    <div><span>Trạng thái thu tiền</span><button className={`collection-toggle${row.collected ? " is-collected" : ""}`} disabled={running || syncing} onClick={() => toggleCollected(row.code)}>{row.collected ? "Đã thu tiền" : "Chưa thu"}</button></div>
                    <div><span>Lần tra thành công</span><strong>{row.checkedAt && Number.isFinite(Date.parse(row.checkedAt)) ? new Date(row.checkedAt).toLocaleString("vi-VN") : "—"}</strong></div>
                    <div><span>Lần tra mới nhất</span><strong>{row.error || (row.status ? "Thành công" : "Chưa tra")}</strong></div>
                  </div>
                  {row.history?.length ? <details className="ups-history" open>
                    <summary>{row.history.length} sự kiện UPS chi tiết</summary>
                    <ol>{row.history.map((event, index) => <li key={`${event.rawStatus}-${event.date || ""}-${event.time || ""}-${index}`}>
                      <i /><div><strong>{event.status}</strong>{event.rawStatus !== event.status && <span>{event.rawStatus}</span>}
                        <time>{[event.date, event.time].filter(Boolean).join(" · ") || "UPS không hiển thị ngày giờ"}</time>
                        {event.location && <span>{event.location}</span>}{event.details && <small>{event.details}</small>}
                      </div>
                    </li>)}</ol>
                  </details> : <p className="muted">Chưa có lịch sử UPS. Bấm “Cập nhật tracking” để tra vận đơn này.</p>}
                </div>
              </td></tr>}
            </Fragment>;
          })}{!filteredRows.length && <tr><td colSpan={11} className="ups-orders-empty">Không tìm thấy đơn hàng phù hợp.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  </section>;
}
