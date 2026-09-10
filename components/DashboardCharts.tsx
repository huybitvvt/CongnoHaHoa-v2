"use client";

import React, { useMemo } from "react";
import { MoreVertical, Package, PackageCheck, Truck, Clock3, RotateCcw, CircleAlert, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import type { SpeegoOrderRow, DebtRow, PaymentRow, ReturnRow } from "@/lib/types";

import { dashboardStats } from "@/lib/dashboard-stats";

export type Language = "vi" | "en";
export type DatePeriod = "today" | "yesterday" | "7days" | "30days" | "this_month" | "last_month" | "all";

interface DashboardChartsProps {
  orders: SpeegoOrderRow[];
  debts: DebtRow[];
  payments: PaymentRow[];
  returns: ReturnRow[];
  lang?: Language;
  period?: DatePeriod;
}

export function DashboardCharts({
  orders = [],
  lang = "vi",
  period = "this_month",
}: DashboardChartsProps) {


  const t = useMemo(() => {
    return {
      cumulativeOrders: lang === "vi" ? "Đơn cộng dồn" : "Cumulative Orders",
      cumulativeDesc:
        lang === "vi"
          ? "Tổng đơn tạo cộng dồn theo ngày. Rê chuột để xem số đơn ngày đó và tổng lũy kế."
          : "Cumulative orders created by day. Hover to view daily count and cumulative sum.",
      ordersByDay: lang === "vi" ? "Đơn theo ngày" : "Orders by Day",
      ordersByDayDesc:
        lang === "vi"
          ? "Số đơn phát sinh mỗi ngày trong kỳ đã chọn."
          : "Number of orders generated per day in selected period.",
      processingTime: lang === "vi" ? "Thời gian xử lý đơn" : "Order Processing Time",
      processingDesc:
        lang === "vi"
          ? "Trung bình từ lúc tạo đơn đến lúc giao thực tế. Rê chuột vào ngày để xem thời gian và số đơn giao. Đơn nhập sau khi đã giao dùng thời gian vận chuyển (lấy hàng → giao)."
          : "Average time from order creation to delivery. Hover to view processing time and count.",
      noProcessingData:
        lang === "vi"
          ? "Không có đơn đã giao có thời gian xử lý trong khoảng này"
          : "No delivered orders with processing time in this period",
      carrierShare: lang === "vi" ? "Tỉ lệ hãng vận chuyển" : "Carrier Share",
      carrierDesc:
        lang === "vi"
          ? "Số đơn và tỉ lệ theo từng hãng trong khoảng thời gian đã chọn."
          : "Order count and ratio by carrier in selected period.",
      settlementTable: lang === "vi" ? "Bảng đối soát" : "Settlement Summary",
      settlementDesc:
        lang === "vi"
          ? "Tổng theo đơn trong khoảng thời gian đã chọn. Thực nhận = tiền thu - phí vận chuyển - phí Fulfillment (xử lý đơn + phát sinh)."
          : "Order totals in selected period. Net = Gross - Shipping fees - Fulfillment fees.",
      ordersByStatus: lang === "vi" ? "Đơn theo trạng thái" : "Orders by Status",
      ordersByStatusDesc:
        lang === "vi"
          ? "Số đơn và tỉ lệ theo trạng thái trong khoảng thời gian đã chọn."
          : "Order count and ratio by status in selected period.",
      deliveryRate: lang === "vi" ? "Tỉ lệ giao hàng" : "Delivery Rate",
      deliveryRateDesc:
        lang === "vi"
          ? "Cột chồng tỉ lệ đơn tạo mỗi ngày: đã giao, thất bại, hoặc còn mở. Rê chuột để xem phần trăm."
          : "Stacked ratio of daily orders: delivered, failed, or open. Hover to view percentages.",
      deliveryVolume: lang === "vi" ? "Số lượng giao hàng" : "Delivery Volume",
      deliveryVolumeDesc:
        lang === "vi"
          ? "Cột chồng số đơn giao thành công và thất bại theo ngày tạo. Rê chuột để xem hai số."
          : "Stacked count of delivered and failed orders by creation date.",
      inboundOutbound: lang === "vi" ? "Nhập / xuất kho" : "Inbound / Outbound",
      inboundOutboundDesc:
        lang === "vi"
          ? "Cột nhóm so sánh nhập và xuất mỗi ngày. Rê chuột vào ngày để xem hai số và thuần."
          : "Grouped comparison of daily inbound and outbound. Hover to view numbers and net.",
      dailyInOut: lang === "vi" ? "Nhập / xuất theo ngày" : "Daily Inbound / Outbound",
      dailyInOutDesc:
        lang === "vi"
          ? "Số lượng nhập và xuất từng ngày trong khoảng đã chọn, kèm số ròng."
          : "Daily inbound and outbound quantities with net balance in selected period.",
      productInOut: lang === "vi" ? "Nhập / xuất theo sản phẩm" : "Inbound / Outbound by Product",
      productInOutDesc:
        lang === "vi"
          ? "Sản phẩm xếp theo khối lượng biến động (nhập + xuất) trong khoảng đã chọn."
          : "Products ranked by activity volume (inbound + outbound) in selected period.",
      stockSummary: lang === "vi" ? "Tóm tắt tồn kho" : "Inventory Summary",
      stockSummaryDesc:
        lang === "vi"
          ? "So sánh số SKU còn hàng, sắp hết và hết hàng. Rê chuột vào cột để xem tỉ lệ."
          : "Ratio of in-stock, low-stock, and out-of-stock SKUs. Hover to view percentage.",
      stockByWarehouse: lang === "vi" ? "Tồn theo kho" : "Stock by Warehouse",
      stockByWarehouseDesc:
        lang === "vi"
          ? "Tỉ trọng tồn theo kho. Rê chuột vào phần để xem số lượng và phần trăm."
          : "Inventory proportion by warehouse. Hover to view quantity and percentage.",
      topStocked: lang === "vi" ? "Sản phẩm tồn nhiều nhất" : "Top Stocked Products",
      topStockedDesc:
        lang === "vi"
          ? "Cột cao nhất là SKU tồn nhiều nhất. Rê chuột để xem tên đầy đủ."
          : "Tallest column is the highest stock SKU. Hover to view full product name.",
      lowStock: lang === "vi" ? "Sản phẩm sắp / hết hàng" : "Low / Out of Stock",
      noLowStock: lang === "vi" ? "Không có sản phẩm sắp hết" : "No low stock products",
      viewAll: lang === "vi" ? "Xem tất cả" : "View all",
      carrier: lang === "vi" ? "HÃNG VẬN CHUYỂN" : "CARRIER",
      ordersCount: lang === "vi" ? "SỐ ĐƠN" : "ORDERS",
      ratio: lang === "vi" ? "TỈ LỆ" : "RATIO",
      shippingFee: lang === "vi" ? "PHÍ VẬN CHUYỂN" : "SHIPPING FEE",
      total: lang === "vi" ? "Tổng" : "Total",
      totalShippingFee: lang === "vi" ? "Tổng tiền phí vận chuyển" : "Total shipping fees",
      totalFulfillmentFee: lang === "vi" ? "Tổng tiền phí Fulfillment" : "Total fulfillment fees",
      totalRevenue: lang === "vi" ? "Tổng tiền thu" : "Total gross revenue",
      netReceived: lang === "vi" ? "Tổng tiền thực nhận" : "Total net received",
      status: lang === "vi" ? "TRẠNG THÁI" : "STATUS",
      processing: lang === "vi" ? "Đang xử lý" : "Processing",
      shipping: lang === "vi" ? "Đang vận chuyển" : "In Transit",
      delivered: lang === "vi" ? "Đã giao thành công" : "Delivered",
      returned: lang === "vi" ? "Đơn hoàn" : "Returned",
      cancelled: lang === "vi" ? "Đơn hủy" : "Cancelled",
      deliveredTotal: lang === "vi" ? "Đã giao / tổng đơn" : "Delivered / Total",
      failedTotal: lang === "vi" ? "Giao thất bại / tổng đơn" : "Failed / Total",
      deliveredLabel: lang === "vi" ? "Đã giao" : "Delivered",
      failedLabel: lang === "vi" ? "Giao thất bại" : "Failed",
      inboundLabel: lang === "vi" ? "Nhập kho" : "Inbound",
      outboundLabel: lang === "vi" ? "Xuất kho" : "Outbound",
      dateCol: lang === "vi" ? "NGÀY" : "DATE",
      inCol: lang === "vi" ? "NHẬP KHO" : "INBOUND",
      outCol: lang === "vi" ? "XUẤT KHO" : "OUTBOUND",
      netCol: lang === "vi" ? "RÒNG" : "NET",
      productCol: lang === "vi" ? "SẢN PHẨM" : "PRODUCT",
      skuCol: lang === "vi" ? "SKU" : "SKU",
      inStock: lang === "vi" ? "Còn hàng" : "In Stock",
    };
  }, [lang]);

  const stats = dashboardStats(orders, period);
  const realTotalOrders = stats.total;
  const { delivered: deliveredCount, shipping: shippingCount, processing: processingCount, returned: returnedCount, cancelled: cancelledCount } = stats.counts;
  const totalStatusOrders = stats.total;
  const upsOrdersCount = stats.selected.filter(o => /\bUPS\b/i.test(o.shipping_unit || "")).length;
  const uspsOrdersCount = stats.selected.filter(o => /\bUSPS\b/i.test(o.shipping_unit || "")).length;
  const totalCarrierOrders = upsOrdersCount + uspsOrdersCount;
  const percent = (value: number, total = stats.total) => new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 1 }).format(total ? value / total * 100 : 0) + "%";
  const upsRatio = percent(upsOrdersCount, totalCarrierOrders).replace("%", "");
  const uspsRatio = percent(uspsOrdersCount, totalCarrierOrders).replace("%", "");
  const number = (value: number) => value.toLocaleString(lang === "vi" ? "vi-VN" : "en-US");
  const metrics = [
    { label: lang === "vi" ? "Tổng đơn hàng" : "Total orders", value: number(stats.total), icon: Package, tone: "orange" },
    { label: t.deliveredLabel, value: number(deliveredCount), icon: PackageCheck, tone: "green", detail: t.deliveredLabel },
    { label: t.failedLabel, value: number(stats.counts.failed), icon: CircleAlert, tone: "red", detail: t.failedLabel },
    { label: t.shipping, value: number(shippingCount), icon: Truck, tone: "blue" },
    { label: t.processing, value: number(processingCount), icon: Clock3, tone: "orange" },
    { label: t.returned, value: number(returnedCount), icon: RotateCcw, tone: "orange" },
    { label: lang === "vi" ? "Tỉ lệ giao thành công" : "Delivery success rate", value: percent(deliveredCount), icon: TrendingUp, tone: "green", detail: `${number(deliveredCount)} / ${number(stats.total)} ${lang === "vi" ? "đơn" : "orders"}` },
    { label: lang === "vi" ? "Tỉ lệ giao thất bại" : "Delivery failure rate", value: percent(stats.counts.failed), icon: TrendingDown, tone: "red", detail: `${number(stats.counts.failed)} / ${number(stats.total)} ${lang === "vi" ? "đơn" : "orders"}` },
    { label: lang === "vi" ? "Phí Fulfillment (xử lý + phát sinh)" : "Fulfillment fees", value: "—", icon: Receipt, tone: "orange", detail: lang === "vi" ? "Chưa có dữ liệu phí" : "Fee data unavailable" },
  ];

  return (
    <div className="speedgo-dashboard-container">
      <div className="dashboard-metrics-grid">
        {metrics.map(({ label, value, icon: Icon, tone, detail }) => (
          <article className={`dashboard-metric tone-${tone}`} key={label}>
            <div className="dashboard-metric-heading"><span>{label}</span><Icon size={18} aria-hidden="true" /></div>
            <strong className="dashboard-metric-value">{value}</strong>
            {detail && <small>{detail}</small>}
          </article>
        ))}
      </div>

      {/* Row 1: Đơn cộng dồn, Đơn theo ngày, Thời gian xử lý đơn */}
      <div className="dashboard-grid-row">
        {/* Card 1: Đơn cộng dồn */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.cumulativeOrders}</h3>
              <a href="#view-cumulative" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.cumulativeDesc}</p>
          <div className="card-kpi-val">{realTotalOrders}</div>

          <OrderTrend series={stats.series} kind="cumulative" lang={lang} />
        </section>

        {/* Card 2: Đơn theo ngày */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.ordersByDay}</h3>
              <a href="#view-orders-by-day" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.ordersByDayDesc}</p>

          <OrderTrend series={stats.series} kind="daily" lang={lang} />
        </section>

        {/* Card 3: Thời gian xử lý đơn */}
        <section className="dashboard-card empty-card-layout">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.processingTime}</h3>
              <a href="#view-processing" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.processingDesc}</p>
          <div className="card-empty-content">
            <p>{t.noProcessingData}</p>
          </div>
        </section>
      </div>

      {/* Row 2: Tỉ lệ hãng vận chuyển, Bảng đối soát, Đơn theo trạng thái */}
      <div className="dashboard-grid-row">
        {/* Card 4: Tỉ lệ hãng vận chuyển */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.carrierShare}</h3>
              <a href="#view-carriers" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.carrierDesc}</p>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t.carrier}</th>
                  <th className="num-col">{t.ordersCount}</th>
                  <th className="num-col">{t.ratio}</th>
                  <th className="num-col">{t.shippingFee}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="carrier-badge-wrap">
                      <span className="carrier-icon-ups" aria-hidden="true" />
                      <strong>UPS</strong>
                    </div>
                  </td>
                  <td className="num-col">{upsOrdersCount}</td>
                  <td className="num-col">{upsRatio}%</td>
                  <td className="num-col">—</td>
                </tr>
                <tr>
                  <td>
                    <div className="carrier-badge-wrap">
                      <span className="carrier-icon-usps" aria-hidden="true" />
                      <strong>USPS</strong>
                    </div>
                  </td>
                  <td className="num-col">{uspsOrdersCount}</td>
                  <td className="num-col">{uspsRatio}%</td>
                  <td className="num-col">—</td>
                </tr>
                <tr className="total-row">
                  <td><strong>{t.total}</strong></td>
                  <td className="num-col"><strong>{totalCarrierOrders}</strong></td>
                  <td className="num-col"><strong>{percent(totalCarrierOrders, totalCarrierOrders)}</strong></td>
                  <td className="num-col"><strong>—</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Card 5: Bảng đối soát */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.settlementTable}</h3>
              <a href="#view-settlement" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.settlementDesc}</p>

          <div className="settlement-stat-list">
            {[t.totalShippingFee, t.totalFulfillmentFee, t.totalRevenue, t.netReceived].map((label, index) => (
              <div className={`settlement-stat-item ${index === 3 ? "net-highlight" : ""}`} key={label}>
                <span>{label}</span><strong>—</strong>
              </div>
            ))}
          </div>
          <p className="dashboard-data-note">{lang === "vi" ? "Chưa có dữ liệu thu tiền và phí đối soát trong nguồn đơn hàng." : "Collection and settlement fees are not available in the order source."}</p>
        </section>

        {/* Card 6: Đơn theo trạng thái */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.ordersByStatus}</h3>
              <a href="#view-status" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.ordersByStatusDesc}</p>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t.status}</th>
                  <th className="num-col">{t.ordersCount}</th>
                  <th className="num-col">{t.ratio}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t.processing}</td>
                  <td className="num-col">{processingCount}</td>
                  <td className="num-col">{percent(processingCount)}</td>
                </tr>
                <tr>
                  <td>{t.shipping}</td>
                  <td className="num-col">{shippingCount}</td>
                  <td className="num-col">{percent(shippingCount)}</td>
                </tr>
                <tr>
                  <td>{t.delivered}</td>
                  <td className="num-col">{deliveredCount}</td>
                  <td className="num-col">{percent(deliveredCount)}</td>
                </tr>
                <tr>
                  <td>{t.returned}</td>
                  <td className="num-col">{returnedCount}</td>
                  <td className="num-col">{percent(returnedCount)}</td>
                </tr>
                <tr>
                  <td>{t.cancelled}</td>
                  <td className="num-col">{cancelledCount}</td>
                  <td className="num-col">{percent(cancelledCount)}</td>
                </tr>
                {[[t.failedLabel, stats.counts.failed], [lang === "vi" ? "Chưa xác định" : "Unknown", stats.counts.unknown]].map(([label, count]) => (
                  <tr key={label}><td>{label}</td><td className="num-col">{count}</td><td className="num-col">{percent(Number(count))}</td></tr>
                ))}
                <tr className="total-row">
                  <td><strong>{t.total}</strong></td>
                  <td className="num-col"><strong>{totalStatusOrders}</strong></td>
                  <td className="num-col"><strong>{percent(totalStatusOrders)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p className="dashboard-data-note demo-notice">{lang === "vi" ? "Các biểu đồ giao hàng và kho bên dưới đang dùng dữ liệu minh họa, chưa kết nối nguồn dữ liệu thực tế." : "Delivery and inventory charts below use sample data; live data is not connected yet."}</p>
      {/* Row 3: Tỉ lệ giao hàng, Số lượng giao hàng, Nhập / xuất kho */}
      <div className="dashboard-grid-row">
        {/* Card 7: Tỉ lệ giao hàng */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.deliveryRate}</h3>
              <a href="#view-delivery-rate" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.deliveryRateDesc}</p>

          <div className="chart-legend-row">
            <span className="legend-item"><i className="legend-dot dot-green" /> {t.deliveredTotal}</span>
            <span className="legend-item"><i className="legend-dot dot-red" /> {t.failedTotal}</span>
          </div>

          <div className="chart-wrapper">
            <svg viewBox="0 0 340 125" className="chart-svg">
              <line x1="25" y1="20" x2="330" y2="20" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="25" y1="60" x2="330" y2="60" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="25" y1="100" x2="330" y2="100" stroke="#2c221e" strokeDasharray="3 3" />
              <text x="18" y="24" className="chart-axis-text" textAnchor="end">52</text>
              <text x="18" y="64" className="chart-axis-text" textAnchor="end">26</text>
              <text x="18" y="104" className="chart-axis-text" textAnchor="end">0</text>
              {/* Green line */}
              <path
                d="M 30 100 L 100 100 L 160 100 L 220 100 L 250 96 C 265 92 270 32 278 28 C 285 24 290 95 305 100"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.2"
              />
              {/* Red line */}
              <path
                d="M 30 100 L 100 100 L 160 100 L 220 100 L 250 98 C 265 94 270 42 278 36 C 285 32 290 96 305 100"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.2"
              />
              <text x="30" y="118" className="chart-axis-text" textAnchor="middle">1 thg 9</text>
              <text x="90" y="118" className="chart-axis-text" textAnchor="middle">3 thg 9</text>
              <text x="150" y="118" className="chart-axis-text" textAnchor="middle">5 thg 9</text>
              <text x="210" y="118" className="chart-axis-text" textAnchor="middle">7 thg 9</text>
              <text x="270" y="118" className="chart-axis-text" textAnchor="middle">9 thg 9</text>
              <text x="310" y="118" className="chart-axis-text" textAnchor="middle">10 thg</text>
            </svg>
          </div>
        </section>

        {/* Card 8: Số lượng giao hàng */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.deliveryVolume}</h3>
              <a href="#view-delivery-volume" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.deliveryVolumeDesc}</p>

          <div className="chart-legend-row">
            <span className="legend-item"><i className="legend-dot dot-green" /> {t.deliveredLabel}</span>
            <span className="legend-item"><i className="legend-dot dot-red" /> {t.failedLabel}</span>
          </div>

          <div className="chart-wrapper">
            <svg viewBox="0 0 340 125" className="chart-svg">
              <line x1="25" y1="20" x2="330" y2="20" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="25" y1="60" x2="330" y2="60" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="25" y1="100" x2="330" y2="100" stroke="#2c221e" strokeDasharray="3 3" />
              <text x="18" y="24" className="chart-axis-text" textAnchor="end">16</text>
              <text x="18" y="64" className="chart-axis-text" textAnchor="end">8</text>
              <text x="18" y="104" className="chart-axis-text" textAnchor="end">0</text>
              {/* Green line */}
              <path
                d="M 30 100 L 100 100 L 160 100 L 220 100 L 250 96 C 265 92 270 32 278 28 C 285 24 290 95 305 100"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.2"
              />
              {/* Red line */}
              <path
                d="M 30 100 L 100 100 L 160 100 L 220 100 L 250 98 C 265 94 270 42 278 36 C 285 32 290 96 305 100"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.2"
              />
              <text x="30" y="118" className="chart-axis-text" textAnchor="middle">1 thg 9</text>
              <text x="90" y="118" className="chart-axis-text" textAnchor="middle">3 thg 9</text>
              <text x="150" y="118" className="chart-axis-text" textAnchor="middle">5 thg 9</text>
              <text x="210" y="118" className="chart-axis-text" textAnchor="middle">7 thg 9</text>
              <text x="270" y="118" className="chart-axis-text" textAnchor="middle">9 thg 9</text>
              <text x="310" y="118" className="chart-axis-text" textAnchor="middle">10 thg</text>
            </svg>
          </div>
        </section>

        {/* Card 9: Nhập / xuất kho */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.inboundOutbound}</h3>
              <a href="#view-in-out" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.inboundOutboundDesc}</p>

          <div className="chart-legend-row">
            <span className="legend-item"><i className="legend-dot dot-green" /> {t.inboundLabel}</span>
            <span className="legend-item"><i className="legend-dot dot-orange" /> {t.outboundLabel}</span>
          </div>

          <div className="chart-wrapper">
            <svg viewBox="0 0 340 125" className="chart-svg">
              <line x1="25" y1="20" x2="330" y2="20" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="25" y1="60" x2="330" y2="60" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="25" y1="100" x2="330" y2="100" stroke="#2c221e" strokeDasharray="3 3" />
              <text x="18" y="24" className="chart-axis-text" textAnchor="end">312</text>
              <text x="18" y="64" className="chart-axis-text" textAnchor="end">156</text>
              <text x="18" y="104" className="chart-axis-text" textAnchor="end">0</text>
              {/* Bars on 8th and 9th */}
              {/* 8 thg 9 */}
              <rect x="250" y="97" width="4" height="3" fill="#22c55e" rx="1" />
              <rect x="256" y="73" width="10" height="27" fill="#ea580c" rx="1" />
              {/* 9 thg 9 */}
              <rect x="286" y="22" width="12" height="78" fill="#ea580c" rx="1" />

              <text x="32" y="116" className="chart-axis-text" textAnchor="middle">1 thg 9</text>
              <text x="62" y="116" className="chart-axis-text" textAnchor="middle">2 thg 9</text>
              <text x="92" y="116" className="chart-axis-text" textAnchor="middle">3 thg 9</text>
              <text x="122" y="116" className="chart-axis-text" textAnchor="middle">4 thg 9</text>
              <text x="152" y="116" className="chart-axis-text" textAnchor="middle">5 thg 9</text>
              <text x="182" y="116" className="chart-axis-text" textAnchor="middle">6 thg 9</text>
              <text x="212" y="116" className="chart-axis-text" textAnchor="middle">7 thg 9</text>
              <text x="255" y="116" className="chart-axis-text" textAnchor="middle">8 thg 9</text>
              <text x="290" y="116" className="chart-axis-text" textAnchor="middle">9 thg 9</text>
              <text x="320" y="116" className="chart-axis-text" textAnchor="middle">10 thg</text>
            </svg>
          </div>
        </section>
      </div>

      {/* Row 4: Nhập / xuất theo ngày, Nhập / xuất theo sản phẩm, Tóm tắt tồn kho */}
      <div className="dashboard-grid-row">
        {/* Card 10: Nhập / xuất theo ngày */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.dailyInOut}</h3>
              <a href="#view-daily-in-out" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.dailyInOutDesc}</p>

          <div className="dash-table-wrap scrollable-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t.dateCol}</th>
                  <th className="num-col">{t.inCol}</th>
                  <th className="num-col">{t.outCol}</th>
                  <th className="num-col">{t.netCol}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>10 thg 9</td><td className="num-col">0</td><td className="num-col">0</td><td className="num-col">0</td></tr>
                <tr><td>9 thg 9</td><td className="num-col">0</td><td className="num-col">311</td><td className="num-col negative-num">-311</td></tr>
                <tr><td>8 thg 9</td><td className="num-col">10</td><td className="num-col">82</td><td className="num-col negative-num">-72</td></tr>
                <tr><td>7 thg 9</td><td className="num-col">0</td><td className="num-col">0</td><td className="num-col">0</td></tr>
                <tr><td>6 thg 9</td><td className="num-col">0</td><td className="num-col">0</td><td className="num-col">0</td></tr>
                <tr><td>5 thg 9</td><td className="num-col">0</td><td className="num-col">0</td><td className="num-col">0</td></tr>
                <tr><td>4 thg 9</td><td className="num-col">0</td><td className="num-col">0</td><td className="num-col">0</td></tr>
                <tr><td>3 thg 9</td><td className="num-col">0</td><td className="num-col">0</td><td className="num-col">0</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Card 11: Nhập / xuất theo sản phẩm */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.productInOut}</h3>
              <a href="#view-prod-in-out" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.productInOutDesc}</p>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t.productCol}</th>
                  <th>{t.skuCol}</th>
                  <th className="num-col">{t.inCol}</th>
                  <th className="num-col">{t.outCol}</th>
                  <th className="num-col">{t.netCol}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><strong>Dán Kinoki</strong></td><td>Dán</td><td className="num-col">0</td><td className="num-col">311</td><td className="num-col negative-num">-311</td></tr>
                <tr><td><strong>Red Lava</strong></td><td>Red</td><td className="num-col">4</td><td className="num-col">64</td><td className="num-col negative-num">-60</td></tr>
                <tr><td><strong>Fitgum Acai</strong></td><td>FitA</td><td className="num-col">3</td><td className="num-col">6</td><td className="num-col negative-num">-3</td></tr>
                <tr><td><strong>Bình nước</strong></td><td>Binh</td><td className="num-col">0</td><td className="num-col">6</td><td className="num-col negative-num">-6</td></tr>
                <tr><td><strong>Dầu Dưỡng Tóc</strong></td><td>DDT</td><td className="num-col">2</td><td className="num-col">4</td><td className="num-col negative-num">-2</td></tr>
                <tr><td><strong>Dầu Gội</strong></td><td>DG</td><td className="num-col">1</td><td className="num-col">2</td><td className="num-col negative-num">-1</td></tr>
                <tr className="total-row">
                  <td colSpan={2}><strong>{t.total}</strong></td>
                  <td className="num-col"><strong>10</strong></td>
                  <td className="num-col"><strong>393</strong></td>
                  <td className="num-col negative-num"><strong>-383</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Card 12: Tóm tắt tồn kho */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.stockSummary}</h3>
              <a href="#view-stock-summary" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.stockSummaryDesc}</p>

          <div className="donut-chart-flex">
            <div className="donut-svg-box">
              <svg viewBox="0 0 100 100" className="donut-svg">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#2563eb" strokeWidth="10" />
                <text x="50" y="49" className="donut-center-text" textAnchor="middle">100%</text>
                <text x="50" y="61" textAnchor="middle" className="donut-center-caption">19 SKU</text>
              </svg>
            </div>
            <div className="donut-legend-box">
              <div className="donut-legend-item">
                <i className="donut-legend-dot dot-blue" />
                <div>
                  <strong>{t.inStock}</strong>
                  <p>19 sp · 100%</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Row 5: Tồn theo kho, Sản phẩm tồn nhiều nhất, Sản phẩm sắp / hết hàng */}
      <div className="dashboard-grid-row">
        {/* Card 13: Tồn theo kho */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.stockByWarehouse}</h3>
              <a href="#view-stock-by-wh" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.stockByWarehouseDesc}</p>

          <div className="pie-chart-flex">
            <div className="pie-svg-box">
              <svg viewBox="-1.1 -1.1 2.2 2.2" className="pie-svg">
                {/* 61.8% Orange sector: from -90 deg (top) around 222.48 deg */}
                <path
                  d="M 0 0 L 0 -1 A 1 1 0 1 1 -0.675 0.738 Z"
                  fill="#ea580c"
                />
                {/* 38.2% Green sector: remaining */}
                <path
                  d="M 0 0 L -0.675 0.738 A 1 1 0 0 1 0 -1 Z"
                  fill="#22c55e"
                />
              </svg>
            </div>
            <div className="pie-legend-box">
              <div className="pie-legend-item">
                <i className="donut-legend-dot dot-orange" />
                <div>
                  <strong>Texas - Warehouse</strong>
                  <p>168.189 sp · 61,8%</p>
                </div>
              </div>
              <div className="pie-legend-item">
                <i className="donut-legend-dot dot-green" />
                <div>
                  <strong>California - Warehouse</strong>
                  <p>103.833 sp · 38,2%</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Card 14: Sản phẩm tồn nhiều nhất */}
        <section className="dashboard-card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.topStocked}</h3>
              <a href="#view-top-stocked" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <p className="card-subtitle">{t.topStockedDesc}</p>

          <div className="chart-wrapper">
            <svg viewBox="0 0 340 135" className="chart-svg">
              <line x1="25" y1="20" x2="330" y2="20" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="25" y1="65" x2="330" y2="65" stroke="#2c221e" strokeDasharray="3 3" />
              <line x1="25" y1="110" x2="330" y2="110" stroke="#2c221e" strokeDasharray="3 3" />
              <text x="18" y="24" className="chart-axis-text" textAnchor="end">24.648</text>
              <text x="18" y="69" className="chart-axis-text" textAnchor="end">12.324</text>
              <text x="18" y="114" className="chart-axis-text" textAnchor="end">0</text>

              {/* Lollipops */}
              {/* 1: F */}
              <line x1="45" y1="26" x2="45" y2="110" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="45" cy="26" r="4.5" fill="#ea580c" />
              <text x="45" y="125" className="chart-axis-text" textAnchor="middle">F</text>

              {/* 2: M */}
              <line x1="85" y1="44" x2="85" y2="110" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="85" cy="44" r="4" fill="#ea580c" />
              <text x="85" y="125" className="chart-axis-text" textAnchor="middle">M</text>

              {/* 3: D */}
              <line x1="125" y1="46" x2="125" y2="110" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="125" cy="46" r="4" fill="#ea580c" />
              <text x="125" y="125" className="chart-axis-text" textAnchor="middle">D</text>

              {/* 4: D */}
              <line x1="165" y1="48" x2="165" y2="110" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="165" cy="48" r="4" fill="#ea580c" />
              <text x="165" y="125" className="chart-axis-text" textAnchor="middle">D</text>

              {/* 5: D */}
              <line x1="205" y1="52" x2="205" y2="110" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="205" cy="52" r="4" fill="#ea580c" />
              <text x="205" y="125" className="chart-axis-text" textAnchor="middle">D</text>

              {/* 6: D */}
              <line x1="245" y1="54" x2="245" y2="110" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="245" cy="54" r="4" fill="#ea580c" />
              <text x="245" y="125" className="chart-axis-text" textAnchor="middle">D</text>

              {/* 7: R */}
              <line x1="285" y1="58" x2="285" y2="110" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="285" cy="58" r="4" fill="#ea580c" />
              <text x="285" y="125" className="chart-axis-text" textAnchor="middle">R</text>

              {/* 8: K */}
              <line x1="315" y1="68" x2="315" y2="110" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="315" cy="68" r="4" fill="#ea580c" />
              <text x="315" y="125" className="chart-axis-text" textAnchor="middle">K</text>
            </svg>
          </div>
        </section>

        {/* Card 15: Sản phẩm sắp / hết hàng */}
        <section className="dashboard-card empty-card-layout">
          <div className="card-header">
            <div className="card-title-group">
              <h3>{t.lowStock}</h3>
              <a href="#view-low-stock" className="card-link">{t.viewAll}</a>
            </div>
            <button type="button" className="card-menu-btn" aria-label="Menu"><MoreVertical size={16} /></button>
          </div>
          <div className="card-empty-content">
            <p>{t.noLowStock}</p>
          </div>
        </section>
      </div>

      {/* Watermark v1.9.18 in bottom right corner */}
      <div className="dashboard-watermark">v1.9.18</div>
    </div>
  );
}

