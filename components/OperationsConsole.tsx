"use client";

import { StaffIdentity } from "@/components/StaffIdentity";

import { useMemo, useState } from "react";
import {
  ArchiveRestore,
  BadgeDollarSign,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  DatabaseBackup,
  FileLock,
  Fingerprint,
  Info,
  KeyRound,
  Layers2,
  MapPinned,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  PackageSearch,
  Plug,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
  Check,
  ChevronDown,
  Download,
  Edit3,
  Eye,
  GitMerge,
  Grid,
  House,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { formatDate, integer, money } from "@/lib/format";
import type { DebtRow, PaymentRow, ReturnRow, SpeegoOrderRow } from "@/lib/types";


function formatSpeegoMoney(amount?: number | null, currency = "US$"): string {
  const val = Number(amount || 0);
  const formatted = val.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${currency === "USD" || !currency ? "US$" : currency}`;
}

export const OPERATION_TABS = [
  "staff",
  "warehouse",
  "warehouse_locations",
  "warehouse_expiry",
  "warehouse_serials",
  "warehouse_combos",
  "fulfillment",
  "returns",
  "customers_list",
  "permissions",
  "settlements",
  "payout",
  "backup",
  "app_settings",
  "help",
  "api_integrations",
  "privacy_policy",
] as const;

export type OperationTab = (typeof OPERATION_TABS)[number];

type Totals = {
  debt: number;
  paid: number;
  returned: number;
  remaining: number;
  overdueCount: number;
};

type OperationProps = {
  activeTab: OperationTab;
  orders: SpeegoOrderRow[];
  debts: DebtRow[];
  payments: PaymentRow[];
  returns: ReturnRow[];
  totals: Totals;
};

const inventoryRows = [
  { sku: "SG-FMCG-001", lot: "LOT-A", zone: "A-03-02-05", stock: 1260, reserved: 312, expiry: "2026-10-09", state: "Ưu tiên xuất" },
  { sku: "SG-ELEC-142", lot: "IMEI", zone: "B-04-01-12", stock: 84, reserved: 18, expiry: "2027-02-18", state: "Serial bắt buộc" },
  { sku: "SG-BEAUTY-CMB", lot: "COMBO-C", zone: "C-01-03-08", stock: 210, reserved: 42, expiry: "2026-12-31", state: "Tự rã combo" },
  { sku: "SG-DRY-024", lot: "LOT-B", zone: "A-02-05-01", stock: 486, reserved: 96, expiry: "2026-09-28", state: "Sắp hết hạn" },
];

type FulfillmentRow = {
  code: string;
  customer: string;
  channel: string;
  carrier: string;
  fee: number;
  feeText?: string;
  status: string;
};

const fulfillmentQueue: FulfillmentRow[] = [
  { code: "#SG10291", customer: "Nguyễn Đắc Công", channel: "Manual", carrier: "UPS", fee: 15400, status: "Chờ pick" },
  { code: "#SG10288", customer: "Minh Phương Store", channel: "Shopee", carrier: "GHN", fee: 12800, status: "Đóng gói" },
  { code: "#SG10274", customer: "An Khang FMCG", channel: "Lazada", carrier: "J&T", fee: 18900, status: "Bàn giao" },
  { code: "#SG10261", customer: "Bảo Long Tech", channel: "Manual", carrier: "UPS", fee: 22300, status: "Đang giao" },
];

const settlementRows = [
  { cycle: "FUL-2026-09-W1", orders: 342, gross: 198_450_000, fees: 9_840_000, status: "Đã chốt" },
  { cycle: "FUL-2026-09-W2", orders: 416, gross: 246_150_000, fees: 12_320_000, status: "Đang đối soát" },
  { cycle: "PAYOUT-2026-09-10", orders: 96, gross: 54_850_000, fees: 2_760_000, status: "Chờ duyệt" },
];

const permissionRows = [
  { role: "Admin quản lý", view: true, create: true, update: true, delete: true },
  { role: "Vận hành kho", view: true, create: true, update: true, delete: false },
  { role: "Sale", view: true, create: true, update: false, delete: false },
  { role: "Kế toán", view: true, create: false, update: true, delete: false },
];

const serialRows = [
  { serial: "VF55011086", sku: "SG-ELEC-142", order: "#SG10261", status: "Đã xuất", scan: "Barcode" },
  { serial: "0931933899", sku: "SG-ELEC-142", order: "#SG10274", status: "Đang giữ", scan: "IMEI" },
  { serial: "BATCH-A-2609", sku: "SG-FMCG-001", order: "#SG10291", status: "FEFO", scan: "Batch" },
];

function percent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function dueSoonCount() {
  return inventoryRows.filter((row) => Date.parse(`${row.expiry}T00:00:00`) - Date.now() < 1000 * 60 * 60 * 24 * 45).length;
}

function orderState(row: SpeegoOrderRow) {
  const value = `${row.status || ""} ${row.raw_status || ""} ${row.error || ""}`.toLocaleLowerCase("vi");
  if (/returned|returning|hoàn/.test(value)) return "returned";
  if (row.error || /fail|exception|undeliver|thất bại|lỗi/.test(value)) return "failed";
  if (/deliver|giao thành công|đã giao/.test(value)) return "delivered";
  if (/transit|out for|pickup|ship|depart|arriv|đang giao|vận chuyển/.test(value)) return "shipping";
  return "processing";
}

function orderAmountVnd(row: SpeegoOrderRow) {
  if (row.total_amount_vnd != null) return Number(row.total_amount_vnd);
  if (row.currency === "VND" && row.amount != null) return Number(row.amount);
  if (row.exchange_rate != null && row.amount != null) return Number(row.amount) * Number(row.exchange_rate);
  return 0;
}

function fulfillmentRowsFor(orders: SpeegoOrderRow[]): FulfillmentRow[] {
  if (!orders.length) return fulfillmentQueue;
  return orders.slice(0, 8).map((row) => ({
    code: row.order_id || row.source_order_code || `#${row.tracking_code}`,
    customer: row.customer_name || "Chưa có tên khách",
    channel: row.source_order_code?.startsWith("speedgo-") ? "SpeedGo" : "UPS",
    carrier: row.shipping_unit || "UPS",
    fee: 0,
    feeText: "Chưa có",
    status: orderStateLabel(orderState(row)),
  }));
}

function orderStateLabel(state: string) {
  if (state === "delivered") return "Đã giao";
  if (state === "failed") return "Giao thất bại";
  if (state === "shipping") return "Đang vận chuyển";
  if (state === "returned") return "Đã hoàn";
  return "Đang xử lý";
}

function settlementRowsFor(orders: SpeegoOrderRow[]) {
  if (!orders.length) return settlementRows;
  const month = orders.find((row) => row.order_date)?.order_date.slice(0, 7) || "2026-09";
  const total = orders.reduce((sum, row) => sum + orderAmountVnd(row), 0);
  const activeOrders = orders.filter((row) => orderState(row) !== "returned").length;
  return [
    { cycle: `ORDER-${month}`, orders: orders.length, gross: total, fees: 0, status: "Đang đối soát" },
    { cycle: `FULFILLMENT-${month}`, orders: activeOrders, gross: total, fees: 0, status: "Chờ phí" },
  ];
}

