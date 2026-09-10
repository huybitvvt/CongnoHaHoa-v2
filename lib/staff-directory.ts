import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffDirectoryEntry = {
  id: string; name: string; fullName: string; email: string; phone: string;
  organization: string; tier: string; status: string; activatedAt: string;
  expiresAt: string; createdAt: string; lastLogin: string; hasSession: boolean | null; avatarBg: string;
};

export async function loadStaffDirectory(client: SupabaseClient, signal?: AbortSignal): Promise<StaffDirectoryEntry[]> {
  const result: StaffDirectoryEntry[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from("staff_members")
      .select("id,name,account,phone,department,position,created_at")
      .order("created_at", { ascending: false }).order("id")
      .range(offset, offset + pageSize - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      result.push({
        id: row.id, name: row.name, fullName: row.name, email: row.account || "", phone: row.phone || "",
        organization: row.department || "—", tier: row.position || "—", status: "unknown",
        activatedAt: "—", expiresAt: "—", lastLogin: "—", hasSession: null,
        createdAt: row.created_at ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(row.created_at)) : "—",
        avatarBg: ["#b45309", "#0369a1", "#7e22ce", "#047857"][result.length % 4],
      });
    }
    if ((data?.length || 0) < pageSize) return result;
  }
}