function OrderTrend({ series, kind, lang }: { series: ReturnType<typeof dashboardStats>["series"]; kind: "daily" | "cumulative"; lang: Language }) {
  const max = Math.max(1, ...series.map(point => point[kind]));
  const x = (index: number) => 38 + (series.length > 1 ? index / (series.length - 1) : 0.5) * 374;
  const y = (value: number) => 152 - value / max * 116;
  const path = series.map((point, index) => `${index ? "L" : "M"} ${x(index)} ${y(point[kind])}`).join(" ");
  const id = `order-trend-${kind}`;
  if (!series.length) return <div className="card-empty-content">{lang === "vi" ? "Chưa có đơn trong kỳ này" : "No orders in this period"}</div>;
  return <div className="chart-wrapper order-trend"><svg viewBox="0 0 440 188" className="chart-svg" role="img" aria-label={lang === "vi" ? "Số đơn theo ngày trong kỳ đã chọn" : "Orders by date in selected period"}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff763e" stopOpacity="0.3" /><stop offset="100%" stopColor="#ff763e" stopOpacity="0.01" /></linearGradient></defs>
    {[0, 0.5, 1].map(ratio => <g key={ratio}><line x1="38" x2="412" y1={y(max * ratio)} y2={y(max * ratio)} stroke="currentColor" opacity="0.12" strokeDasharray="3 5" /><text x="28" y={y(max * ratio) + 4} textAnchor="end" className="chart-axis-text">{Math.round(max * ratio)}</text></g>)}
    <path d={`${path} L ${x(series.length - 1)} 152 L ${x(0)} 152 Z`} fill={`url(#${id})`} />
    <path d={path} fill="none" stroke="#ff763e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    {series.map((point, index) => <circle key={point.date} cx={x(index)} cy={y(point[kind])} r="4" fill="#ff763e" opacity="0"><title>{`${point.date}: ${point[kind]}`}</title></circle>)}
    {[...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])].map(index => <text key={index} x={x(index)} y="177" textAnchor="middle" className="chart-axis-text">{series[index].date.slice(8)}/{series[index].date.slice(5, 7)}</text>)}
  </svg></div>;
}