function operationTitle(tab: OperationTab) {
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
  if (tab === "app_settings") return "Cài đặt";
  if (tab === "help") return "Trợ giúp";
  if (tab === "api_integrations") return "Tích hợp API";
  if (tab === "privacy_policy") return "Chính sách & Quyền riêng tư";
  return "Sao lưu & khôi phục";
}

function operationIcon(tab: OperationTab) {
  if (tab === "staff") return <Users size={19} />;
  if (tab === "warehouse") return <Warehouse size={19} />;
  if (tab === "warehouse_locations") return <MapPinned size={19} />;
  if (tab === "warehouse_expiry") return <CalendarClock size={19} />;
  if (tab === "warehouse_serials") return <ScanBarcode size={19} />;
  if (tab === "warehouse_combos") return <Layers2 size={19} />;
  if (tab === "fulfillment") return <PackageCheck size={19} />;
  if (tab === "returns") return <ArchiveRestore size={19} />;
  if (tab === "customers_list") return <Users size={19} />;
  if (tab === "permissions") return <ShieldCheck size={19} />;
  if (tab === "settlements") return <ReceiptText size={19} />;
  if (tab === "payout") return <CreditCard size={19} />;
  if (tab === "app_settings") return <Settings size={19} />;
  if (tab === "help") return <Info size={19} />;
  if (tab === "api_integrations") return <Plug size={19} />;
  if (tab === "privacy_policy") return <FileLock size={19} />;
  return <DatabaseBackup size={19} />;
}

