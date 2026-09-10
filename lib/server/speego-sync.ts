import type { SupabaseClient } from "@supabase/supabase-js";

const SOURCE_TABLE = "orders";
const PAGE_SIZE = 1000;
const FIRESTORE_PAGE_SIZE = 300;
const WRITE_BATCH_SIZE = 100;
const MAX_SOURCE_ORDERS = 5000;
const SOURCE_REQUEST_TIMEOUT_MS = 15_000;
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

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type FirestoreValue = {
  nullValue?: null;
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

type SpeedGoOrder = Record<string, unknown> & { firestoreDocumentId: string };

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
  email: string | null;
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
  supabaseRows: number;
  speedGoRows: number;
  speedGoTrackingRows: number;
  inserted: number;
  updated: number;
};

export class SpeegoSyncError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new SpeegoSyncError(`Thiếu biến môi trường ${name}.`, 503);
  return value;
}

function speedGoConfiguration() {
  const names = [
    "SPEEDGO_SOURCE_FIREBASE_API_KEY",
    "SPEEDGO_SOURCE_FIREBASE_PROJECT_ID",
    "SPEEDGO_SOURCE_EMAIL",
    "SPEEDGO_SOURCE_PASSWORD",
  ] as const;
  const values = names.map((name) => process.env[name]?.trim() || "");
  if (values.every((value) => !value)) return null;
  const missing = names.filter((_, index) => !values[index]);
  if (missing.length) throw new SpeegoSyncError(`Thiếu biến môi trường ${missing.join(", ")}.`, 503);
  return {
    apiKey: values[0],
    projectId: values[1],
    email: values[2],
    password: values[3],
  };
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

function cleanCents(value: unknown) {
  const result = cleanNumber(value);
  return result === null ? null : Math.round(result) / 100;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firestoreDate(value: unknown) {
  const timestamp = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
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

function decodeFirestoreValue(value: FirestoreValue): unknown {
  if (Object.prototype.hasOwnProperty.call(value, "nullValue")) return null;
  if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue ?? "";
  if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return Boolean(value.booleanValue);
  if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, "timestampValue")) return value.timestampValue ?? null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if (value.mapValue) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {})
      .map(([key, item]) => [key, decodeFirestoreValue(item)]));
  }
  return null;
}

function decodeFirestoreDocument(document: FirestoreDocument): SpeedGoOrder {
  const firestoreDocumentId = String(document.name || "").split("/").pop()?.trim() || "";
  if (!firestoreDocumentId) throw new SpeegoSyncError("SpeedGo trả về đơn không có mã tài liệu.", 502);
  return {
    firestoreDocumentId,
    ...Object.fromEntries(Object.entries(document.fields || {})
      .map(([key, value]) => [key, decodeFirestoreValue(value)])),
  };
}

function sellerLabel(user: SpeedGoOrder) {
  const labels = [cleanText(user.shopName, 160), cleanText(user.fullName, 160), cleanText(user.email, 160)]
    .filter((value): value is string => Boolean(value));
  return labels.filter((value, index) => labels.findIndex((candidate) => (
    candidate.toLocaleLowerCase() === value.toLocaleLowerCase()
  )) === index).join(" · ").slice(0, 160) || cleanText(user.label, 160) || user.firestoreDocumentId;
}

function mapSpeedGoOrder(source: SpeedGoOrder, sellerLabels: Map<string, string>, syncedAt: string): TargetOrder {
  const details = objectValue(source.orderDetails);
  const address = objectValue(details.shippingAddress);
  const fulfillment = objectValue(source.fulfillment);
  const sourceDocumentId = sourceId(source.firestoreDocumentId);
  const orderCode = sourceOrderCode(source.orderId, sourceDocumentId);
  const orderDate = firestoreDate(source.createdAt);
  if (!orderDate) throw new SpeegoSyncError(`Đơn SpeedGo ${sourceDocumentId} có createdAt không hợp lệ.`, 502);
  const firstAndLastName = [cleanText(details.firstName, 80), cleanText(details.lastName, 80)]
    .filter(Boolean).join(" ");
  const addressLines = [cleanText(address.line1, 300), cleanText(address.line2, 200)].filter(Boolean).join(", ");
  const sellerId = cleanText(source.sellerId, 160);
  const createdByName = cleanText(source.createdByName, 160);
  const salesPerson = (sellerId && sellerLabels.get(sellerId)) || createdByName || sellerId;
  const amount = cleanCents(source.amountTotal);
  const currency = cleanText(source.currency, 3)?.toUpperCase() || null;
  return {
    source_order_id: `speedgo-firestore:${sourceDocumentId}`.slice(0, 160),
    source_order_code: orderCode,
    order_id: targetOrderId(orderCode, sourceDocumentId),
    tracking_code: trackingCode(fulfillment.trackingNumber),
    carrier: "UPS",
    customer_name: cleanText(details.customerName, 160) || firstAndLastName || cleanText(details.companyName, 160),
    phone: cleanText(details.phone, 50),
    email: cleanText(details.customerEmail, 254),
    address: addressLines || null,
    city: cleanText(address.city, 160),
    state: cleanText(address.state, 160),
    postal_code: cleanText(address.postalCode, 40),
    country: cleanText(address.country, 120),
    order_date: orderDate,
    amount,
    unit_price: amount,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    exchange_rate: null,
    total_amount_vnd: null,
    marketing_staff: null,
    sales_person: salesPerson || null,
    customer_service_staff: null,
    delivery_person: createdByName || null,
    shipping_unit: cleanText(fulfillment.carrier, 160) || "UPS",
    source_updated_at: sourceTimestamp(source.updatedAt),
    source_synced_at: syncedAt,
  };
}

