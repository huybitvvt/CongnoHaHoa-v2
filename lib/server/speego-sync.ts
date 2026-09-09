import type { SupabaseClient } from "@supabase/supabase-js";

const SOURCE_TABLE = "orders";
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 100;
const MAX_SOURCE_ORDERS = 5000;
const UPS_TRACKING_CODE = /^1Z[A-Z0-9]{5,32}$/;

const SOURCE_FIELDS = [
  "id",
  "order_code",
  "order_date",
  "customer_name",
  "customer_phone",
  "customer_address",
  "city",
  "state",
  "zipcode",
  "country",
  "tracking_code",
  "marketing_staff",
  "sale_staff",
  "cskh",
  "delivery_staff",
  "shipping_unit",
  "sale_price",
  "payment_currency",
  "exchange_rate",
  "total_amount_vnd",
  "updated_at",
] as const;

type SourceOrder = Record<(typeof SOURCE_FIELDS)[number], unknown>;

type ExistingSpeegoOrder = {
  id: string;
  source_order_id: string | null;
  source_order_code: string | null;
  order_id: string;
  tracking_code: string;
};

type TargetOrder = {
  id?: string;
  source_order_id: string;
  source_order_code: string;
  order_id: string;
  tracking_code: string;
  carrier: "UPS";
  customer_name: string | null;
  phone: string | null;
  email: null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  order_date: string;
  amount: number | null;
  unit_price: number | null;
  currency: string | null;
  exchange_rate: number | null;
  total_amount_vnd: number | null;
  marketing_staff: string | null;
  sales_person: string | null;
  customer_service_staff: string | null;
  delivery_person: string | null;
  shipping_unit: string | null;
  source_updated_at: string | null;
  source_synced_at: string;
};

export type SpeegoSyncResult = {
  from: string;
  before: string;
  sourceRows: number;
  inserted: number;
  updated: number;
};

export class SpeegoSyncError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new SpeegoSyncError(`Thiếu biến môi trường ${name}.`, 503);
  return value;
}

function configuredDate(name: "SPEEGO_SYNC_FROM" | "SPEEGO_SYNC_BEFORE") {
  const value = requiredEnvironment(name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) {
    throw new SpeegoSyncError(`${name} phải có định dạng YYYY-MM-DD.`, 503);
  }
  return value;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, maxLength);
  return result || null;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function sourceId(value: unknown) {
  const result = String(value ?? "").trim();
  if (!result) throw new SpeegoSyncError("Nguồn có đơn thiếu id; đã dừng để tránh tạo bản ghi trùng.", 502);
  return result.slice(0, 160);
}

function sourceOrderCode(value: unknown, id: string) {
  return cleanText(value, 160) || `SOURCE-${id.slice(-24)}`;
}

function targetOrderId(value: string, id: string) {
  const normalized = value.toUpperCase().replace(/^#+/, "").replace(/[^A-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 31);
  const fallback = id.toUpperCase().replace(/[^A-Z0-9-]+/g, "").slice(-24);
  return `#${normalized || fallback || "SOURCE"}`;
}

function trackingCode(value: unknown) {
  const result = String(value ?? "").trim().toUpperCase();
  if (!UPS_TRACKING_CODE.test(result)) {
    throw new SpeegoSyncError("Nguồn trả về mã vận đơn không hợp lệ dù đã lọc tiền tố 1Z.", 502);
  }
  return result;
}

function sourceTimestamp(value: unknown) {
  const result = cleanText(value, 50);
  return result && Number.isFinite(Date.parse(result)) ? result : null;
}

function mapSourceOrder(source: SourceOrder, syncedAt: string): TargetOrder {
  const id = sourceId(source.id);
  const orderCode = sourceOrderCode(source.order_code, id);
  const orderDate = cleanText(source.order_date, 10);
  if (!orderDate || !/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
    throw new SpeegoSyncError(`Đơn nguồn ${id} có order_date không hợp lệ.`, 502);
  }
  const currency = cleanText(source.payment_currency, 3)?.toUpperCase() || null;
  return {
    source_order_id: id,
    source_order_code: orderCode,
    order_id: targetOrderId(orderCode, id),
    tracking_code: trackingCode(source.tracking_code),
    carrier: "UPS",
    customer_name: cleanText(source.customer_name, 160),
    phone: cleanText(source.customer_phone, 50),
    email: null,
    address: cleanText(source.customer_address, 500),
    city: cleanText(source.city, 160),
    state: cleanText(source.state, 160),
    postal_code: cleanText(source.zipcode, 40),
    country: cleanText(source.country, 120),
    order_date: orderDate,
    amount: cleanNumber(source.sale_price),
    unit_price: cleanNumber(source.sale_price),
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    exchange_rate: cleanNumber(source.exchange_rate),
    total_amount_vnd: cleanNumber(source.total_amount_vnd),
    marketing_staff: cleanText(source.marketing_staff, 160),
    sales_person: cleanText(source.sale_staff, 160),
    customer_service_staff: cleanText(source.cskh, 160),
    delivery_person: cleanText(source.delivery_staff, 160),
    shipping_unit: cleanText(source.shipping_unit, 160),
    source_updated_at: sourceTimestamp(source.updated_at),
    source_synced_at: syncedAt,
  };
}

async function fetchSourceOrders(from: string, before: string) {
  const sourceUrl = requiredEnvironment("SPEEGO_SOURCE_SUPABASE_URL").replace(/\/$/, "");
  const sourceKey = requiredEnvironment("SPEEGO_SOURCE_SUPABASE_KEY");
  const rows: SourceOrder[] = [];

  for (let offset = 0; offset <= MAX_SOURCE_ORDERS; offset += PAGE_SIZE) {
    const query = new URLSearchParams();
    query.set("select", SOURCE_FIELDS.join(","));
    query.append("order_date", `gte.${from}`);
    query.append("order_date", `lt.${before}`);
    query.append("tracking_code", "ilike.1Z*");
    query.set("order", "order_date.asc,id.asc");
    query.set("offset", String(offset));
    query.set("limit", String(offset === MAX_SOURCE_ORDERS ? 1 : PAGE_SIZE));

    // The source credential is deliberately used only in this GET request.
    const response = await fetch(`${sourceUrl}/rest/v1/${SOURCE_TABLE}?${query}`, {
      method: "GET",
      headers: { apikey: sourceKey, Authorization: `Bearer ${sourceKey}` },
      cache: "no-store",
    });
    const body = await response.text();
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) detail = parsed.message;
      } catch { /* Keep the HTTP status without echoing arbitrary upstream content. */ }
      throw new SpeegoSyncError(`Không đọc được bảng orders nguồn: ${detail}`, 502);
    }
    const page = JSON.parse(body) as SourceOrder[];
    if (!Array.isArray(page)) throw new SpeegoSyncError("Dữ liệu bảng orders nguồn không hợp lệ.", 502);
    if (offset === MAX_SOURCE_ORDERS) {
      if (page.length) throw new SpeegoSyncError(`Nguồn vượt giới hạn ${MAX_SOURCE_ORDERS} đơn cho một lần đồng bộ.`, 409);
      return rows;
    }
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }

  return rows;
}

