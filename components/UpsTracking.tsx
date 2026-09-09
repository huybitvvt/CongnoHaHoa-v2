"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, House, MoreVertical, Package, Search, Truck, X } from "lucide-react";

type TrackingEvent = {
  status: string;
  rawStatus: string;
  date?: string;
  time?: string;
  location?: string;
  details?: string;
};

type Row = {
  code: string;
  orderId?: string;
  customerName?: string;
  phone?: string;
  createdAt?: string;
  amount?: number;
  edd?: string;
  collected?: boolean;
  status?: string;
  rawStatus?: string;
  checkedAt?: string;
  error?: string;
  history?: TrackingEvent[];
};

type OrderDraft = {
  orderId: string;
  code: string;
  customerName: string;
  phone: string;
  createdAt: string;
  amount: string;
  edd: string;
  collected: boolean;
};

type Response = Partial<Row> & { ok: boolean; fatal?: boolean; version?: string };
type ShipmentStep = 1 | 2 | 3 | 4 | 5;

const UPS_EXTENSION_VERSION = "0.3.0";
const usd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "USD" });

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function emptyDraft(): OrderDraft {
  return { orderId: "", code: "", customerName: "", phone: "", createdAt: today(), amount: "", edd: "", collected: false };
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function defaultOrderId(code: string) {
  return `#${code.slice(-4).toUpperCase()}`;
}

function normalizeOrderId(value: string) {
  const id = value.trim().toUpperCase().replace(/\s+/g, "");
  return id.startsWith("#") ? id : `#${id}`;
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
    code,
    orderId: cleanString(record.orderId, 32) || defaultOrderId(code),
    customerName: cleanString(record.customerName, 120) || undefined,
    phone: cleanString(record.phone, 40) || undefined,
    createdAt: cleanString(record.createdAt, 24) || undefined,
    amount: Number.isFinite(amount) && amount >= 0 ? amount : undefined,
    edd: cleanString(record.edd, 24) || undefined,
    collected: record.collected === true,
    status: cleanString(record.status, 120) || undefined,
    rawStatus: cleanString(record.rawStatus, 160) || undefined,
    checkedAt: cleanString(record.checkedAt, 50) || undefined,
    error: cleanString(record.error, 500) || undefined,
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
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("Chưa kiểm tra kết nối");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft);
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
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(saved)) setRows(saved.map(normalizeSavedRow).filter((row): row is Row => Boolean(row)).slice(0, 500));
      } catch { setNotice("Không đọc được bảng đã lưu trên trình duyệt."); }
      void request("ping").then((response) => {
        if (mounted.current) setConnection(connectionLabel(response));
      });
    }, 0);
    return () => { mounted.current = false; window.clearTimeout(timer); };
  }, [storageKey]);

  useEffect(() => {
    const openCreate = () => { setDraft(emptyDraft()); setCreateOpen(true); };
    window.addEventListener("hahoa-ups-add-new", openCreate);
    return () => window.removeEventListener("hahoa-ups-add-new", openCreate);
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return rows.filter((row) => {
      if (query && ![row.orderId, row.code, row.customerName, row.phone]
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
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setNotice("Không lưu được vào trình duyệt. Hãy xuất CSV để giữ kết quả."); }
  }

  function inputCodes() {
    const codes = [...new Set(input.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
    const invalid = codes.filter((code) => !/^[A-Z0-9]{7,34}$/.test(code));
    if (invalid.length) {
      setNotice(`Mã không hợp lệ: ${invalid.slice(0, 5).join(", ")}. Chỉ dán cột mã UPS, mỗi mã một dòng.`);
      return null;
    }
    return codes;
  }

  function addCodes(markCollected = false) {
    const codes = inputCodes();
    if (!codes) return;
    const selectedCodes = new Set(codes);
    const existing = new Set(rows.map((row) => row.code));
    const added = codes.filter((code) => !existing.has(code)).map((code) => ({
      code,
      orderId: defaultOrderId(code),
      createdAt: today(),
      collected: markCollected,
    }));
    if (rows.length + added.length > 500) { setNotice("Mỗi bảng tối đa 500 đơn."); return; }
    save([...rows.map((row) => markCollected && selectedCodes.has(row.code) ? { ...row, collected: true } : row), ...added]);
    setInput("");
    setNotice(markCollected
      ? `Đã đánh dấu ${codes.length} đơn là đã thu tiền; thêm mới ${added.length} đơn.`
      : `Đã thêm ${added.length} đơn; bỏ qua vận đơn trùng.`);
  }

  function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) { setNotice("Đợi lượt tra hiện tại hoàn tất rồi thêm đơn mới."); return; }
    const code = draft.code.trim().toUpperCase();
    const orderId = normalizeOrderId(draft.orderId);
    if (!/^[A-Z0-9]{7,34}$/.test(code)) { setNotice("Mã vận đơn UPS không hợp lệ."); return; }
    if (!/^#[A-Z0-9-]{2,31}$/.test(orderId)) { setNotice("Mã đơn hàng phải có ít nhất 2 ký tự chữ hoặc số."); return; }
    if (rows.some((row) => row.code === code)) { setNotice(`Vận đơn ${code} đã có trong bảng.`); return; }
    if (rows.some((row) => row.orderId?.toUpperCase() === orderId)) { setNotice(`Mã đơn ${orderId} đã có trong bảng.`); return; }
    if (rows.length >= 500) { setNotice("Mỗi bảng tối đa 500 đơn."); return; }
    const amount = Number(draft.amount);
    const row: Row = {
      code,
      orderId,
      customerName: draft.customerName.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      createdAt: draft.createdAt || today(),
      amount: Number.isFinite(amount) && amount >= 0 && draft.amount !== "" ? amount : undefined,
      edd: draft.edd || undefined,
      collected: draft.collected,
      history: [],
    };
    save([row, ...rows]);
    setCreateOpen(false);
    setDraft(emptyDraft());
    setNotice(`Đã thêm đơn ${orderId} vào bảng.`);
  }

  function toggleCollected(code: string) {
    if (running) return;
    save(rows.map((row) => row.code === code ? { ...row, collected: !row.collected } : row));
  }

  async function run() {
    if (locked.current) return;
    locked.current = true;
    setRunning(true);
    setNotice("");
    let next = [...rows];
    let successful = 0;
    let failed = 0;
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
      setActiveCodes(candidates.map((row) => row.code));
      await Promise.all(candidates.map(async (row) => {
        const result = await request("track", row.code);
        if (!mounted.current) return;
        if (result.ok && result.code === row.code && typeof result.status === "string"
          && typeof result.checkedAt === "string") {
          successful++;
          next = next.map((item) => item.code === row.code ? { ...item, status: result.status,
            rawStatus: result.rawStatus, checkedAt: result.checkedAt, history: normalizeHistory(result.history), error: undefined } : item);
        } else {
          failed++;
          next = next.map((item) => item.code === row.code ? { ...item, error: result.error || "Kết quả không khớp mã yêu cầu." } : item);
        }
        save(next);
        setActiveCodes((codes) => codes.filter((code) => code !== row.code));
      }));
      setNotice(`Đã tra đồng thời ${candidates.length} vận đơn: ${successful} thành công, ${failed} lỗi. Kết quả đã được lưu.`);
    } finally {
      locked.current = false;
      if (mounted.current) { setRunning(false); setActiveCodes([]); }
    }
  }

  function exportCsv() {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const historyRows = rows.flatMap((row) => (row.history?.length ? row.history : [{
      status: row.status || "", rawStatus: row.rawStatus || "",
    }]).map((event) => [row.orderId, row.code, row.customerName, row.phone, row.createdAt,
      row.amount, row.edd, row.collected ? "Đã thu tiền" : "Chưa thu", event.status, event.rawStatus,
      event.date, event.time, event.location, event.details, row.checkedAt, row.error]));
    const csv = [["Mã đơn", "Mã UPS", "Khách hàng", "SĐT", "Ngày tạo", "Số tiền USD", "EDD",
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

  function removeSelected() {
    if (!selected.length || !window.confirm(`Xóa ${selected.length} đơn đã chọn khỏi bảng?`)) return;
    save(rows.filter((row) => !selected.includes(row.code)));
    setSelected([]);
  }

  return <section className="ups-tracking ups-orders-page">
    <div className="ups-order-tools">
      <div className="ups-order-tools-main">
        <div className="ups-connection-state"><i className={connection.startsWith("Đã kết nối") ? "connected" : ""} /><div><strong>{connection}</strong><small>Tiện ích tra đồng thời các vận đơn chưa có kết quả</small></div></div>
        <div className="ups-order-tool-actions">
          <a className="secondary-button" href={`/ups-tracking-extension.zip?v=${UPS_EXTENSION_VERSION}`} download>Tải tiện ích</a>
          <button className="secondary-button" disabled={running} onClick={async () => {
            const result = await request("ping");
            setConnection(connectionLabel(result));
          }}>Kiểm tra kết nối</button>
          <button className="secondary-button" disabled={!rows.length} onClick={exportCsv}>Xuất CSV</button>
          <button className="primary-button" disabled={running || !pendingCount} onClick={() => void run()}>{running ? `Đang tra ${activeCodes.length} đơn` : `Tra ${pendingCount} đơn chưa tra`}</button>
        </div>
      </div>

      <details className="ups-quick-add">
        <summary>Nhập nhanh danh sách mã vận đơn UPS</summary>
        <div className="ups-quick-add-body">
          <label htmlFor="ups-codes">Dán cột mã UPS từ Excel hoặc nhập mỗi mã một dòng</label>
          <textarea id="ups-codes" value={input} onChange={(event) => setInput(event.target.value)} disabled={running} placeholder="1Z064H260334937790" />
          <div className="ups-actions">
            <button className="secondary-button" disabled={running || !input.trim()} onClick={() => addCodes()}>Thêm vào bảng</button>
            <button className="collected-button" disabled={running || !input.trim()} onClick={() => addCodes(true)}>Thêm &amp; đánh dấu đã thu tiền</button>
            <button className="text-button" disabled={running || !rows.length} onClick={() => {
              if (window.confirm("Xóa toàn bộ bảng đơn hàng trên trình duyệt này?")) { save([]); setSelected([]); }
            }}>Xóa bảng</button>
          </div>
        </div>
      </details>

      <p className="ups-order-note">Mã đơn hàng và mã UPS là hai trường riêng. Trạng thái thu tiền được ghi nhận riêng; “Đã giao” không tự động có nghĩa là “Đã thu tiền”.</p>
      <div role="status" aria-live="polite">{activeCodes.length > 0 && <p>Đang tra đồng thời {activeCodes.length} vận đơn chưa có kết quả…</p>}{notice && <p>{notice}</p>}</div>
    </div>

    <div className="ups-order-filter">
      <div className="ups-order-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã đơn, khách hàng, nhân viên, vận đơn..." /></div>
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
      {selected.length > 0 && <button className="text-button danger-text" disabled={running} onClick={removeSelected}>Xóa {selected.length} đơn đã chọn</button>}
    </div>

    <div className="ups-orders-table-card">
      <div className="ups-orders-table-wrap">
        <table className="ups-orders-table">
          <caption>{rows.length.toLocaleString("vi-VN")} tổng đơn · {rows.filter((row) => row.collected).length} đã thu tiền · {rows.filter((row) => row.error).length} mã lỗi</caption>
          <thead><tr>
            <th className="select-cell"><input type="checkbox" aria-label="Chọn tất cả đơn đang hiển thị" checked={allSelected} onChange={toggleAll} /></th>
            <th>Mã đơn</th><th>Sự kiện Shipment</th><th>Khách hàng</th><th>Ngày tạo</th><th className="number-cell">Số tiền</th><th>Trạng thái đơn</th><th>Hãng / Vận đơn</th><th>EDD dự kiến</th><th aria-label="Thao tác" />
          </tr></thead>
          <tbody>{filteredRows.map((row) => {
            const state = orderState(row);
            const isExpanded = expanded === row.code;
            return <Fragment key={row.code}>
              <tr className={selected.includes(row.code) ? "selected" : ""}>
                <td className="select-cell"><input type="checkbox" aria-label={`Chọn đơn ${row.orderId}`} checked={selected.includes(row.code)} onChange={() => setSelected((currentIds) => currentIds.includes(row.code) ? currentIds.filter((code) => code !== row.code) : [...currentIds, row.code])} /></td>
                <td><button className="order-id-button" onClick={() => setExpanded(isExpanded ? "" : row.code)}>{row.orderId || defaultOrderId(row.code)}</button></td>
                <td><OrderStepper step={shipmentStep(row)} /></td>
                <td><div className="order-customer"><strong>{row.customerName || "Chưa nhập khách hàng"}</strong>{row.phone && <small>{row.phone}</small>}</div></td>
                <td className="order-date">{formatOrderDate(row.createdAt)}</td>
                <td className="number-cell order-amount"><strong>{row.amount == null ? "—" : usd.format(row.amount)}</strong>{row.collected && <button disabled={running} onClick={() => toggleCollected(row.code)}>● Đã thu tiền</button>}</td>
                <td><span className={`order-status ${state.className}`}>● {activeCodes.includes(row.code) ? "Đang tra" : state.label}</span></td>
                <td><div className="order-carrier"><b>UPS</b><a href={`https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(row.code)}`} target="_blank" rel="noreferrer">{row.code}</a></div></td>
                <td className="order-date">{formatOrderDate(row.edd)}</td>
                <td><button className="order-more" aria-label={`Xem chi tiết đơn ${row.orderId}`} onClick={() => setExpanded(isExpanded ? "" : row.code)}><MoreVertical size={17} /></button></td>
              </tr>
              {isExpanded && <tr className="ups-order-detail-row"><td colSpan={10}>
                <div className="ups-order-expanded">
                  <div className="ups-order-detail-meta">
                    <div><span>Trạng thái thu tiền</span><button className={`collection-toggle${row.collected ? " is-collected" : ""}`} disabled={running} onClick={() => toggleCollected(row.code)}>{row.collected ? "Đã thu tiền" : "Chưa thu"}</button></div>
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
          })}{!filteredRows.length && <tr><td colSpan={10} className="ups-orders-empty">Không tìm thấy đơn hàng phù hợp.</td></tr>}</tbody>
        </table>
      </div>
    </div>

    {createOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCreateOpen(false)}>
      <section className="modal-card ups-order-modal" role="dialog" aria-modal="true" aria-labelledby="ups-order-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">ĐƠN HÀNG UPS</p><h2 id="ups-order-modal-title">Thêm đơn mới</h2><p>Nhập mã đơn riêng và mã vận đơn UPS; đơn sẽ xuất hiện ngay trong bảng.</p></div><button className="icon-button" onClick={() => setCreateOpen(false)} aria-label="Đóng"><X size={19} /></button></div>
        <form onSubmit={createOrder}>
          <div className="form-grid ups-order-form-grid">
            <label><span>Mã đơn hàng *</span><input value={draft.orderId} onChange={(event) => setDraft({ ...draft, orderId: event.target.value })} placeholder="#C537" autoFocus required /></label>
            <label><span>Mã vận đơn UPS *</span><input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} placeholder="1Z064H260334937790" required /></label>
            <label><span>Khách hàng</span><input value={draft.customerName} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} placeholder="Tên khách hàng" /></label>
            <label><span>Số điện thoại</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="Số điện thoại" /></label>
            <label><span>Số tiền (USD)</span><input type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="100.00" /></label>
            <label><span>Ngày tạo</span><input type="date" value={draft.createdAt} onChange={(event) => setDraft({ ...draft, createdAt: event.target.value })} /></label>
            <label><span>EDD dự kiến</span><input type="date" value={draft.edd} onChange={(event) => setDraft({ ...draft, edd: event.target.value })} /></label>
            <label className="span-2 ups-order-paid-check"><input type="checkbox" checked={draft.collected} onChange={(event) => setDraft({ ...draft, collected: event.target.checked })} /><span>Đơn này đã thu tiền</span></label>
          </div>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setCreateOpen(false)}>Huỷ</button><button className="primary-button" type="submit">Thêm đơn vào bảng</button></div>
        </form>
      </section>
    </div>}
  </section>;
}
