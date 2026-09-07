import { NextResponse } from "next/server";
import { exportDebtJson } from "@/lib/server/debt-data";
import { csvCell } from "@/lib/format";
import { authenticateSupabaseRequest } from "@/lib/server/supabase-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateSupabaseRequest(request);
  if (!auth) return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const fromDate = cleanDate(url.searchParams.get("from_date"));
    const toDate = cleanDate(url.searchParams.get("to_date"));
    if (!fromDate || !toDate || fromDate > toDate) {
      return NextResponse.json({ error: "Khoảng ngày không hợp lệ." }, { status: 400 });
    }
    const data = await exportDebtJson(auth.supabase, { from_date: fromDate, to_date: toDate });
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
    const filenameBase = `cong-no-ha-hoa-${fromDate}-${toDate}`;
    if (format === "csv") {
      const fields = ["KH", "Công", "Tổng công nợ", "Ngày nợ", "Ngày trả"] as const;
      const body = `\uFEFF${[fields, ...data.map((row) => fields.map((field) => row[field]))]
        .map((row) => row.map(csvCell).join(";"))
        .join("\r\n")}`;
      return new Response(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const body = JSON.stringify({
      generated_at: new Date().toISOString(),
      date_range: { from_date: fromDate, to_date: toDate },
      total_records: data.length,
      fields: ["KH", "Công", "Tổng công nợ", "Ngày nợ", "Ngày trả"],
      data,
    }, null, 2);
    const filename = `${filenameBase}.json`;
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Không thể xuất dữ liệu công nợ.") }, { status: 500 });
  }
}

function cleanDate(value: string | null) {
  const text = value?.trim() || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
