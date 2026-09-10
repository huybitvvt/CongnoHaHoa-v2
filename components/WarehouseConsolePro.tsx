"use client";

import React, { useState, useMemo } from "react";
import {
  Boxes,
  Building2,
  ChevronDown,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Edit2,
  FileText,
  Warehouse,
  Truck,
  MapPinned,
  CalendarClock,
  ScanBarcode,
  Layers2,
  PackagePlus,
  PackageMinus,
  Archive,
  ArrowRightLeft,
  X,
} from "lucide-react";
import type { SpeegoOrderRow, DebtRow } from "@/lib/types";

export type WarehouseSubTab = "inventory" | "inbound" | "outbound" | "products";

interface WarehouseConsoleProProps {
  orders?: SpeegoOrderRow[];
  debts?: DebtRow[];
  lang?: "vi" | "en";
  initialSubTab?: WarehouseSubTab;
  onSubTabChange?: (tab: WarehouseSubTab) => void;
}

// -----------------------------------------------------------------------------
// Real Data Catalog matching SpeeGo System (19 Products)
// -----------------------------------------------------------------------------
const REAL_PRODUCTS_CATALOG = [
  { id: "p-1", name: "Baku Cream", sku: "BakuCr", staff: "Công ty", price: "25,00 US$", status: "active", stock: 9929, available: 9929, minStock: 200, category: "Mỹ phẩm", initialLetter: "B" },
  { id: "p-2", name: "Baku Serum", sku: "BakuSr", staff: "Công ty", price: "25,00 US$", status: "active", stock: 19640, available: 19640, minStock: 200, category: "Mỹ phẩm", initialLetter: "B" },
  { id: "p-3", name: "Bình nước", sku: "Binh", staff: "Công ty", price: "25,00 US$", status: "active", stock: 10160, available: 10160, minStock: 200, category: "Phụ kiện", initialLetter: "B" },
  { id: "p-4", name: "Bona Cafe", sku: "Bon", staff: "Công ty", price: "25,00 US$", status: "active", stock: 14765, available: 14765, minStock: 200, category: "Thực phẩm", initialLetter: "B" },
  { id: "p-5", name: "Bona Slim", sku: "BonS", staff: "Công ty", price: "25,00 US$", status: "active", stock: 10107, available: 10107, minStock: 200, category: "Thực phẩm", initialLetter: "B" },
  { id: "p-6", name: "Dán Kinoki", sku: "Dan", staff: "Công ty", price: "25,00 US$", status: "active", stock: 12885, available: 12885, minStock: 200, category: "Chăm sóc sức khỏe", initialLetter: "D" },
  { id: "p-7", name: "Dầu Dưỡng Tóc", sku: "DDT", staff: "Công ty", price: "25,00 US$", status: "active", stock: 18972, available: 18972, minStock: 200, category: "Chăm sóc tóc", initialLetter: "D" },
  { id: "p-8", name: "Dầu Gội", sku: "DG", staff: "Công ty", price: "25,00 US$", status: "active", stock: 18700, available: 18700, minStock: 200, category: "Chăm sóc tóc", initialLetter: "D" },
  { id: "p-9", name: "Dragon Cream", sku: "DraCr", staff: "Công ty", price: "25,00 US$", status: "active", stock: 19318, available: 19318, minStock: 200, category: "Mỹ phẩm", initialLetter: "D" },
  { id: "p-10", name: "Fitgum Acai", sku: "FitA", staff: "Công ty", price: "25,00 US$", status: "active", stock: 17263, available: 17263, minStock: 200, category: "Thực phẩm", initialLetter: "F" },
  { id: "p-11", name: "Red Lava", sku: "Red", staff: "Công ty", price: "25,00 US$", status: "active", stock: 9159, available: 9159, minStock: 200, category: "Mỹ phẩm", initialLetter: "R" },
  { id: "p-12", name: "Serum Gold 24k", sku: "Gold24", staff: "Công ty", price: "30,00 US$", status: "active", stock: 15420, available: 15420, minStock: 200, category: "Mỹ phẩm", initialLetter: "S" },
  { id: "p-13", name: "Kem Nám Melasma", sku: "Melas", staff: "Công ty", price: "28,00 US$", status: "active", stock: 11200, available: 11200, minStock: 200, category: "Mỹ phẩm", initialLetter: "K" },
  { id: "p-14", name: "Trà Giảm Cân Detox", sku: "DetoxT", staff: "Công ty", price: "18,00 US$", status: "active", stock: 8900, available: 8900, minStock: 200, category: "Thực phẩm", initialLetter: "T" },
  { id: "p-15", name: "Sữa Rửa Mặt BHA", sku: "SrmBHA", staff: "Công ty", price: "22,00 US$", status: "active", stock: 14350, available: 14350, minStock: 200, category: "Mỹ phẩm", initialLetter: "S" },
  { id: "p-16", name: "Kem Chống Nắng SPF50", sku: "Sun50", staff: "Công ty", price: "26,00 US$", status: "active", stock: 16800, available: 16800, minStock: 200, category: "Mỹ phẩm", initialLetter: "K" },
  { id: "p-17", name: "Mặt Nạ Nhau Thai Cừu", sku: "MskPlac", staff: "Công ty", price: "15,00 US$", status: "active", stock: 24648, available: 24648, minStock: 200, category: "Mỹ phẩm", initialLetter: "M" },
  { id: "p-18", name: "Tinh Chất Phục Hồi B5", sku: "SerB5", staff: "Công ty", price: "27,00 US$", status: "active", stock: 13900, available: 13900, minStock: 200, category: "Mỹ phẩm", initialLetter: "T" },
  { id: "p-19", name: "Xịt Khoáng Cấp Ẩm", sku: "MistHyd", staff: "Công ty", price: "19,00 US$", status: "active", stock: 12450, available: 12450, minStock: 200, category: "Mỹ phẩm", initialLetter: "X" },
];

