export type SpeegoPeriod = "all" | "today" | "yesterday" | "this_month" | "last_month";

export function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function parseTrackingCodes(input: string) {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of input.toUpperCase().split(/[\s,;]+/).filter(Boolean)) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (/^[A-Z0-9]{7,34}$/.test(token)) valid.push(token);
    else invalid.push(token);
  }

  return { valid, invalid };
}

function shortHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

export function trackingOrderId(trackingCode: string) {
  const code = trackingCode.trim().toUpperCase();
  if (code.length <= 27) return `#UPS-${code}`;
  return `#UPS-${code.slice(-18)}-${shortHash(code)}`;
}

function shiftMonth(year: number, month: number, offset: number) {
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function matchesOrderDate(
  orderDate: string | undefined,
  filters: { day?: string; month?: string; period?: SpeegoPeriod; today?: string },
) {
  const dateKey = orderDate?.slice(0, 10) || "";
  if (filters.day && dateKey !== filters.day) return false;
  if (filters.month && !dateKey.startsWith(`${filters.month}-`)) return false;

  const period = filters.period || "all";
  if (period === "all") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;

  const today = filters.today || localDateKey();
  const todayDate = new Date(`${today}T12:00:00`);
  if (!Number.isFinite(todayDate.getTime())) return false;

  if (period === "today") return dateKey === today;
  if (period === "yesterday") {
    todayDate.setDate(todayDate.getDate() - 1);
    return dateKey === localDateKey(todayDate);
  }

  const currentMonth = today.slice(0, 7);
  if (period === "this_month") return dateKey.startsWith(`${currentMonth}-`);
  const [year, month] = currentMonth.split("-").map(Number);
  return dateKey.startsWith(`${shiftMonth(year, month, -1)}-`);
}