async function authenticateSpeedGo(configuration: NonNullable<ReturnType<typeof speedGoConfiguration>>) {
  if (!/^[a-z0-9-]{3,80}$/.test(configuration.projectId)) {
    throw new SpeegoSyncError("SPEEDGO_SOURCE_FIREBASE_PROJECT_ID không hợp lệ.", 503);
  }
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(configuration.apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: configuration.email, password: configuration.password, returnSecureToken: true }),
    cache: "no-store",
    signal: AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null) as { idToken?: string } | null;
  if (!response.ok || !body?.idToken) {
    throw new SpeegoSyncError(`Không đăng nhập được nguồn SpeedGo: HTTP ${response.status}.`, 502);
  }
  return body.idToken;
}

async function fetchFirestoreCollection(projectId: string, idToken: string, collectionName: "orders" | "users") {
  const rows: SpeedGoOrder[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: String(FIRESTORE_PAGE_SIZE) });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${collectionName}?${query}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => null) as {
      documents?: FirestoreDocument[];
      nextPageToken?: string;
    } | null;
    if (!response.ok || !body) {
      throw new SpeegoSyncError(`Không đọc được collection ${collectionName} của SpeedGo: HTTP ${response.status}.`, 502);
    }
    rows.push(...(body.documents || []).map(decodeFirestoreDocument));
    if (rows.length > MAX_SOURCE_ORDERS) {
      throw new SpeegoSyncError(`Nguồn SpeedGo vượt giới hạn ${MAX_SOURCE_ORDERS} bản ghi.`, 409);
    }
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return rows;
}

async function fetchSpeedGoSourceOrders(from: string, before: string, syncedAt: string) {
  const configuration = speedGoConfiguration();
  if (!configuration) return [];
  const idToken = await authenticateSpeedGo(configuration);
  const [orders, users] = await Promise.all([
    fetchFirestoreCollection(configuration.projectId, idToken, "orders"),
    fetchFirestoreCollection(configuration.projectId, idToken, "users"),
  ]);
  const sellerLabels = new Map(users.map((user) => [user.firestoreDocumentId, sellerLabel(user)]));
  return orders.filter((order) => {
    const orderDate = firestoreDate(order.createdAt);
    const fulfillment = objectValue(order.fulfillment);
    const code = String(fulfillment.trackingNumber ?? "").trim().toUpperCase();
    return Boolean(orderDate && orderDate >= from && orderDate < before && code.startsWith("1Z"));
  }).map((order) => mapSpeedGoOrder(order, sellerLabels, syncedAt));
}

async function fetchSupabaseSourceOrders(from: string, before: string) {
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
      signal: AbortSignal.timeout(SOURCE_REQUEST_TIMEOUT_MS),
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

function assertUniqueSourceRows(rows: TargetOrder[], allowDuplicateTracking = false) {
  const sourceIds = new Set<string>();
  const orderIds = new Set<string>();
  const trackingCodes = new Set<string>();
  for (const row of rows) {
    if (sourceIds.has(row.source_order_id) || orderIds.has(row.order_id)
      || (!allowDuplicateTracking && trackingCodes.has(row.tracking_code))) {
      throw new SpeegoSyncError("Nguồn có id, mã đơn hoặc mã vận đơn bị trùng; đã dừng trước khi ghi.", 409);
    }
    sourceIds.add(row.source_order_id);
    orderIds.add(row.order_id);
    trackingCodes.add(row.tracking_code);
  }
}

function newestRowsByTracking(rows: TargetOrder[]) {
  const result = new Map<string, TargetOrder>();
  for (const row of rows) {
    const current = result.get(row.tracking_code);
    const rowUpdatedAt = Date.parse(row.source_updated_at || "") || 0;
    const currentUpdatedAt = Date.parse(current?.source_updated_at || "") || 0;
    if (!current || rowUpdatedAt > currentUpdatedAt
      || (rowUpdatedAt === currentUpdatedAt && row.source_order_id > current.source_order_id)) {
      result.set(row.tracking_code, row);
    }
  }
  return [...result.values()];
}

export async function syncSpeegoOrders(supabase: SupabaseClient): Promise<SpeegoSyncResult> {
  const from = configuredDate("SPEEGO_SYNC_FROM");
  const before = configuredDate("SPEEGO_SYNC_BEFORE");
  if (from >= before) throw new SpeegoSyncError("SPEEGO_SYNC_FROM phải trước SPEEGO_SYNC_BEFORE.", 503);

  const syncedAt = new Date().toISOString();
  const [supabaseSourceRows, speedGoRows] = await Promise.all([
    fetchSupabaseSourceOrders(from, before),
    fetchSpeedGoSourceOrders(from, before, syncedAt),
  ]);
  const supabaseRows = supabaseSourceRows.map((row) => mapSourceOrder(row, syncedAt));
  assertUniqueSourceRows(supabaseRows);
  assertUniqueSourceRows(speedGoRows, true);
  const speedGoTrackingRows = newestRowsByTracking(speedGoRows);
  const mapped = [...new Map([...supabaseRows, ...speedGoTrackingRows]
    .map((row) => [row.tracking_code, row])).values()];
  assertUniqueSourceRows(mapped);

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
    updates.push({ ...row, id: match.id, source_order_id: match.source_order_id || row.source_order_id });
  }

  await writeBatches(supabase, updates, "update");
  await writeBatches(supabase, inserts, "insert");
  return {
    from,
    before,
    sourceRows: mapped.length,
    supabaseRows: supabaseRows.length,
    speedGoRows: speedGoRows.length,
    speedGoTrackingRows: speedGoTrackingRows.length,
    inserted: inserts.length,
    updated: updates.length,
  };
}