function MiniKpi({ icon, label, value, tone = "orange" }: { icon: React.ReactNode; label: string; value: string; tone?: "orange" | "blue" | "green" | "amber" }) {
  return (
    <article className={`ops-kpi ${tone}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

import { DashboardCharts, type Language, type DatePeriod } from "@/components/DashboardCharts";
import { StaffConsole, type StaffSubTab } from "@/components/StaffConsole";
import { WarehouseConsolePro, type WarehouseSubTab } from "@/components/WarehouseConsolePro";

export function SpeedGoDashboard({
  orders,
  debts,
  payments,
  returns,
  totals,
  lang = "vi",
  period = "this_month",
}: Omit<OperationProps, "activeTab"> & { lang?: Language; period?: DatePeriod }) {
  return (
    <section className="speedgo-dashboard" aria-label="Tổng quan vận hành">
      <DashboardCharts
        orders={orders}
        debts={debts}
        payments={payments}
        returns={returns}
        lang={lang}
        period={period}
      />
    </section>
  );
}


export function OperationsConsole({
  activeTab,
  orders,
  debts,
  payments,
  returns,
  totals,
  lang = "vi",
  initialStaffSubTab,
  initialWarehouseSubTab,
}: OperationProps & {
  lang?: Language;
  initialStaffSubTab?: StaffSubTab;
  initialWarehouseSubTab?: WarehouseSubTab;
}) {
  if (activeTab === "staff") {
    return <StaffConsole orders={orders} debts={debts} lang={lang} initialSubTab={initialStaffSubTab || "sellers"} />;
  }
  if (activeTab === "permissions") {
    return <StaffConsole orders={orders} debts={debts} lang={lang} initialSubTab="tiers" />;
  }
  if (activeTab === "warehouse") {
    return (
      <WarehouseConsolePro
        orders={orders}
        debts={debts}
        lang={lang}
        initialSubTab={initialWarehouseSubTab || "inventory"}
      />
    );
  }
  if (activeTab === "warehouse_locations") return <WarehouseLocations />;
  if (activeTab === "warehouse_expiry") return <ExpiryConsole />;
  if (activeTab === "warehouse_serials") return <SerialConsole />;
  if (activeTab === "warehouse_combos") return <ComboConsole />;
  if (activeTab === "fulfillment") return <FulfillmentConsole orders={orders} />;
  if (activeTab === "returns") return <ReturnRefundConsole returns={returns} />;
  if (activeTab === "customers_list") return <CustomersConsole orders={orders} debts={debts} />;
  if (activeTab === "settlements") return <SettlementConsole orders={orders} totals={totals} />;
  if (activeTab === "payout") return <PayoutConsole orders={orders} payments={payments} totals={totals} />;
  if (activeTab === "backup") return <BackupConsole orders={orders} debts={debts} payments={payments} returns={returns} />;
  if (activeTab === "app_settings") return <AppSettingsConsole />;
  if (activeTab === "help") return <HelpConsole />;
  if (activeTab === "api_integrations") return <ApiIntegrationsConsole />;
  if (activeTab === "privacy_policy") return <PrivacyPolicyConsole />;
  return (
    <WarehouseConsolePro
      orders={orders}
      debts={debts}
      lang={lang}
      initialSubTab={initialWarehouseSubTab || "inventory"}
    />
  );
}

function ConsoleShell({ tab, children }: { tab: OperationTab; children: React.ReactNode }) {
  return (
    <section className="operations-console" aria-label={operationTitle(tab)}>
      <div className="ops-command-bar">
        <div className="ops-command-title">
          <span>{operationIcon(tab)}</span>
          <strong>{operationTitle(tab)}</strong>
        </div>
        <div className="ops-chip-row">
          <span>Live Production</span>
          <span>OMS</span>
          <span>Warehouse</span>
        </div>
      </div>
      {children}
    </section>
  );
}

function WarehouseConsole() {
  const totalStock = inventoryRows.reduce((sum, row) => sum + row.stock, 0);
  const reserved = inventoryRows.reduce((sum, row) => sum + row.reserved, 0);
  const modules = [
    { href: "/vi-tri-kho", icon: <MapPinned size={18} />, label: "Vị trí kho", value: "Rack / dãy / ô" },
    { href: "/han-su-dung", icon: <CalendarClock size={18} />, label: "Hạn sử dụng", value: "FEFO" },
    { href: "/serial-imei-batch", icon: <ScanBarcode size={18} />, label: "Serial / IMEI / Batch", value: "Barcode" },
    { href: "/combo-hang", icon: <Layers2 size={18} />, label: "Combo hàng", value: "Auto BOM" },
  ];
  return (
    <ConsoleShell tab="warehouse">
      <div className="ops-kpi-row">
        <MiniKpi icon={<Boxes size={18} />} label="SKU đang quản lý" value={integer.format(inventoryRows.length * 416)} />
        <MiniKpi icon={<PackagePlus size={18} />} label="Tồn khả dụng" value={integer.format(totalStock - reserved)} tone="green" />
        <MiniKpi icon={<PackageMinus size={18} />} label="Đã giữ hàng" value={integer.format(reserved)} tone="amber" />
        <MiniKpi icon={<MapPinned size={18} />} label="Vị trí đã số hóa" value="4.386 / 7.643" tone="blue" />
      </div>
      <div className="ops-module-grid">
        {modules.map((item) => <a key={item.href} className="ops-module-card" href={item.href}>{item.icon}<span>{item.label}</span><strong>{item.value}</strong></a>)}
      </div>
      <div className="ops-two-column">
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Kho tổng</span><strong>Rack A, B, C đang hoạt động</strong></div><Warehouse size={20} /></div>
          <InventoryTable />
        </section>
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Picking routing</span><strong>{"A-03-02-05 -> B-04-01-12"}</strong></div><Truck size={20} /></div>
          <div className="ops-route-map">
            {["Inbound", "Rack A", "Rack B", "Pack", "Handoff"].map((item, index) => <span key={item} className={index === 2 ? "active" : ""}>{item}</span>)}
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}

function StaffAccountsConsole({ orders }: { orders: SpeegoOrderRow[] }) {
  const salesCount = new Set(orders.map((row) => row.sales_person).filter(Boolean)).size;
  const staffRows = [
    { account: "admin@speedgo.com", role: "Owner", scope: "Toàn hệ thống", status: "Active" },
    { account: "warehouse@speedgo.com", role: "Vận hành kho", scope: "Kho / Fulfillment", status: "Active" },
    { account: "finance@speedgo.com", role: "Kế toán", scope: "Đối soát / Payout", status: "Active" },
    { account: "seller@speedgo.com", role: "Seller", scope: "Đơn hàng", status: "Giới hạn" },
  ];
  return (
    <ConsoleShell tab="staff">
      <div className="ops-kpi-row">
        <MiniKpi icon={<Users size={18} />} label="Tài khoản active" value={integer.format(staffRows.length)} tone="green" />
        <MiniKpi icon={<ShieldCheck size={18} />} label="Nhóm vai trò" value={integer.format(permissionRows.length)} tone="blue" />
        <MiniKpi icon={<KeyRound size={18} />} label="Quyền nhạy cảm" value={integer.format(6)} tone="amber" />
        <MiniKpi icon={<ClipboardCheck size={18} />} label="Seller đang có đơn" value={integer.format(salesCount)} />
      </div>
      <section className="ops-panel">
        <div className="ops-panel-heading"><div><span>Tài khoản nhân viên</span><strong>Vai trò, phạm vi và trạng thái</strong></div><Users size={20} /></div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Phạm vi</th><th>Trạng thái</th></tr></thead>
            <tbody>{staffRows.map((row) => <tr key={row.account}><td><strong>{row.account}</strong></td><td>{row.role}</td><td>{row.scope}</td><td><span className="ops-state">{row.status}</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </ConsoleShell>
  );
}

function WarehouseLocations() {
  const [selectedCell, setSelectedCell] = useState("A-01-02-05");
  const selectedFill = useMemo(() => {
    const checksum = selectedCell.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return 1 + (checksum % 7);
  }, [selectedCell]);
  return (
    <ConsoleShell tab="warehouse_locations">
      <div className="warehouse-map-shell">
        <div className="warehouse-map-summary">
          <article><span>Mặt độ sử dụng</span><strong>4.386 / 7.643</strong><small>57,4%</small></article>
          <article><span>CBM Utilization</span><strong>476,4 / 481,9</strong><small>98,9%</small></article>
          <article><span>Mật độ sử dụng</span><strong>+70%</strong><small>{"Kho T3 -> Kho T9"}</small></article>
        </div>
        <section className="ops-panel warehouse-location-detail">
          <div className="ops-panel-heading"><div><span>Vị trí đang chọn</span><strong>{selectedCell}</strong></div><MapPinned size={20} /></div>
          <div className="tracking-time-grid">
            <article><span>Sức chứa</span><strong>{selectedFill}/7</strong></article>
            <article><span>Trạng thái</span><strong>{selectedFill >= 6 ? "Gần đầy" : selectedFill <= 2 ? "Còn trống" : "Đang dùng"}</strong></article>
            <article><span>SKU ưu tiên</span><strong>{selectedFill >= 6 ? "SG-DRY-024" : "SG-FMCG-001"}</strong></article>
            <article><span>Lộ trình pick</span><strong>{"Inbound -> Rack -> Pack"}</strong></article>
          </div>
        </section>
        <div className="warehouse-grid-board">
          {["Rack A", "Rack B", "Rack C"].map((rack, rackIndex) => (
            <section key={rack} className="warehouse-rack">
              <strong>{rack}</strong>
              <div>
                {Array.from({ length: 70 }, (_, index) => {
                  const busy = (index + rackIndex) % 9 === 0;
                  const warning = (index + rackIndex) % 17 === 0;
                  const code = `${rack.at(-1)}-${String(rackIndex + 1).padStart(2, "0")}-${String(Math.floor(index / 10) + 1).padStart(2, "0")}-${String((index % 10) + 1).padStart(2, "0")}`;
                  return <button key={code} type="button" className={`${warning ? "warning" : busy ? "busy" : "ok"}${selectedCell === code ? " selected" : ""}`} onClick={() => setSelectedCell(code)}>{busy ? "2/7" : "1/7"}</button>;
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </ConsoleShell>
  );
}

function ExpiryConsole() {
  const [lockedLots, setLockedLots] = useState(() => new Set(["LOT-B"]));
  return (
    <ConsoleShell tab="warehouse_expiry">
      <div className="ops-kpi-row">
        <MiniKpi icon={<CalendarClock size={18} />} label="Lô sắp hết hạn" value={integer.format(dueSoonCount())} tone="amber" />
        <MiniKpi icon={<PackageCheck size={18} />} label="FEFO khả dụng" value="98%" tone="green" />
        <MiniKpi icon={<Boxes size={18} />} label="Lô đang theo dõi" value={integer.format(184)} />
        <MiniKpi icon={<PackageMinus size={18} />} label="Đang khóa xuất" value={integer.format(lockedLots.size)} tone="blue" />
      </div>
      <section className="ops-panel">
        <div className="ops-panel-heading"><div><span>FEFO</span><strong>Ưu tiên lô gần hết hạn</strong></div><CalendarClock size={20} /></div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>SKU</th><th>Lô</th><th>Vị trí</th><th>Hạn dùng</th><th>FEFO</th><th>Khóa xuất</th></tr></thead>
            <tbody>{inventoryRows.map((row) => {
              const locked = lockedLots.has(row.lot);
              return <tr key={`${row.sku}-${row.lot}`}><td><strong>{row.sku}</strong></td><td>{row.lot}</td><td>{row.zone}</td><td>{formatDate(row.expiry)}</td><td><span className="ops-state">{row.state}</span></td><td><button className={`ops-inline-action${locked ? " active" : ""}`} type="button" onClick={() => setLockedLots((current) => {
                const next = new Set(current);
                if (next.has(row.lot)) next.delete(row.lot);
                else next.add(row.lot);
                return next;
              })}>{locked ? "Đang khóa" : "Khóa xuất"}</button></td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </ConsoleShell>
  );
}

function SerialConsole() {
  const [scanValue, setScanValue] = useState("VF55011086");
  const matched = serialRows.find((row) => row.serial.toLowerCase() === scanValue.trim().toLowerCase());
  return (
    <ConsoleShell tab="warehouse_serials">
      <div className="ops-two-column">
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Quét serial</span><strong>Serial / IMEI / Batch</strong></div><ScanBarcode size={20} /></div>
          <label className="field ops-scan-input"><span>Mã quét</span><input value={scanValue} onChange={(event) => setScanValue(event.target.value)} placeholder="Quét hoặc nhập serial..." /></label>
          <div className="serial-scan-frame">
            <ScanBarcode size={42} />
            <strong>{scanValue || "Chưa có mã"}</strong>
            <span>{matched ? `Matched · SKU ${matched.sku} · ${matched.status}` : "Chưa khớp serial trong hệ thống"}</span>
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Danh sách serial</span><strong>{serialRows.length} mã gần nhất</strong></div><Fingerprint size={20} /></div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Serial</th><th>SKU</th><th>Đơn</th><th>Kiểu</th><th>Trạng thái</th></tr></thead>
              <tbody>{serialRows.map((row) => <tr key={row.serial}><td><strong>{row.serial}</strong></td><td>{row.sku}</td><td>{row.order}</td><td>{row.scan}</td><td><span className="ops-state">{row.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}

function ComboConsole() {
  const [combos, setCombos] = useState([
    { combo: "Combo A", items: "Sữa rửa mặt 100 · Toner 50 · Kem dưỡng 10", available: 10, reserved: 3 },
    { combo: "Combo B", items: "Pin sạc 2 · Cáp USB 1 · Hộp bảo hành 1", available: 28, reserved: 9 },
    { combo: "Combo C", items: "Snack 6 · Nước 3 · Voucher 1", available: 64, reserved: 11 },
  ]);
  function splitCombo(combo: string) {
    setCombos((current) => current.map((row) => row.combo === combo && row.available > 0
      ? { ...row, available: row.available - 1, reserved: row.reserved + 1 }
      : row));
  }
  return (
    <ConsoleShell tab="warehouse_combos">
      <section className="ops-panel combo-builder">
        <div className="ops-panel-heading"><div><span>Phân rã combo</span><strong>Tự động trừ tồn theo thành phần</strong></div><Layers2 size={20} /></div>
        <div className="combo-flow">
          {combos.map((row) => <article key={row.combo}><strong>{row.combo}</strong><span>{row.items}</span><b>Còn {row.available} combo khả dụng</b><button className="ops-inline-action" type="button" disabled={!row.available} onClick={() => splitCombo(row.combo)}>Rã 1 combo</button></article>)}
        </div>
      </section>
      <section className="ops-panel">
        <InventoryTable mode="combo" />
      </section>
    </ConsoleShell>
  );
}

function FulfillmentConsole({ orders }: { orders: SpeegoOrderRow[] }) {
  const rows = fulfillmentRowsFor(orders);
  return (
    <ConsoleShell tab="fulfillment">
      {/* Sub-banner card matching Screenshot 1 */}
      <div className="speego-fulfillment-banner-card">
        <div className="speego-fulfillment-banner-left">
          <span className="speego-banner-icon"><Package size={18} /></span>
          <strong>Fulfillment</strong>
        </div>
        <div className="speego-fulfillment-banner-badges">
          <span className="speego-live-badge">Live Production</span>
          <span className="speego-dim-badge">OMS</span>
          <span className="speego-dim-badge">Warehouse</span>
        </div>
      </div>

      {/* 4 Mini KPI Cards */}
      <div className="ops-kpi-row">
        <MiniKpi icon={<PackageSearch size={18} />} label="Đơn chờ xử lý" value="0" />
        <MiniKpi icon={<PackageCheck size={18} />} label="Đã giao" value="0" tone="green" />
        <MiniKpi icon={<Truck size={18} />} label="Đang vận chuyển" value="0" tone="blue" />
        <MiniKpi icon={<ReceiptText size={18} />} label="Phí fulfillment" value="69.400 đ" tone="amber" />
      </div>

      {/* Fulfillment Queue Card */}
      <section className="ops-panel">
        <div className="ops-panel-heading">
          <div>
            <span>Fulfillment queue</span>
            <strong>Pick · Pack · Handoff · Tracking</strong>
          </div>
          <PackageCheck size={20} />
        </div>
        <FulfillmentTable rows={rows} />
      </section>
    </ConsoleShell>
  );
}

function ReturnRefundConsole({ returns }: { returns: ReturnRow[] }) {
  const [returnStatus, setReturnStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [eddFilter, setEddFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("all");

  const returnOrderRows = useMemo(() => {
    if (returns.length) {
      return returns.map((ret, idx) => ({
        code: `#${ret.id.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "8575"}`,
        staff: "Trúc Kiều",
        customer: ret.customer?.name || "DuvieAntonio",
        phone: "9077642545",
        product: ret.product_name || "Dán Kinoki",
        quantity: ret.quantity || 8,
        notes: ret.notes || "—",
        date: "9 thg 9, 2026",
        amount: formatSpeegoMoney(ret.total_amount ? ret.total_amount / 25000 : 200, "US$"),
        fee: "0,00 US$",
        status: idx === 0 ? "completed" : "returning",
      }));
    }
    return [
      {
        code: "#8575",
        staff: "Trúc Kiều",
        customer: "DuvieAntonio",
        phone: "9077642545",
        product: "Dán Kinoki",
        quantity: 8,
        notes: "—",
        date: "9 thg 9, 2026",
        amount: "200,00 US$",
        fee: "0,00 US$",
        status: "completed",
      },
    ];
  }, [returns]);

  const tabs = [
    { key: "all", label: "Tất cả", count: returnOrderRows.length },
    { key: "returning", label: "Đang hoàn", count: returnOrderRows.filter((r) => r.status === "returning").length },
    { key: "completed", label: "Đã hoàn", count: returnOrderRows.filter((r) => r.status === "completed").length },
    { key: "refunded", label: "Hoàn tiền", count: 0 },
  ];

  return (
    <ConsoleShell tab="returns">
      <div className="speego-returns-panel">
        <div className="speego-orders-header">
          <div className="speego-orders-heading">
            <h2>Return & Refund</h2>
            <p>Đơn hoàn hàng từ hãng vận chuyển và đơn đã ghi nhận hoàn tiền.</p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="speego-filter-pills-row" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`speego-filter-pill ${returnStatus === tab.key ? "active" : ""}`}
              onClick={() => setReturnStatus(tab.key)}
            >
              <span>{tab.label}</span>
              <b className="speego-pill-badge">{tab.count}</b>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="speego-filter-bar">
          <div className="speego-search-box">
            <Search size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo đơn, nhân viên,..."
            />
          </div>
          <div className="speego-dropdown-filters">
            <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
              <option value="all">Mọi thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="this_month">Tháng này</option>
            </select>
            <select value={eddFilter} onChange={(e) => setEddFilter(e.target.value)}>
              <option value="all">EDD</option>
              <option value="has_edd">Có ngày giao</option>
            </select>
            <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="all">Tất cả nhân viên</option>
              <option value="trukieu">Trúc Kiều</option>
              <option value="ngocdan">Ngọc Dân</option>
            </select>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">Tất cả nhóm</option>
            </select>
            <select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)}>
              <option value="all">Tất cả hãng</option>
              <option value="UPS">UPS</option>
            </select>
            <button type="button" className="speego-tool-icon-btn" title="Thêm"><Plus size={15} /></button>
            <button type="button" className="speego-tool-icon-btn" title="Chế độ bảng"><Grid size={15} /></button>
          </div>
        </div>

        {/* Return table */}
        <div className="speego-orders-table-card">
          <div className="speego-orders-table-wrap">
            <table className="speego-orders-table">
              <thead>
                <tr>
                  <th className="select-cell"><input type="checkbox" /></th>
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
                {returnOrderRows.map((row) => (
                  <tr key={row.code}>
                    <td className="select-cell"><input type="checkbox" /></td>
                    <td>
                      <span className="speego-order-code-badge">{row.code}</span>
                    </td>
                    <td>
                      {/* Stepper with 6 nodes for Return & Refund (Blue, Teal, Orange, Blue, Purple, Grey) */}
                      <div className="shipment-stepper-v2">
                        <span className="stepper-node-v2 node-blue" title="Xuất kho"><House size={11} /></span>
                        <span className="stepper-line-v2 active" />
                        <span className="stepper-node-v2 node-teal" title="Thanh toán"><CreditCard size={11} /></span>
                        <span className="stepper-line-v2 active" />
                        <span className="stepper-node-v2 node-orange" title="Trạm giao"><MapPin size={11} /></span>
                        <span className="stepper-line-v2 active" />
                        <span className="stepper-node-v2 node-blue" title="Giao hàng"><Truck size={11} /></span>
                        <span className="stepper-line-v2 active" />
                        <span className="stepper-node-v2 node-purple" title="Hoàn hàng"><Package size={11} /></span>
                        <span className="stepper-line-v2 active" />
                        <span className="stepper-node-v2 node-grey" title="Đã nhập kho hoàn"><ArchiveRestore size={11} /></span>
                      </div>
                    </td>
                    <td className="speego-staff-cell"><StaffIdentity value={row.staff} /></td>
                    <td className="speego-customer-cell">
                      <strong>{row.customer}</strong>
                      <small>{row.phone}</small>
                    </td>
                    <td className="speego-product-cell"><span>{row.product}</span></td>
                    <td className="speego-qty-cell"><span>{row.quantity}</span></td>
                    <td className="speego-notes-cell"><span className="speego-dash">—</span></td>
                    <td className="speego-date-cell"><span>{row.date}</span></td>
                    <td className="speego-amount-cell"><strong>{row.amount}</strong></td>
                    <td className="speego-fulfillment-fee-cell">
                      <div className="speego-fee-wrap">
                        <span>{row.fee}</span>
                        <span className="speego-payment-badge unpaid">● Chưa thanh toán</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="speego-table-footer-info">
            <span>1–{returnOrderRows.length} / {returnOrderRows.length} kết quả</span>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}

function CustomersConsole({ orders, debts }: { orders: SpeegoOrderRow[]; debts: DebtRow[] }) {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  const customersList = useMemo(() => {
    const groups = new Map<string, { orders: number; revenue: number; phone: string | null; email: string | null }>();
    if (orders.length) {
      orders.forEach((o) => {
        const name = o.customer_name || "Khách hàng";
        const cur = groups.get(name) || { orders: 0, revenue: 0, phone: o.phone, email: o.email };
        groups.set(name, {
          orders: cur.orders + 1,
          revenue: cur.revenue + (Number(o.amount) || 200),
          phone: cur.phone || o.phone,
          email: cur.email || o.email,
        });
      });
    }
    if (debts.length) {
      debts.forEach((d) => {
        const name = d.customer_name || "Khách hàng";
        if (!groups.has(name)) {
          groups.set(name, {
            orders: 1,
            revenue: d.amount ? d.amount / 25000 : 200,
            phone: d.phone,
            email: null,
          });
        }
      });
    }

    const sampleNames = [
      { name: "PerlaValenzuela", phone: "8083047633", orders: 4, revenue: 2800 },
      { name: "JoviePuducay", phone: "8087995580", orders: 1, revenue: 675 },
      { name: "AlepiHoleman", phone: "5416684512", orders: 1, revenue: 200 },
      { name: "LucilleRivera", phone: "8189307398", orders: 1, revenue: 200 },
      { name: "Litacolio", phone: "8083897549", orders: 1, revenue: 200 },
      { name: "LucialitaMislang", phone: "6692977900", orders: 1, revenue: 200 },
      { name: "GodfredaMarks", phone: "2146823937", orders: 1, revenue: 200 },
      { name: "RonniePasamonte", phone: "8082256695", orders: 1, revenue: 200 },
      { name: "AmyLobetosLimosnero", phone: "8084501234", orders: 1, revenue: 200 },
    ];

    if (groups.size < 3) {
      sampleNames.forEach((s) => {
        if (!groups.has(s.name)) {
          groups.set(s.name, { orders: s.orders, revenue: s.revenue, phone: s.phone, email: null });
        }
      });
    }

    return Array.from(groups.entries()).map(([name, data]) => ({
      name,
      email: data.email || "—",
      phone: data.phone || "—",
      tags: "—",
      orderCount: data.orders,
      revenueUsd: formatSpeegoMoney(data.revenue, "US$"),
      lastOrderDate: "9 thg 9, 2026",
      status: "Đang hoạt động",
    }));
  }, [orders, debts]);

  const totalCustomers = 3342;

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customersList.filter((c) => {
      if (q && !`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)) return false;
      if (activeTab === "archived") return false;
      return true;
    });
  }, [customersList, search, activeTab]);

  return (
    <ConsoleShell tab="customers_list">
      <div className="speego-customers-panel">
        {/* Header with Actions */}
        <div className="speego-orders-header">
          <div className="speego-orders-heading">
            <h2>Khách hàng</h2>
            <p>CRM dùng chung. Nhập đơn cũ để backfill.</p>
          </div>
          <div className="speego-orders-actions">
            <button type="button" className="speego-subtle-btn">
              <Download size={15} />
              <span>Nhập từ đơn hàng</span>
            </button>
            <button type="button" className="speego-subtle-btn">
              <RefreshCw size={15} />
              <span>Làm mới</span>
            </button>
            <button type="button" className="speego-create-btn">
              <Plus size={16} />
              <span>Thêm khách</span>
            </button>
          </div>
        </div>

        {/* 3 KPI Cards */}
        <div className="speego-crm-kpi-row">
          <article className="speego-crm-kpi-card">
            <div className="speego-crm-kpi-top">
              <span className="speego-crm-icon orange"><Users size={16} /></span>
              <span>Khách hàng</span>
            </div>
            <strong>{totalCustomers.toLocaleString("vi-VN")}</strong>
          </article>
          <article className="speego-crm-kpi-card">
            <div className="speego-crm-kpi-top">
              <span className="speego-crm-icon orange"><UserCheck size={16} /></span>
              <span>Đang hoạt động</span>
            </div>
            <strong>{totalCustomers.toLocaleString("vi-VN")}</strong>
          </article>
          <article className="speego-crm-kpi-card">
            <div className="speego-crm-kpi-top">
              <span className="speego-crm-icon orange"><Package size={16} /></span>
              <span>Có đơn</span>
            </div>
            <strong>{totalCustomers.toLocaleString("vi-VN")}</strong>
          </article>
        </div>

        {/* Filter row */}
        <div className="speego-crm-filter-bar">
          <div className="speego-filter-pills-row" role="tablist">
            <button
              type="button"
              className={`speego-filter-pill ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <span>Tất cả</span>
              <b className="speego-pill-badge">{totalCustomers}</b>
            </button>
            <button
              type="button"
              className={`speego-filter-pill ${activeTab === "active" ? "active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              <span>Đang hoạt động</span>
              <b className="speego-pill-badge">{totalCustomers}</b>
            </button>
            <button
              type="button"
              className={`speego-filter-pill ${activeTab === "archived" ? "active" : ""}`}
              onClick={() => setActiveTab("archived")}
            >
              <span>Đã lưu trữ</span>
              <b className="speego-pill-badge">0</b>
            </button>
            <button
              type="button"
              className={`speego-filter-pill ${activeTab === "has_orders" ? "active" : ""}`}
              onClick={() => setActiveTab("has_orders")}
            >
              <span>Có đơn</span>
              <b className="speego-pill-badge">{totalCustomers}</b>
            </button>
          </div>

          <div className="speego-search-box crm-search">
            <Search size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email, SĐT,..."
            />
          </div>
        </div>

        {/* CRM Customers Table */}
        <div className="speego-orders-table-card">
          <div className="speego-orders-table-wrap">
            <table className="speego-orders-table">
              <thead>
                <tr>
                  <th>TÊN</th>
                  <th>EMAIL</th>
                  <th>SĐT</th>
                  <th>TAGS</th>
                  <th>ĐƠN</th>
                  <th>ĐƠN GẦN NHẤT</th>
                  <th>TRẠNG THÁI</th>
                  <th className="action-col">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <span className="speego-customer-name-link">{c.name}</span>
                    </td>
                    <td><span className="speego-dash">{c.email}</span></td>
                    <td className="speego-phone-cell"><span>{c.phone}</span></td>
                    <td><span className="speego-dash">{c.tags}</span></td>
                    <td className="speego-order-stat-cell">
                      <div className="speego-order-stat-wrap">
                        <strong>{c.orderCount}</strong>
                        <small>{c.revenueUsd}</small>
                      </div>
                    </td>
                    <td className="speego-date-cell"><span>{c.lastOrderDate}</span></td>
                    <td>
                      <span className="speego-status-tag green">Đang hoạt động</span>
                    </td>
                    <td>
                      <div className="speego-crm-actions">
                        <button type="button" className="speego-crm-action-btn" title="Xem">
                          <Eye size={13} />
                          <span>Xem</span>
                        </button>
                        <button type="button" className="speego-crm-action-btn" title="Sửa">
                          <Edit3 size={13} />
                          <span>Sửa</span>
                        </button>
                        <button type="button" className="speego-crm-action-btn" title="Gộp">
                          <GitMerge size={13} />
                          <span>Gộp</span>
                        </button>
                        <button type="button" className="speego-crm-action-btn danger" title="Lưu trữ">
                          <Trash2 size={13} />
                          <span>Lưu trữ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}

function PermissionsConsole() {
  const [rows, setRows] = useState(permissionRows);
  function toggle(role: string, field: "view" | "create" | "update" | "delete") {
    setRows((current) => current.map((row) => row.role === role ? { ...row, [field]: !row[field] } : row));
  }
  return (
    <ConsoleShell tab="permissions">
      <section className="ops-panel">
        <div className="ops-panel-heading"><div><span>Ma trận quyền</span><strong>Vai trò theo vận hành</strong></div><KeyRound size={20} /></div>
        <div className="ops-table-wrap">
          <table className="ops-table permission-table">
            <thead><tr><th>Vai trò</th><th>Xem</th><th>Thêm</th><th>Sửa</th><th>Xóa</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.role}><td><strong>{row.role}</strong></td><td><button className="permission-toggle" type="button" onClick={() => toggle(row.role, "view")}>{check(row.view)}</button></td><td><button className="permission-toggle" type="button" onClick={() => toggle(row.role, "create")}>{check(row.create)}</button></td><td><button className="permission-toggle" type="button" onClick={() => toggle(row.role, "update")}>{check(row.update)}</button></td><td><button className="permission-toggle" type="button" onClick={() => toggle(row.role, "delete")}>{check(row.delete)}</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <div className="ops-kpi-row">
        <MiniKpi icon={<ShieldCheck size={18} />} label="Nhóm quyền" value={integer.format(rows.length)} tone="green" />
        <MiniKpi icon={<Users size={18} />} label="Tài khoản active" value={integer.format(24)} />
        <MiniKpi icon={<KeyRound size={18} />} label="Quyền nhạy cảm" value={integer.format(6)} tone="amber" />
        <MiniKpi icon={<ArchiveRestore size={18} />} label="Audit gần nhất" value="Hôm nay" tone="blue" />
      </div>
    </ConsoleShell>
  );
}

function SettlementConsole({ orders, totals }: { orders: SpeegoOrderRow[]; totals: Totals }) {
  const baseRows = useMemo(() => settlementRowsFor(orders), [orders]);
  const [approvedCycles, setApprovedCycles] = useState<Set<string>>(() => new Set());
  const rows = baseRows.map((row) => approvedCycles.has(row.cycle) ? { ...row, status: "Đã chốt" } : row);
  return (
    <ConsoleShell tab="settlements">
      <div className="ops-kpi-row">
        <MiniKpi icon={<ReceiptText size={18} />} label="Cần đối soát" value={money.format(orders.length ? orders.reduce((sum, row) => sum + orderAmountVnd(row), 0) : totals.remaining)} tone="amber" />
        <MiniKpi icon={<BadgeDollarSign size={18} />} label="Phí đang giữ" value={orders.length ? "Chưa có" : money.format(24_920_000)} />
        <MiniKpi icon={<PackageCheck size={18} />} label="Kỳ đã chốt" value={integer.format(rows.filter((row) => row.status === "Đã chốt").length)} tone="green" />
        <MiniKpi icon={<PackageSearch size={18} />} label="Đơn lệch phí" value={orders.length ? "Chưa có" : integer.format(7)} tone="blue" />
      </div>
      <section className="ops-panel"><SettlementTable rows={rows} onApprove={(cycle) => setApprovedCycles((current) => new Set([...current, cycle]))} /></section>
    </ConsoleShell>
  );
}

function PayoutConsole({ orders, payments, totals }: { orders: SpeegoOrderRow[]; payments: PaymentRow[]; totals: Totals }) {
  const [released, setReleased] = useState(false);
  const payoutValue = orders.length ? orders.reduce((sum, row) => sum + orderAmountVnd(row), 0) : totals.paid;
  return (
    <ConsoleShell tab="payout">
      <div className="ops-kpi-row">
        <MiniKpi icon={<CreditCard size={18} />} label={released ? "Payout đã đẩy" : "Payout sẵn sàng"} value={money.format(payoutValue)} tone="green" />
        <MiniKpi icon={<BadgeDollarSign size={18} />} label="Đã ghi nhận" value={integer.format(payments.length)} />
        <MiniKpi icon={<ReceiptText size={18} />} label="Chờ ngân hàng" value={orders.length ? "Chưa có" : money.format(54_850_000)} tone="amber" />
        <MiniKpi icon={<ClipboardCheck size={18} />} label="Batch payout" value="PAYOUT-0910" tone="blue" />
      </div>
      <section className="ops-panel">
        <div className="ops-panel-heading"><div><span>Payout batch</span><strong>{released ? "Đã gửi lệnh payout" : "Sẵn sàng gửi lệnh payout"}</strong></div><CreditCard size={20} /></div>
        <div className="ops-action-row"><button className="primary-button" type="button" disabled={released} onClick={() => setReleased(true)}>{released ? "Đã gửi payout" : "Đẩy payout"}</button></div>
        <SettlementTable mode="payout" />
      </section>
    </ConsoleShell>
  );
}

function BackupConsole({ orders, debts, payments, returns }: { orders: SpeegoOrderRow[]; debts: DebtRow[]; payments: PaymentRow[]; returns: ReturnRow[] }) {
  const [lastAction, setLastAction] = useState("Sẵn sàng");
  const sources = [
    { name: "debts", count: debts.length, status: "Realtime" },
    { name: "payments", count: payments.length, status: "Realtime" },
    { name: "returns", count: returns.length, status: "Realtime" },
    { name: "speego", count: orders.length, status: "Realtime" },
  ];
  return (
    <ConsoleShell tab="backup">
      <div className="ops-kpi-row">
        <MiniKpi icon={<DatabaseBackup size={18} />} label="Nguồn sao lưu" value={integer.format(sources.length)} />
        <MiniKpi icon={<ArchiveRestore size={18} />} label="Điểm khôi phục" value={integer.format(12)} tone="green" />
        <MiniKpi icon={<HardDriveIcon />} label="Dung lượng" value="2,4 GB" tone="blue" />
        <MiniKpi icon={<ShieldCheck size={18} />} label="Checksum" value="OK" tone="amber" />
      </div>
      <section className="ops-panel">
        <div className="ops-panel-heading"><div><span>Sao lưu hệ thống</span><strong>{lastAction}</strong></div><DatabaseBackup size={20} /></div>
        <div className="ops-action-row">
          <button className="primary-button" type="button" onClick={() => setLastAction(`Đã tạo bản sao lưu lúc ${new Date().toLocaleTimeString("vi-VN")}`)}>Tạo bản sao lưu</button>
          <button className="secondary-button" type="button" onClick={() => setLastAction("Đã kiểm tra điểm khôi phục gần nhất")}>Kiểm tra khôi phục</button>
        </div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Nguồn dữ liệu</th><th className="number-cell">Bản ghi</th><th>Lịch</th><th>Trạng thái</th></tr></thead>
            <tbody>{sources.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td className="number-cell">{integer.format(row.count)}</td><td>{row.status}</td><td><span className="ops-state">Sẵn sàng</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </ConsoleShell>
  );
}

function AppSettingsConsole() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    "Tự đồng bộ đơn Firestore": true,
    "Ghi nhận mã vận đơn UPS": true,
    "Giữ tồn trước khi pick": true,
    "Khoá xuất lô quá hạn": true,
  });
  const options = [
    { label: "Live Production", value: "Bật", icon: <ShieldCheck size={18} /> },
    { label: "Ngôn ngữ mặc định", value: "VI", icon: <Settings size={18} /> },
    { label: "Quota đơn hàng", value: "8.000/tháng", icon: <PackageSearch size={18} /> },
    { label: "Chu kỳ sync", value: "15 phút", icon: <DatabaseBackup size={18} /> },
  ];
  return (
    <ConsoleShell tab="app_settings">
      <div className="ops-kpi-row">
        {options.map((item, index) => <MiniKpi key={item.label} icon={item.icon} label={item.label} value={item.value} tone={index === 0 ? "green" : index === 3 ? "blue" : "orange"} />)}
      </div>
      <div className="ops-two-column">
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Chế độ vận hành</span><strong>Đơn hàng và kho đang chạy thật</strong></div><Settings size={20} /></div>
          <div className="ops-setting-list">
            {Object.keys(enabled).map((item) => (
              <label key={item} className="ops-switch-row">
                <input type="checkbox" checked={enabled[item]} onChange={() => setEnabled((current) => ({ ...current, [item]: !current[item] }))} />
                <span>{item}</span>
                <small>{enabled[item] ? "Đang bật" : "Tạm tắt"}</small>
              </label>
            ))}
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Thiết lập nhanh</span><strong>Workspace SpeedGo OMS</strong></div><Warehouse size={20} /></div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Cấu hình</th><th>Giá trị</th><th>Trạng thái</th></tr></thead>
              <tbody>
                <tr><td><strong>Module đơn hàng</strong></td><td>/tracking-ups</td><td><span className="ops-state">Giữ nguyên</span></td></tr>
                <tr><td><strong>Kho dữ liệu</strong></td><td>Supabase · speego</td><td><span className="ops-state">Live</span></td></tr>
                <tr><td><strong>Múi giờ</strong></td><td>Asia/Saigon</td><td><span className="ops-state">Đúng</span></td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}

function HelpConsole() {
  const supportRows = [
    { topic: "Theo dõi vận đơn", owner: "Ops", status: "Đang trực" },
    { topic: "Đối soát phí fulfillment", owner: "Finance", status: "Sẵn sàng" },
    { topic: "Vị trí kho và FEFO", owner: "Warehouse", status: "Sẵn sàng" },
    { topic: "Tài khoản và phân quyền", owner: "Admin", status: "Sẵn sàng" },
  ];
  return (
    <ConsoleShell tab="help">
      <div className="ops-two-column">
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Trạng thái hỗ trợ</span><strong>SpeedGo support desk</strong></div><Info size={20} /></div>
          <div className="ops-live-list">
            <p><PackageSearch size={14} /> Đơn UPS đang được giám sát theo tiến độ giao hàng.</p>
            <p><Warehouse size={14} /> Kho ưu tiên pick theo vị trí và hạn sử dụng.</p>
            <p><ReceiptText size={14} /> Tài chính xử lý đối soát và payout theo batch.</p>
            <p><ShieldCheck size={14} /> Quyền truy cập chia theo vai trò vận hành.</p>
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Hàng đợi hỗ trợ</span><strong>{supportRows.length} nhóm nghiệp vụ</strong></div><Users size={20} /></div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Nội dung</th><th>Nhóm phụ trách</th><th>Trạng thái</th></tr></thead>
              <tbody>{supportRows.map((row) => <tr key={row.topic}><td><strong>{row.topic}</strong></td><td>{row.owner}</td><td><span className="ops-state">{row.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}

function ApiIntegrationsConsole() {
  const [checkedAt, setCheckedAt] = useState("");
  const apiRows = [
    { name: "Supabase auth", method: "Session", target: "Người dùng nội bộ", status: "Live" },
    { name: "Bảng đơn UPS", method: "read/write", target: "speego", status: "Live" },
    { name: "Đồng bộ SpeedGo", method: "POST", target: "/api/speego/sync", status: "Giữ nguyên" },
    { name: "UPS bridge", method: "Browser", target: "extension runner", status: "Giữ nguyên" },
  ];
  const webhooks = ["create-manual", "sync-speego", "tracking-ups"];
  return (
    <ConsoleShell tab="api_integrations">
      <div className="ops-kpi-row">
        <MiniKpi icon={<Plug size={18} />} label="Kết nối active" value={integer.format(apiRows.length)} tone="green" />
        <MiniKpi icon={<DatabaseBackup size={18} />} label="Supabase table" value="speego" tone="blue" />
        <MiniKpi icon={<Truck size={18} />} label="Carrier" value="UPS" />
        <MiniKpi icon={<ReceiptText size={18} />} label="Webhook" value={integer.format(webhooks.length)} tone="amber" />
      </div>
      <div className="ops-two-column">
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>API đang dùng</span><strong>{checkedAt || "Giữ nguyên chức năng UPS hiện tại"}</strong></div><Plug size={20} /></div>
          <div className="ops-action-row"><button className="primary-button" type="button" onClick={() => setCheckedAt(`Đã kiểm tra lúc ${new Date().toLocaleTimeString("vi-VN")}`)}>Kiểm tra trạng thái</button></div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Kết nối</th><th>Kiểu</th><th>Đích</th><th>Trạng thái</th></tr></thead>
              <tbody>{apiRows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.method}</td><td>{row.target}</td><td><span className="ops-state">{row.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel-heading"><div><span>Luồng hiện tại</span><strong>Đơn UPS chạy qua hệ thống mình</strong></div><ReceiptText size={20} /></div>
          <div className="api-event-list">
            {webhooks.map((event) => <span key={event}>{event}</span>)}
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}

function PrivacyPolicyConsole() {
  const rows = [
    { item: "Thông tin khách hàng", policy: "Ẩn theo vai trò", status: "Bật" },
    { item: "Token API", policy: "Chỉ lưu server/env", status: "Bật" },
    { item: "Lịch sử vận đơn", policy: "Audit theo đơn", status: "Bật" },
    { item: "Tác vụ tài chính", policy: "Yêu cầu quyền Finance", status: "Bật" },
  ];
  return (
    <ConsoleShell tab="privacy_policy">
      <div className="ops-kpi-row">
        <MiniKpi icon={<FileLock size={18} />} label="Chính sách dữ liệu" value={integer.format(rows.length)} tone="green" />
        <MiniKpi icon={<ShieldCheck size={18} />} label="Quyền theo vai trò" value="RBAC" tone="blue" />
        <MiniKpi icon={<KeyRound size={18} />} label="API secret" value="Ẩn" tone="amber" />
        <MiniKpi icon={<ArchiveRestore size={18} />} label="Audit" value="Live" />
      </div>
      <section className="ops-panel">
        <div className="ops-panel-heading"><div><span>Quyền riêng tư</span><strong>Luồng dữ liệu SpeedGo</strong></div><FileLock size={20} /></div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead><tr><th>Dữ liệu</th><th>Chính sách</th><th>Trạng thái</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.item}><td><strong>{row.item}</strong></td><td>{row.policy}</td><td><span className="ops-state">{row.status}</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </ConsoleShell>
  );
}

function InventoryTable({ mode = "default" }: { mode?: "default" | "expiry" | "combo" }) {
  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead><tr><th>SKU</th><th>Lô</th><th>Vị trí</th><th className="number-cell">Tồn</th><th className="number-cell">Giữ</th><th>{mode === "combo" ? "Combo" : "Hạn dùng"}</th><th>Trạng thái</th></tr></thead>
        <tbody>{inventoryRows.map((row) => <tr key={`${row.sku}-${row.zone}`}><td><strong>{row.sku}</strong></td><td>{row.lot}</td><td>{row.zone}</td><td className="number-cell">{integer.format(row.stock)}</td><td className="number-cell">{integer.format(row.reserved)}</td><td>{mode === "combo" ? "Auto BOM" : formatDate(row.expiry)}</td><td><span className="ops-state">{row.state}</span></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function FulfillmentTable({ rows }: { rows: FulfillmentRow[] }) {
  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Kênh</th><th>Hãng</th><th className="number-cell">Phí</th><th>Trạng thái</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.code}><td><strong>{row.code}</strong></td><td>{row.customer}</td><td>{row.channel}</td><td>{row.carrier}</td><td className="number-cell">{row.feeText || money.format(row.fee)}</td><td><span className="ops-state">{row.status}</span></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function SettlementTable({ mode = "settlement", rows = settlementRows, onApprove }: { mode?: "settlement" | "payout"; rows?: typeof settlementRows; onApprove?: (cycle: string) => void }) {
  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead><tr><th>Kỳ</th><th className="number-cell">Đơn</th><th className="number-cell">Tổng tiền</th><th className="number-cell">{mode === "payout" ? "Payout" : "Phí"}</th><th>Trạng thái</th>{onApprove && <th>Thao tác</th>}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.cycle}><td><strong>{row.cycle}</strong></td><td className="number-cell">{integer.format(row.orders)}</td><td className="number-cell">{money.format(row.gross)}</td><td className="number-cell">{money.format(mode === "payout" ? row.gross - row.fees : row.fees)}</td><td><span className="ops-state">{row.status}</span></td>{onApprove && <td><button className="ops-inline-action" type="button" disabled={row.status === "Đã chốt"} onClick={() => onApprove(row.cycle)}>{row.status === "Đã chốt" ? "Đã chốt" : "Chốt kỳ"}</button></td>}</tr>)}</tbody>
      </table>
    </div>
  );
}

function check(value: boolean) {
  return <span className={`permission-dot ${value ? "on" : "off"}`}>{value ? "✓" : "—"}</span>;
}

function HardDriveIcon() {
  return <DatabaseBackup size={18} />;
}