// Real Inventory Table Rows matching Screenshot 2 (Texas & California Warehouses)
const REAL_INVENTORY_ROWS = [
  { id: "inv-1", warehouse: "Texas - Warehouse", type: "Tổng", product: "Dán Kinoki", sku: "Dan", stock: 2885, reserved: 0, available: 2885, minStock: 200, status: "Đủ hàng", updatedAt: "16:45 9 thg 9, 2026" },
  { id: "inv-2", warehouse: "Texas - Warehouse", type: "Tổng", product: "Fitgum Acai", sku: "FitA", stock: 17263, reserved: 0, available: 17263, minStock: 200, status: "Đủ hàng", updatedAt: "17:25 8 thg 9, 2026" },
  { id: "inv-3", warehouse: "Texas - Warehouse", type: "Tổng", product: "Red Lava", sku: "Red", stock: 9159, reserved: 0, available: 9159, minStock: 200, status: "Đủ hàng", updatedAt: "17:25 8 thg 9, 2026" },
  { id: "inv-4", warehouse: "Texas - Warehouse", type: "Tổng", product: "Dầu Gội", sku: "DG", stock: 8830, reserved: 0, available: 8830, minStock: 200, status: "Đủ hàng", updatedAt: "17:25 8 thg 9, 2026" },
  { id: "inv-5", warehouse: "Texas - Warehouse", type: "Tổng", product: "Dầu Dưỡng Tóc", sku: "DDT", stock: 8948, reserved: 0, available: 8948, minStock: 200, status: "Đủ hàng", updatedAt: "17:25 8 thg 9, 2026" },
  { id: "inv-6", warehouse: "Texas - Warehouse", type: "Tổng", product: "Bình nước", sku: "Binh", stock: 9960, reserved: 0, available: 9960, minStock: 200, status: "Đủ hàng", updatedAt: "17:25 8 thg 9, 2026" },
  { id: "inv-7", warehouse: "California - Warehouse", type: "Tổng", product: "Bona Cafe", sku: "Bon", stock: 9059, reserved: 0, available: 9059, minStock: 200, status: "Đủ hàng", updatedAt: "12:56 8 thg 9, 2026" },
  { id: "inv-8", warehouse: "Texas - Warehouse", type: "Tổng", product: "Dragon Cream", sku: "DraCr", stock: 9573, reserved: 0, available: 9573, minStock: 200, status: "Đủ hàng", updatedAt: "11:11 7 thg 9, 2026" },
  { id: "inv-9", warehouse: "Texas - Warehouse", type: "Tổng", product: "Bona Cafe", sku: "Bon", stock: 5706, reserved: 0, available: 5706, minStock: 200, status: "Đủ hàng", updatedAt: "11:10 7 thg 9, 2026" },
  { id: "inv-10", warehouse: "Texas - Warehouse", type: "Tổng", product: "Baku Serum", sku: "BakuSr", stock: 9820, reserved: 0, available: 9820, minStock: 200, status: "Đủ hàng", updatedAt: "11:10 7 thg 9, 2026" },
  { id: "inv-11", warehouse: "California - Warehouse", type: "Tổng", product: "Baku Serum", sku: "BakuSr", stock: 9820, reserved: 0, available: 9820, minStock: 200, status: "Đủ hàng", updatedAt: "11:10 7 thg 9, 2026" },
  { id: "inv-12", warehouse: "Texas - Warehouse", type: "Tổng", product: "Baku Cream", sku: "BakuCr", stock: 5000, reserved: 0, available: 5000, minStock: 200, status: "Đủ hàng", updatedAt: "11:10 7 thg 9, 2026" },
  { id: "inv-13", warehouse: "California - Warehouse", type: "Tổng", product: "Baku Cream", sku: "BakuCr", stock: 4929, reserved: 0, available: 4929, minStock: 200, status: "Đủ hàng", updatedAt: "11:10 7 thg 9, 2026" },
  { id: "inv-14", warehouse: "California - Warehouse", type: "Tổng", product: "Dragon Cream", sku: "DraCr", stock: 9745, reserved: 0, available: 9745, minStock: 200, status: "Đủ hàng", updatedAt: "11:10 7 thg 9, 2026" },
  { id: "inv-15", warehouse: "Texas - Warehouse", type: "Tổng", product: "Bona Slim", sku: "BonS", stock: 6107, reserved: 0, available: 6107, minStock: 200, status: "Đủ hàng", updatedAt: "11:10 7 thg 9, 2026" },
];

const REAL_WAREHOUSES_LIST = [
  { id: "wh-1", name: "Texas - Warehouse", code: "WH-TX", type: "Tổng", location: "Grand Prairie, TX 75050, US", totalStock: 168189, ratio: "61,8%", skus: 19, status: "Hoạt động" },
  { id: "wh-2", name: "California - Warehouse", code: "WH-CA", type: "Tổng", location: "City of Industry, CA 91789, US", totalStock: 103833, ratio: "38,2%", skus: 17, status: "Hoạt động" },
];

// Preserved Operational Data from Screenshot 1
const ORIGINAL_OPS_INVENTORY = [
  { sku: "SG-FMCG-001", lot: "LOT-A", zone: "A-03-02-05", stock: 1260, reserved: 312, expiry: "09/10/2026", state: "Ưu tiên xuất" },
  { sku: "SG-ELEC-142", lot: "IMEI", zone: "B-04-01-12", stock: 84, reserved: 18, expiry: "18/02/2027", state: "Serial bắt buộc" },
  { sku: "SG-BEAUTY-CMB", lot: "COMBO-C", zone: "C-01-03-08", stock: 210, reserved: 42, expiry: "31/12/2026", state: "Tự rã combo" },
  { sku: "SG-DRY-024", lot: "LOT-B", zone: "A-02-05-01", stock: 486, reserved: 96, expiry: "20/09/2026", state: "Sắp hết hạn" },
];

