import { NextResponse } from "next/server";
import { authenticateSupabaseRequest } from "@/lib/server/supabase-auth";
import { SpeegoSyncError, syncSpeegoOrders } from "@/lib/server/speego-sync";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await authenticateSupabaseRequest(request);
  if (!auth) return NextResponse.json({ ok: false, error: "Phiên đăng nhập không hợp lệ." }, { status: 401 });

  try {
    const result = await syncSpeegoOrders(auth.supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof SpeegoSyncError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Đồng bộ đơn hàng thất bại.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
