import type { SpeegoOrderRow } from "./types";

export type DashboardPeriod = "today" | "yesterday" | "7days" | "30days" | "this_month" | "last_month" | "all";

export function dashboardStats(orders: SpeegoOrderRow[], period: DashboardPeriod, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  if (period === "yesterday") { start.setUTCDate(start.getUTCDate() - 1); end.setUTCDate(end.getUTCDate() - 1); }
  if (period === "7days" || period === "30days") start.setUTCDate(start.getUTCDate() - (period === "7days" ? 6 : 29));
  if (period === "this_month") start.setUTCDate(1);
  if (period === "last_month") { start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 1); end.setUTCDate(0); }
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  const selected = orders.filter(order => period === "all" || (order.order_date?.slice(0, 10) >= from && order.order_date?.slice(0, 10) <= to));
  const counts = { delivered: 0, failed: 0, shipping: 0, processing: 0, returned: 0, cancelled: 0, unknown: 0 };
  for (const order of selected) {
    const status = (order.status || order.raw_status || "").toLowerCase();
    if (/return|hoàn/.test(status)) counts.returned++;
    else if (/cancel|hủy|huỷ/.test(status)) counts.cancelled++;
    else if (/fail|undeliver|unsuccessful|exception|thất bại|không.*giao/.test(status)) counts.failed++;
    else if (/out for delivery|transit|shipping|shipped|on the way|đang.*(giao|vận chuyển)/.test(status)) counts.shipping++;
    else if (/delivered|đã giao|giao thành công/.test(status)) counts.delivered++;
    else if (/process|pending|label created|pre.shipment|xử lý|chờ/.test(status)) counts.processing++;
    else counts.unknown++;
  }
  const daily = new Map<string, number>();
  for (const order of selected) {
    const day = order.order_date?.slice(0, 10);
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) daily.set(day, (daily.get(day) || 0) + 1);
  }
  const first = period === "all" ? [...daily.keys()].sort()[0] : from;
  const last = period === "all" ? [...daily.keys()].sort().at(-1) : to;
  const series: { date: string; daily: number; cumulative: number }[] = [];
  let cumulative = 0;
  if (first && last) {
    const cursor = new Date(`${first}T00:00:00Z`);
    while (cursor.toISOString().slice(0, 10) <= last) {
      const date = cursor.toISOString().slice(0, 10);
      const count = daily.get(date) || 0;
      cumulative += count;
      series.push({ date, daily: count, cumulative });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return { selected, counts, total: selected.length, series };
}
