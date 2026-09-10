import type { TabKey } from "@/lib/types";

export const TAB_ROUTES: Record<TabKey, string> = {
  overview: "/tonghop",
  debts: "/khach-no",
  payments: "/tra-no",
  returns: "/thu-hoi",
  sales_routes: "/sale-tuyen",
  zalo_contacts: "/danh-ba-zalo",
  ups_tracking: "/tracking-ups",
  customers_list: "/danh-sach-khach-hang",
  staff: "/nhan-su",
  routes: "/tuyen",
  warehouse: "/he-thong-kho",
  warehouse_locations: "/vi-tri-kho",
  warehouse_expiry: "/han-su-dung",
  warehouse_serials: "/serial-imei-batch",
  warehouse_combos: "/combo-hang",
  fulfillment: "/fulfillment",
  permissions: "/phan-quyen",
  settlements: "/doi-soat",
  payout: "/payout",
  backup: "/sao-luu-khoi-phuc",
  app_settings: "/cai-dat",
  help: "/tro-giup",
  api_integrations: "/tich-hop-api",
  privacy_policy: "/chinh-sach-quyen-rieng-tu",
};

const ROUTE_TABS = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, path]) => [path, tab as TabKey]),
) as Record<string, TabKey>;

export function tabFromPath(pathname: string): TabKey | null {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return ROUTE_TABS[normalized] ?? null;
}