export function WarehouseConsolePro({
  orders = [],
  debts = [],
  lang = "vi",
  initialSubTab = "inventory",
  onSubTabChange,
}: WarehouseConsoleProProps) {
  const [subTab, setSubTab] = useState<WarehouseSubTab>(initialSubTab);
  const [invActiveTab, setInvActiveTab] = useState<"stock" | "warehouses" | "operations">("stock");
  const [productActiveTab, setProductActiveTab] = useState<"list" | "categories" | "channels">("list");
  const [productFilterPill, setProductFilterPill] = useState<"all" | "pending" | "selling" | "archived">("all");

  // Filters & Search
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [stockLevelFilter, setStockLevelFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<"add_inbound" | "add_outbound" | "add_warehouse" | "transfer" | "add_product">("add_inbound");

  React.useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  return (
    <div className="warehouse-console-pro">
      {/* Subview 1: Tồn kho (Screenshot 2) & Vận hành số hóa (Screenshot 1) */}
      {subTab === "inventory" && (
        <InventorySubView
          invActiveTab={invActiveTab}
          onInvActiveTabChange={setInvActiveTab}
          warehouseFilter={warehouseFilter}
          onWarehouseFilterChange={setWarehouseFilter}
          productFilter={productFilter}
          onProductFilterChange={setProductFilter}
          stockLevelFilter={stockLevelFilter}
          onStockLevelFilterChange={setStockLevelFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenModal={(kind: "add_warehouse" | "transfer") => {
            setModalKind(kind);
            setModalOpen(true);
          }}
          lang={lang}
        />
      )}

      {/* Subview 2: Nhập kho (Screenshot 3) */}
      {subTab === "inbound" && (
        <InboundSubView
          lang={lang}
          onOpenModal={() => {
            setModalKind("add_inbound");
            setModalOpen(true);
          }}
        />
      )}

      {/* Subview 3: Xuất kho (Screenshot 4) */}
      {subTab === "outbound" && (
        <OutboundSubView
          lang={lang}
          onOpenModal={() => {
            setModalKind("add_outbound");
            setModalOpen(true);
          }}
        />
      )}

      {/* Subview 4: Sản phẩm (Screenshot 5) */}
      {subTab === "products" && (
        <ProductsSubView
          productActiveTab={productActiveTab}
          onProductActiveTabChange={setProductActiveTab}
          productFilterPill={productFilterPill}
          onProductFilterPillChange={setProductFilterPill}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          lang={lang}
          onOpenModal={() => {
            setModalKind("add_product");
            setModalOpen(true);
          }}
        />
      )}

      {/* Warehouse Modals */}
      {modalOpen && (
        <div className="speego-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="speego-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{lang === "en" ? "WAREHOUSE MANAGEMENT" : "HỆ THỐNG KHO"}</p>
                <h2>
                  {modalKind === "add_inbound"
                    ? (lang === "en" ? "Create Inbound Receipt" : "Tạo phiếu nhập kho")
                    : modalKind === "add_outbound"
                    ? (lang === "en" ? "Create Outbound Dispatch" : "Tạo phiếu xuất kho")
                    : modalKind === "add_warehouse"
                    ? (lang === "en" ? "Add New Warehouse" : "Thêm kho hàng mới")
                    : modalKind === "transfer"
                    ? (lang === "en" ? "Transfer Between Warehouses" : "Chuyển kho hàng")
                    : (lang === "en" ? "Add New Product" : "Thêm sản phẩm mới")}
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
              {modalKind === "add_inbound" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label className="field">
                    <span>Kho nhận hàng</span>
                    <select>
                      <option>Texas - Warehouse</option>
                      <option>California - Warehouse</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Mã vận đơn / Tracking gốc</span>
                    <input placeholder="VD: 1Z9999999999999999" />
                  </label>
                  <label className="field">
                    <span>Chọn sản phẩm nhập</span>
                    <select>
                      {REAL_PRODUCTS_CATALOG.map((p) => (
                        <option key={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Số lượng kiện / đơn vị</span>
                    <input type="number" placeholder="VD: 500" />
                  </label>
                  <button
                    className="primary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      alert("Phiếu nhập kho đã được tạo thành công.");
                      setModalOpen(false);
                    }}
                  >
                    Tạo phiếu nhập
                  </button>
                </div>
              )}

              {modalKind === "add_outbound" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label className="field">
                    <span>Kho xuất hàng</span>
                    <select>
                      <option>Texas - Warehouse</option>
                      <option>California - Warehouse</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Hình thức xuất</span>
                    <select>
                      <option>Gắn đơn hàng (Tự động)</option>
                      <option>Xuất tay (Manual)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Sản phẩm xuất</span>
                    <select>
                      {REAL_PRODUCTS_CATALOG.map((p) => (
                        <option key={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Số lượng</span>
                    <input type="number" placeholder="VD: 100" />
                  </label>
                  <button
                    className="primary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      alert("Phiếu xuất kho đã được lưu.");
                      setModalOpen(false);
                    }}
                  >
                    Xác nhận xuất
                  </button>
                </div>
              )}

              {modalKind === "add_warehouse" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label className="field">
                    <span>Tên kho</span>
                    <input placeholder="VD: New York - Warehouse" />
                  </label>
                  <label className="field">
                    <span>Mã kho</span>
                    <input placeholder="VD: WH-NY" />
                  </label>
                  <label className="field">
                    <span>Địa chỉ</span>
                    <input placeholder="VD: Brooklyn, NY 11201, US" />
                  </label>
                  <button
                    className="primary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      alert("Đã thêm kho mới.");
                      setModalOpen(false);
                    }}
                  >
                    Lưu thông tin kho
                  </button>
                </div>
              )}

              {modalKind === "transfer" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label className="field">
                    <span>Từ kho</span>
                    <select><option>Texas - Warehouse</option></select>
                  </label>
                  <label className="field">
                    <span>Đến kho</span>
                    <select><option>California - Warehouse</option></select>
                  </label>
                  <label className="field">
                    <span>Sản phẩm</span>
                    <select>
                      {REAL_PRODUCTS_CATALOG.map((p) => (
                        <option key={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Số lượng chuyển</span>
                    <input type="number" placeholder="VD: 250" />
                  </label>
                  <button
                    className="primary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      alert("Đã tạo lệnh điều chuyển kho.");
                      setModalOpen(false);
                    }}
                  >
                    Thực hiện chuyển kho
                  </button>
                </div>
              )}

              {modalKind === "add_product" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label className="field">
                    <span>Tên sản phẩm</span>
                    <input placeholder="VD: Kem Dưỡng Ẩm Vitamin C" />
                  </label>
                  <label className="field">
                    <span>Mã SKU</span>
                    <input placeholder="VD: VitC-Cream" />
                  </label>
                  <label className="field">
                    <span>Giá niêm yết (USD)</span>
                    <input placeholder="25.00" type="number" step="0.01" />
                  </label>
                  <label className="field">
                    <span>Tồn tối thiểu</span>
                    <input placeholder="200" type="number" />
                  </label>
                  <button
                    className="primary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      alert("Đã thêm sản phẩm mới vào catalog.");
                      setModalOpen(false);
                    }}
                  >
                    Lưu sản phẩm
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
// SUBVIEW 1: Tồn kho (Screenshot 2) + Vận hành số hóa (Screenshot 1)
// -----------------------------------------------------------------------------
function InventorySubView({
  invActiveTab,
  onInvActiveTabChange,
  warehouseFilter,
  onWarehouseFilterChange,
  productFilter,
  onProductFilterChange,
  stockLevelFilter,
  onStockLevelFilterChange,
  searchQuery,
  onSearchChange,
  onOpenModal,
  lang,
}: any) {
  const filteredInventory = useMemo(() => {
    return REAL_INVENTORY_ROWS.filter((item) => {
      if (warehouseFilter !== "all" && item.warehouse !== warehouseFilter) return false;
      if (productFilter !== "all" && item.product !== productFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.warehouse.toLowerCase().includes(q) ||
          item.product.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [warehouseFilter, productFilter, searchQuery]);

  return (
    <div className="warehouse-view-pane">
      {/* Top Header Row */}
      <div className="wh-header-row">
        <div>
          <h2 className="wh-pane-title">
            {lang === "en" ? "Warehouse system" : "Hệ thống kho"}
          </h2>
          <p className="wh-pane-subtitle">
            {lang === "en"
              ? "Stock balance and warehouse list of company catalog."
              : "Số dư tồn và danh sách kho của catalog công ty."}
          </p>
        </div>

        {/* Top Right Action Buttons (Screenshot 2) */}
        <div className="wh-header-actions-group">
          <button type="button" className="wh-btn-workbook">
            <FileText size={15} />
            <span>Workbook</span>
          </button>
          <button type="button" className="wh-btn-action">
            <Download size={15} />
            <span>{lang === "en" ? "Export" : "Xuất"}</span>
          </button>
          <button type="button" className="wh-btn-action">
            <Upload size={15} />
            <span>{lang === "en" ? "Import" : "Nhập"}</span>
          </button>
          <button type="button" className="wh-btn-action" onClick={() => onOpenModal("add_warehouse")}>
            <Building2 size={15} />
            <span>{lang === "en" ? "Add warehouse" : "Thêm kho"}</span>
          </button>
          <button type="button" className="wh-btn-action" onClick={() => onOpenModal("transfer")}>
            <ArrowRightLeft size={15} />
            <span>{lang === "en" ? "Transfer" : "Chuyển kho"}</span>
          </button>
          <button type="button" className="wh-refresh-icon-btn" title="Làm mới">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tabs under Header: [ Tồn kho 31 ] [ Kho 2 ] [ ⚡ Vận hành số hóa (Rack/FEFO) ] */}
      <div className="wh-tabs-row">
        <div className="wh-tab-pills">
          <button
            type="button"
            className={`wh-tab-pill ${invActiveTab === "stock" ? "active" : ""}`}
            onClick={() => onInvActiveTabChange("stock")}
          >
            <Boxes size={15} />
            <span>{lang === "en" ? "Inventory" : "Tồn kho"}</span>
            <b className="pill-count">31</b>
          </button>
          <button
            type="button"
            className={`wh-tab-pill ${invActiveTab === "warehouses" ? "active" : ""}`}
            onClick={() => onInvActiveTabChange("warehouses")}
          >
            <Warehouse size={15} />
            <span>{lang === "en" ? "Warehouses" : "Kho"}</span>
            <b className="pill-count">2</b>
          </button>
          <button
            type="button"
            className={`wh-tab-pill ${invActiveTab === "operations" ? "active" : ""}`}
            onClick={() => onInvActiveTabChange("operations")}
          >
            <Layers2 size={15} />
            <span>{lang === "en" ? "Digital Ops (Rack / FEFO)" : "Vận hành số hóa (Rack / FEFO)"}</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: Inventory Table (Screenshot 2) */}
      {invActiveTab === "stock" && (
        <>
          {/* Dropdown Filters & Search */}
          <div className="wh-toolbar-row">
            <div className="wh-dropdown-filters">
              <div className="wh-select-wrapper">
                <Warehouse size={14} />
                <select
                  value={warehouseFilter}
                  onChange={(e) => onWarehouseFilterChange(e.target.value)}
                >
                  <option value="all">{lang === "en" ? "All warehouses" : "Tất cả kho"}</option>
                  <option value="Texas - Warehouse">Texas - Warehouse</option>
                  <option value="California - Warehouse">California - Warehouse</option>
                </select>
                <ChevronDown size={14} className="wh-select-caret" />
              </div>

              <div className="wh-select-wrapper">
                <FileText size={14} />
                <select
                  value={productFilter}
                  onChange={(e) => onProductFilterChange(e.target.value)}
                >
                  <option value="all">{lang === "en" ? "All products" : "Tất cả sản phẩm"}</option>
                  {REAL_PRODUCTS_CATALOG.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="wh-select-caret" />
              </div>

              <div className="wh-select-wrapper">
                <span className="dot-circle" />
                <select
                  value={stockLevelFilter}
                  onChange={(e) => onStockLevelFilterChange(e.target.value)}
                >
                  <option value="all">{lang === "en" ? "All stock levels" : "Tất cả mức tồn"}</option>
                  <option value="in_stock">{lang === "en" ? "In stock" : "Đủ hàng"}</option>
                  <option value="low_stock">{lang === "en" ? "Low stock" : "Sắp hết hàng"}</option>
                  <option value="out_stock">{lang === "en" ? "Out of stock" : "Hết hàng"}</option>
                </select>
                <ChevronDown size={14} className="wh-select-caret" />
              </div>
            </div>

            <div className="wh-search-box">
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={
                  lang === "en"
                    ? "Search by staff, warehouse, product..."
                    : "Tìm theo nhân viên, kho, sản phẩm..."
                }
              />
              <button
                type="button"
                className="wh-clear-search-btn"
                onClick={() => onSearchChange("")}
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="wh-table-card">
            <table className="wh-data-table">
              <thead>
                <tr>
                  <th>{lang === "en" ? "WAREHOUSE" : "KHO"}</th>
                  <th>{lang === "en" ? "TYPE" : "LOẠI KHO"}</th>
                  <th>{lang === "en" ? "PRODUCT" : "SẢN PHẨM"}</th>
                  <th className="num-th">{lang === "en" ? "STOCK" : "TỒN"}</th>
                  <th className="num-th">{lang === "en" ? "RESERVED" : "GIỮ"}</th>
                  <th className="num-th">{lang === "en" ? "AVAILABLE" : "KHẢ DỤNG"}</th>
                  <th className="num-th">{lang === "en" ? "MIN STOCK" : "TỒN TỐI THIỂU"}</th>
                  <th>{lang === "en" ? "STOCK STATUS" : "TRẠNG THÁI TỒN"}</th>
                  <th>{lang === "en" ? "UPDATED" : "CẬP NHẬT"}</th>
                  <th>{lang === "en" ? "ACTIONS" : "THAO TÁC"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="wh-name-cell">
                        <Warehouse size={15} className="wh-icon" />
                        <span>{row.warehouse}</span>
                      </div>
                    </td>
                    <td>
                      <span className="wh-type-badge">
                        <Building2 size={12} />
                        <span>{row.type}</span>
                      </span>
                    </td>
                    <td>
                      <div className="wh-product-cell">
                        <strong>{row.product}</strong>
                        <small>{row.sku}</small>
                      </div>
                    </td>
                    <td className="num-td">{row.stock.toLocaleString("vi-VN")}</td>
                    <td className="num-td">{row.reserved}</td>
                    <td className="num-td">
                      <span className="wh-available-badge">
                        {row.available.toLocaleString("vi-VN")}
                      </span>
                    </td>
                    <td className="num-td">{row.minStock}</td>
                    <td>
                      <span className="wh-status-pill green">
                        <span className="dot" />
                        <span>{row.status}</span>
                      </span>
                    </td>
                    <td className="wh-date-cell">{row.updatedAt}</td>
                    <td>
                      <div className="wh-row-actions">
                        <button type="button" className="wh-table-btn" title="Nhập">
                          <Upload size={13} />
                          <span>{lang === "en" ? "In" : "Nhập"}</span>
                        </button>
                        <button type="button" className="wh-table-btn" title="Xuất">
                          <Download size={13} />
                          <span>{lang === "en" ? "Out" : "Xuất"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB CONTENT 2: Warehouses List */}
      {invActiveTab === "warehouses" && (
        <div className="wh-grid-warehouses">
          {REAL_WAREHOUSES_LIST.map((wh) => (
            <div key={wh.id} className="wh-detail-card">
              <div className="wh-card-head">
                <div className="wh-card-title-box">
                  <div className="wh-avatar-icon">
                    <Warehouse size={22} />
                  </div>
                  <div>
                    <h3>{wh.name}</h3>
                    <p>{wh.location}</p>
                  </div>
                </div>
                <span className="wh-status-pill green">
                  <span className="dot" />
                  <span>{wh.status}</span>
                </span>
              </div>

              <div className="wh-card-stats-grid">
                <div className="stat-box">
                  <span>Mã kho</span>
                  <strong>{wh.code}</strong>
                </div>
                <div className="stat-box">
                  <span>Loại kho</span>
                  <strong>{wh.type}</strong>
                </div>
                <div className="stat-box">
                  <span>Tổng tồn</span>
                  <strong style={{ color: "#ea580c" }}>{wh.totalStock.toLocaleString("vi-VN")} sp</strong>
                </div>
                <div className="stat-box">
                  <span>Tỉ trọng</span>
                  <strong style={{ color: "#22c55e" }}>{wh.ratio}</strong>
                </div>
              </div>

              <div className="wh-card-foot">
                <small>{wh.skus} SKU đang lưu kho</small>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" className="wh-table-btn">
                    <Edit2 size={13} /> Sửa
                  </button>
                  <button type="button" className="wh-table-btn">
                    <ArrowRightLeft size={13} /> Chuyển tồn
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT 3: Preserved Digital Operations UI (Screenshot 1) */}
      {invActiveTab === "operations" && (
        <div className="wh-operations-preserved">
          {/* 4 Mini KPIs */}
          <div className="ops-kpi-row">
            <div className="mini-kpi-card">
              <div className="kpi-icon-wrap"><Boxes size={18} /></div>
              <div>
                <p>SKU đang quản lý</p>
                <strong>1.664</strong>
              </div>
            </div>
            <div className="mini-kpi-card">
              <div className="kpi-icon-wrap green"><PackagePlus size={18} /></div>
              <div>
                <p>Tồn khả dụng</p>
                <strong style={{ color: "#22c55e" }}>1.572</strong>
              </div>
            </div>
            <div className="mini-kpi-card">
              <div className="kpi-icon-wrap amber"><PackageMinus size={18} /></div>
              <div>
                <p>Đã giữ hàng</p>
                <strong style={{ color: "#f59e0b" }}>468</strong>
              </div>
            </div>
            <div className="mini-kpi-card">
              <div className="kpi-icon-wrap blue"><MapPinned size={18} /></div>
              <div>
                <p>Vị trí đã số hóa</p>
                <strong style={{ color: "#3b82f6" }}>4.386 / 7.643</strong>
              </div>
            </div>
          </div>

          {/* 4 Sub-module Cards */}
          <div className="ops-module-grid">
            <a href="/vi-tri-kho" className="ops-module-card">
              <MapPinned size={20} />
              <span>Vị trí kho</span>
              <strong>Rack / dãy / ô</strong>
            </a>
            <a href="/han-su-dung" className="ops-module-card">
              <CalendarClock size={20} />
              <span>Hạn sử dụng</span>
              <strong>FEFO</strong>
            </a>
            <a href="/serial-imei-batch" className="ops-module-card">
              <ScanBarcode size={20} />
              <span>Serial / IMEI / Batch</span>
              <strong>Barcode</strong>
            </a>
            <a href="/combo-hang" className="ops-module-card">
              <Layers2 size={20} />
              <span>Combo hàng</span>
              <strong>Auto BOM</strong>
            </a>
          </div>

          {/* Bottom 2 Columns: Rack A,B,C Table and Picking Routing */}
          <div className="ops-two-column">
            <section className="ops-panel">
              <div className="ops-panel-heading">
                <div>
                  <span>Kho tổng</span>
                  <strong>Rack A, B, C đang hoạt động</strong>
                </div>
                <Warehouse size={20} />
              </div>
              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>LÔ</th>
                      <th>VỊ TRÍ</th>
                      <th>TỒN</th>
                      <th>GIỮ</th>
                      <th>HẠN DÙNG</th>
                      <th>TRẠNG THÁI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ORIGINAL_OPS_INVENTORY.map((row) => (
                      <tr key={row.sku}>
                        <td><strong>{row.sku}</strong></td>
                        <td>{row.lot}</td>
                        <td>{row.zone}</td>
                        <td className="number-cell">{row.stock}</td>
                        <td className="number-cell">{row.reserved}</td>
                        <td>{row.expiry}</td>
                        <td><span className="ops-state">{row.state}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="ops-panel">
              <div className="ops-panel-heading">
                <div>
                  <span>Picking routing</span>
                  <strong>{"A-03-02-05 -> B-04-01-12"}</strong>
                </div>
                <Truck size={20} />
              </div>
              <div className="ops-route-map">
                {["Inbound", "Rack A", "Rack B", "Pack", "Handoff"].map((item, index) => (
                  <span key={item} className={index === 2 ? "active" : ""}>
                    {item}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUBVIEW 2: Nhập kho (Screenshot 3)
// -----------------------------------------------------------------------------
function InboundSubView({ lang, onOpenModal }: any) {
  return (
    <div className="warehouse-view-pane">
      {/* Header */}
      <div className="wh-header-row">
        <div>
          <h2 className="wh-pane-title">
            {lang === "en" ? "Inbound" : "Nhập kho"}
          </h2>
          <p className="wh-pane-subtitle">
            {lang === "en"
              ? "Create inbound receipts and receive into inventory when tracking is delivered."
              : "Tạo phiếu nhập và nhận vào tồn khi tracking đã giao."}
          </p>
        </div>

        <div className="wh-header-actions-group">
          <button type="button" className="wh-create-btn" onClick={onOpenModal}>
            <Plus size={16} />
            <span>{lang === "en" ? "Inbound" : "Nhập"}</span>
          </button>
          <button type="button" className="wh-refresh-icon-btn" title="Làm mới">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 4 KPI Cards (Screenshot 3) */}
      <div className="wh-kpi-grid-4">
        <div className="wh-kpi-card">
          <span className="kpi-label">{lang === "en" ? "Inbound today" : "Nhập trong ngày"}</span>
          <strong className="kpi-value">0</strong>
          <small className="kpi-sub">0 {lang === "en" ? "units" : "đơn vị"}</small>
        </div>

        <div className="wh-kpi-card">
          <span className="kpi-label">{lang === "en" ? "Open receipts" : "Phiếu nhập mở"}</span>
          <strong className="kpi-value">0</strong>
          <small className="kpi-sub">0 {lang === "en" ? "units" : "đơn vị"}</small>
        </div>

        <div className="wh-kpi-card">
          <span className="kpi-label">{lang === "en" ? "In transit" : "Đang giao"}</span>
          <strong className="kpi-value">0</strong>
          <small className="kpi-sub">0 {lang === "en" ? "units" : "đơn vị"}</small>
        </div>

        <div className="wh-kpi-card">
          <span className="kpi-label">{lang === "en" ? "Ready to receive" : "Sẵn sàng nhận"}</span>
          <strong className="kpi-value">0</strong>
          <small className="kpi-sub">0 {lang === "en" ? "units" : "đơn vị"}</small>
        </div>
      </div>

      {/* 2 Visual Cards (Screenshot 3) */}
      <div className="wh-two-charts-row">
        {/* Left: Nhập theo thời gian */}
        <section className="wh-chart-panel">
          <div className="wh-panel-head">
            <div>
              <h3>{lang === "en" ? "Inbound over time" : "Nhập theo thời gian"}</h3>
              <p>{lang === "en" ? "Units received per day (by warehouse and product filter)." : "Số đơn vị nhập mỗi ngày (theo bộ lọc kho và sản phẩm)."}</p>
            </div>
            <div className="wh-mini-period-tag">
              <span>{lang === "en" ? "This month" : "Tháng này"}</span>
              <ChevronDown size={13} />
            </div>
          </div>

          <div className="wh-chart-svg-wrap">
            <svg viewBox="0 0 420 180" className="wh-chart-svg">
              <line x1="30" y1="25" x2="410" y2="25" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="30" y1="65" x2="410" y2="65" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="30" y1="105" x2="410" y2="105" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="30" y1="145" x2="410" y2="145" stroke="#2c221e" strokeDasharray="3 3" />

              <text x="22" y="29" className="chart-axis-text" textAnchor="end">12</text>
              <text x="22" y="69" className="chart-axis-text" textAnchor="end">9</text>
              <text x="22" y="109" className="chart-axis-text" textAnchor="end">6</text>
              <text x="22" y="149" className="chart-axis-text" textAnchor="end">0</text>

              <path
                d="M 40 145 L 120 145 L 200 145 L 280 145 L 340 45 L 380 145 L 400 145 L 400 145 L 40 145 Z"
                fill="rgba(234, 88, 12, 0.15)"
              />
              <path
                d="M 40 145 L 120 145 L 200 145 L 280 145 L 340 45 L 380 145 L 400 145"
                fill="none"
                stroke="#ea580c"
                strokeWidth="2.5"
              />
              <circle cx="340" cy="45" r="4" fill="#ea580c" />
              <circle cx="280" cy="145" r="3" fill="#ea580c" />
              <circle cx="380" cy="145" r="3" fill="#ea580c" />

              <text x="40" y="166" className="chart-axis-text" textAnchor="middle">1 thg 9</text>
              <text x="120" y="166" className="chart-axis-text" textAnchor="middle">3 thg 9</text>
              <text x="200" y="166" className="chart-axis-text" textAnchor="middle">6 thg 9</text>
              <text x="340" y="166" className="chart-axis-text" textAnchor="middle">8 thg 9</text>
              <text x="400" y="166" className="chart-axis-text" textAnchor="middle">10 thg</text>
            </svg>
          </div>
        </section>

        {/* Right: Cơ cấu phiếu nhập mở */}
        <section className="wh-chart-panel">
          <div className="wh-panel-head">
            <div>
              <h3>{lang === "en" ? "Open receipts breakdown" : "Cơ cấu phiếu nhập mở"}</h3>
            </div>
          </div>

          <div className="wh-empty-donut-wrap">
            <div className="wh-empty-donut-box">
              <strong className="empty-donut-number">0</strong>
              <span className="empty-donut-label">{lang === "en" ? "Open receipts" : "Phiếu nhập mở"}</span>
            </div>

            <div className="wh-donut-legend">
              <div className="legend-row">
                <i className="legend-dot dot-blue" />
                <span>{lang === "en" ? "Ready to receive" : "Sẵn sàng nhận"} 0 (0%)</span>
              </div>
              <div className="legend-row">
                <i className="legend-dot dot-orange" />
                <span>{lang === "en" ? "In transit" : "Đang giao"} 0 (0%)</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUBVIEW 3: Xuất kho (Screenshot 4)
// -----------------------------------------------------------------------------
function OutboundSubView({ lang, onOpenModal }: any) {
  return (
    <div className="warehouse-view-pane">
      {/* Header */}
      <div className="wh-header-row">
        <div>
          <h2 className="wh-pane-title">
            {lang === "en" ? "Outbound" : "Xuất kho"}
          </h2>
          <p className="wh-pane-subtitle">
            {lang === "en"
              ? "Outbound history and manual dispatches from warehouses."
              : "Lịch sử xuất kho và xuất tay từ các kho."}
          </p>
        </div>

        <div className="wh-header-actions-group">
          <button type="button" className="wh-create-btn" onClick={onOpenModal}>
            <Plus size={16} />
            <span>{lang === "en" ? "Outbound" : "Xuất"}</span>
          </button>
          <button type="button" className="wh-refresh-icon-btn" title="Làm mới">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 4 KPI Cards (Screenshot 4) */}
      <div className="wh-kpi-grid-4">
        <div className="wh-kpi-card">
          <span className="kpi-label">{lang === "en" ? "Outbound today" : "Xuất trong ngày"}</span>
          <strong className="kpi-value">0</strong>
          <small className="kpi-sub">0 {lang === "en" ? "units" : "đơn vị"}</small>
        </div>

        <div className="wh-kpi-card">
          <span className="kpi-label">{lang === "en" ? "Outbound dispatches" : "Lượt xuất kho"}</span>
          <strong className="kpi-value">53</strong>
          <small className="kpi-sub">393 {lang === "en" ? "units" : "đơn vị"}</small>
        </div>

        <div className="wh-kpi-card">
          <span className="kpi-label">{lang === "en" ? "Outbound volume" : "Số lượng xuất"}</span>
          <strong className="kpi-value">393</strong>
          <small className="kpi-sub">6 {lang === "en" ? "products - 1 warehouse" : "sản phẩm - 1 kho"}</small>
        </div>

        <div className="wh-kpi-card">
          <span className="kpi-label">{lang === "en" ? "Last 7 days" : "7 ngày gần đây"}</span>
          <strong className="kpi-value">53</strong>
          <small className="kpi-sub">393 {lang === "en" ? "units" : "đơn vị"}</small>
        </div>
      </div>

      {/* 2 Visual Cards (Screenshot 4) */}
      <div className="wh-two-charts-row">
        {/* Left: Xuất theo thời gian */}
        <section className="wh-chart-panel">
          <div className="wh-panel-head">
            <div>
              <h3>{lang === "en" ? "Outbound over time" : "Xuất theo thời gian"}</h3>
              <p>{lang === "en" ? "Units dispatched per day (by warehouse and product filter)." : "Số đơn vị xuất mỗi ngày (theo bộ lọc kho và sản phẩm)."}</p>
            </div>
            <div className="wh-mini-period-tag">
              <span>{lang === "en" ? "This month" : "Tháng này"}</span>
              <ChevronDown size={13} />
            </div>
          </div>

          <div className="wh-chart-svg-wrap">
            <svg viewBox="0 0 420 180" className="wh-chart-svg">
              <line x1="30" y1="25" x2="410" y2="25" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="30" y1="65" x2="410" y2="65" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="30" y1="105" x2="410" y2="105" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="30" y1="145" x2="410" y2="145" stroke="#2c221e" strokeDasharray="3 3" />

              <text x="22" y="29" className="chart-axis-text" textAnchor="end">312</text>
              <text x="22" y="69" className="chart-axis-text" textAnchor="end">234</text>
              <text x="22" y="109" className="chart-axis-text" textAnchor="end">156</text>
              <text x="22" y="149" className="chart-axis-text" textAnchor="end">0</text>

              <path
                d="M 40 145 L 120 145 L 200 145 L 270 120 L 330 30 L 380 145 L 400 145 L 400 145 L 40 145 Z"
                fill="rgba(234, 88, 12, 0.15)"
              />
              <path
                d="M 40 145 L 120 145 L 200 145 L 270 120 L 330 30 L 380 145 L 400 145"
                fill="none"
                stroke="#ea580c"
                strokeWidth="2.5"
              />
              <circle cx="270" cy="120" r="3.5" fill="#ea580c" />
              <circle cx="330" cy="30" r="4.5" fill="#ea580c" />
              <circle cx="380" cy="145" r="3.5" fill="#ea580c" />

              <text x="40" y="166" className="chart-axis-text" textAnchor="middle">1 thg 9</text>
              <text x="120" y="166" className="chart-axis-text" textAnchor="middle">3 thg 9</text>
              <text x="200" y="166" className="chart-axis-text" textAnchor="middle">6 thg 9</text>
              <text x="270" y="166" className="chart-axis-text" textAnchor="middle">8 thg 9</text>
              <text x="330" y="166" className="chart-axis-text" textAnchor="middle">9 thg 9</text>
              <text x="390" y="166" className="chart-axis-text" textAnchor="middle">10 thg</text>
            </svg>
          </div>
        </section>

        {/* Right: Cơ cấu xuất kho */}
        <section className="wh-chart-panel">
          <div className="wh-panel-head">
            <div>
              <h3>{lang === "en" ? "Outbound breakdown" : "Cơ cấu xuất kho"}</h3>
            </div>
          </div>

          <div className="wh-donut-chart-flex">
            <div className="wh-donut-svg-box">
              <svg viewBox="0 0 100 100" className="wh-donut-svg">
                <circle cx="50" cy="50" r="36" fill="none" stroke="#ea580c" strokeWidth="18" />
                <text x="50" y="48" className="donut-center-num" textAnchor="middle">53</text>
                <text x="50" y="60" className="donut-center-sub" textAnchor="middle">Lượt xuất</text>
              </svg>
            </div>

            <div className="wh-donut-legend">
              <div className="legend-row">
                <i className="legend-dot dot-blue" />
                <span>{lang === "en" ? "Linked to orders" : "Gắn đơn hàng"} 53 (100%)</span>
              </div>
              <div className="legend-row">
                <i className="legend-dot dot-red" />
                <span>{lang === "en" ? "Manual dispatch" : "Xuất tay"} 0 (0%)</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SUBVIEW 4: Sản phẩm (Screenshot 5)
// -----------------------------------------------------------------------------
function ProductsSubView({
  productActiveTab,
  onProductActiveTabChange,
  productFilterPill,
  onProductFilterPillChange,
  searchQuery,
  onSearchChange,
  lang,
  onOpenModal,
}: any) {
  const filteredProducts = useMemo(() => {
    return REAL_PRODUCTS_CATALOG.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [searchQuery]);

  return (
    <div className="warehouse-view-pane">
      {/* Header */}
      <div className="wh-header-row">
        <div>
          <h2 className="wh-pane-title">
            {lang === "en" ? "Products" : "Sản phẩm"}
          </h2>
          <p className="wh-pane-subtitle">
            {lang === "en"
              ? "Create, edit, archive or delete company and staff products."
              : "Tạo, sửa, lưu trữ hoặc xóa danh mục sản phẩm công ty và nhân viên."}
          </p>
        </div>

        <div className="wh-header-actions-group">
          <button type="button" className="wh-btn-action">
            <Download size={15} />
            <span>{lang === "en" ? "Export" : "Xuất"}</span>
          </button>
          <button type="button" className="wh-btn-action">
            <Upload size={15} />
            <span>{lang === "en" ? "Import" : "Nhập"}</span>
          </button>
          <button type="button" className="wh-create-btn" onClick={onOpenModal}>
            <Plus size={16} />
            <span>{lang === "en" ? "Add product" : "Thêm sản phẩm"}</span>
          </button>
          <button type="button" className="wh-refresh-icon-btn" title="Làm mới">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Subtabs: [ Danh sách ] [ Danh mục ] [ Kênh bán ] */}
      <div className="prod-subtabs-row">
        <button
          type="button"
          className={`prod-subtab-btn ${productActiveTab === "list" ? "active" : ""}`}
          onClick={() => onProductActiveTabChange("list")}
        >
          <Boxes size={15} />
          <span>{lang === "en" ? "List" : "Danh sách"}</span>
        </button>
        <button
          type="button"
          className={`prod-subtab-btn ${productActiveTab === "categories" ? "active" : ""}`}
          onClick={() => onProductActiveTabChange("categories")}
        >
          <Layers2 size={15} />
          <span>{lang === "en" ? "Categories" : "Danh mục"}</span>
        </button>
        <button
          type="button"
          className={`prod-subtab-btn ${productActiveTab === "channels" ? "active" : ""}`}
          onClick={() => onProductActiveTabChange("channels")}
        >
          <Building2 size={15} />
          <span>{lang === "en" ? "Sales channels" : "Kênh bán"}</span>
        </button>
      </div>

      {/* Filter Pills */}
      <div className="wh-toolbar-row">
        <div className="staff-filter-pills">
          <button
            type="button"
            className={`staff-pill-tab ${productFilterPill === "all" ? "active" : ""}`}
            onClick={() => onProductFilterPillChange("all")}
          >
            <span>{lang === "en" ? "All" : "Tất cả"}</span>
            <b className="pill-count">19</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${productFilterPill === "pending" ? "active" : ""}`}
            onClick={() => onProductFilterPillChange("pending")}
          >
            <span>{lang === "en" ? "Need action" : "Cần xử lý"}</span>
            <b className="pill-count">0</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${productFilterPill === "selling" ? "active" : ""}`}
            onClick={() => onProductFilterPillChange("selling")}
          >
            <span>{lang === "en" ? "Selling" : "Đang bán"}</span>
            <b className="pill-count">19</b>
          </button>
          <button
            type="button"
            className={`staff-pill-tab ${productFilterPill === "archived" ? "active" : ""}`}
            onClick={() => onProductFilterPillChange("archived")}
          >
            <span>{lang === "en" ? "Archived" : "Lưu trữ"}</span>
            <b className="pill-count">0</b>
          </button>
        </div>
      </div>

      {/* Filter Dropdowns & Search */}
      <div className="wh-toolbar-row" style={{ marginTop: "4px" }}>
        <div className="wh-dropdown-filters">
          <div className="wh-select-wrapper">
            <Building2 size={14} />
            <select>
              <option>{lang === "en" ? "All staff" : "Tất cả nhân viên"}</option>
              <option>Công ty</option>
            </select>
            <ChevronDown size={14} className="wh-select-caret" />
          </div>

          <div className="wh-select-wrapper">
            <FileText size={14} />
            <select>
              <option>{lang === "en" ? "All categories" : "Tất cả danh mục"}</option>
              <option>Mỹ phẩm</option>
              <option>Thực phẩm</option>
              <option>Chăm sóc tóc</option>
              <option>Chăm sóc sức khỏe</option>
              <option>Phụ kiện</option>
            </select>
            <ChevronDown size={14} className="wh-select-caret" />
          </div>

          <div className="wh-select-wrapper">
            <span className="dot-circle" />
            <select>
              <option>{lang === "en" ? "All stock levels" : "Tất cả mức tồn"}</option>
              <option>{lang === "en" ? "In stock" : "Đủ hàng"}</option>
              <option>{lang === "en" ? "Low stock" : "Sắp hết"}</option>
            </select>
            <ChevronDown size={14} className="wh-select-caret" />
          </div>
        </div>

        <div className="wh-search-box">
          <Search size={14} />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              lang === "en"
                ? "Search by SKU, product..."
                : "Tìm theo SKU, sản phẩm"
            }
          />
          <button type="button" className="wh-clear-search-btn" onClick={() => onSearchChange("")}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Products Table (Screenshot 5) */}
      <div className="wh-table-card">
        <table className="wh-data-table">
          <thead>
            <tr>
              <th>{lang === "en" ? "PRODUCT" : "SẢN PHẨM"}</th>
              <th>SKU</th>
              <th>{lang === "en" ? "STAFF" : "NHÂN VIÊN"}</th>
              <th>{lang === "en" ? "PRICE" : "GIÁ"}</th>
              <th>{lang === "en" ? "STATUS" : "TRẠNG THÁI"}</th>
              <th className="num-th">{lang === "en" ? "STOCK" : "TỒN"}</th>
              <th className="num-th">{lang === "en" ? "AVAILABLE" : "KHẢ DỤNG"}</th>
              <th className="num-th">{lang === "en" ? "MIN STOCK" : "TỒN TỐI THIỂU"}</th>
              <th>{lang === "en" ? "STOCK STATUS" : "TRẠNG THÁI TỒN"}</th>
              <th>{lang === "en" ? "ACTIONS" : "THAO TÁC"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="prod-name-cell">
                    <span className="prod-badge-letter">{p.initialLetter}</span>
                    <strong className="prod-link-name">{p.name}</strong>
                  </div>
                </td>
                <td><span className="prod-sku-tag">{p.sku}</span></td>
                <td>{p.staff}</td>
                <td><strong>{p.price}</strong></td>
                <td>
                  <span className="prod-status-tag blue">
                    {lang === "en" ? "Selling" : "Đang bán"}
                  </span>
                </td>
                <td className="num-td">{p.stock.toLocaleString("vi-VN")}</td>
                <td className="num-td">
                  <span className="wh-available-badge">
                    {p.available.toLocaleString("vi-VN")}
                  </span>
                </td>
                <td className="num-td">{p.minStock}</td>
                <td>
                  <span className="wh-status-pill green">
                    <span className="dot" />
                    <span>{lang === "en" ? "In stock" : "Đủ hàng"}</span>
                  </span>
                </td>
                <td>
                  <div className="wh-row-actions">
                    <button type="button" className="prod-action-btn edit" title="Sửa">
                      <Edit2 size={13} />
                      <span>{lang === "en" ? "Edit" : "Sửa"}</span>
                    </button>
                    <button type="button" className="prod-action-btn archive" title="Lưu trữ">
                      <Archive size={13} />
                      <span>{lang === "en" ? "Archive" : "Lưu trữ"}</span>
                    </button>
                    <button type="button" className="prod-action-btn delete" title="Xóa">
                      <Trash2 size={13} />
                      <span>{lang === "en" ? "Delete" : "Xóa"}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