async function fetchExistingOrders(supabase: SupabaseClient) {
  const rows: ExistingSpeegoOrder[] = [];
  for (let from = 0; from < MAX_SOURCE_ORDERS; from += PAGE_SIZE) {
    const { data, error } = await supabase.from("speego")
      .select("id,source_order_id,source_order_code,order_id,tracking_code")
      .order("created_at", { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new SpeegoSyncError(`Không đọc được bảng speego đích: ${error.message}`);
    const page = (data || []) as ExistingSpeegoOrder[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  return rows;
}

async function writeBatches(supabase: SupabaseClient, rows: TargetOrder[], mode: "insert" | "update") {
  for (let offset = 0; offset < rows.length; offset += WRITE_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + WRITE_BATCH_SIZE);
    const query = mode === "insert"
      ? supabase.from("speego").insert(batch)
      : supabase.from("speego").upsert(batch, { onConflict: "id" });
    const { error } = await query;
    if (error) throw new SpeegoSyncError(`Không ghi được bảng speego đích: ${error.message}`);
  }
}

export async function syncSpeegoOrders(supabase: SupabaseClient): Promise<SpeegoSyncResult> {
  const from = configuredDate("SPEEGO_SYNC_FROM");
  const before = configuredDate("SPEEGO_SYNC_BEFORE");
  if (from >= before) throw new SpeegoSyncError("SPEEGO_SYNC_FROM phải trước SPEEGO_SYNC_BEFORE.", 503);

  const syncedAt = new Date().toISOString();
  const sourceRows = await fetchSourceOrders(from, before);
  const mapped = sourceRows.map((row) => mapSourceOrder(row, syncedAt));
  const sourceIds = new Set<string>();
  const orderIds = new Set<string>();
  const trackingCodes = new Set<string>();
  for (const row of mapped) {
    if (sourceIds.has(row.source_order_id) || orderIds.has(row.order_id) || trackingCodes.has(row.tracking_code)) {
      throw new SpeegoSyncError("Nguồn có id, mã đơn hoặc mã vận đơn bị trùng; đã dừng trước khi ghi.", 409);
    }
    sourceIds.add(row.source_order_id);
    orderIds.add(row.order_id);
    trackingCodes.add(row.tracking_code);
  }

  const existing = await fetchExistingOrders(supabase);
  const bySourceId = new Map(existing.filter((row) => row.source_order_id)
    .map((row) => [row.source_order_id as string, row]));
  const byTracking = new Map(existing.map((row) => [row.tracking_code.toUpperCase(), row]));
  const byOrderId = new Map(existing.map((row) => [row.order_id.toUpperCase(), row]));
  const inserts: TargetOrder[] = [];
  const updates: TargetOrder[] = [];
  const matchedTargetIds = new Set<string>();

  for (const row of mapped) {
    const matches = [bySourceId.get(row.source_order_id), byTracking.get(row.tracking_code), byOrderId.get(row.order_id)]
      .filter((match): match is ExistingSpeegoOrder => Boolean(match));
    const matchedIds = new Set(matches.map((match) => match.id));
    if (matchedIds.size > 1) {
      throw new SpeegoSyncError(`Đơn ${row.source_order_code} khớp nhiều dòng speego; đã dừng để tránh ghi nhầm.`, 409);
    }
    const match = matches[0];
    if (!match) {
      inserts.push(row);
      continue;
    }
    if (matchedTargetIds.has(match.id)) {
      throw new SpeegoSyncError("Nhiều đơn nguồn cùng khớp một dòng speego; đã dừng để tránh ghi nhầm.", 409);
    }
    matchedTargetIds.add(match.id);
    updates.push({ ...row, id: match.id });
  }

  await writeBatches(supabase, updates, "update");
  await writeBatches(supabase, inserts, "insert");
  return { from, before, sourceRows: mapped.length, inserted: inserts.length, updated: updates.length };
}
