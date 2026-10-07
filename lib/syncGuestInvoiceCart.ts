/**
 * Persist guest-built invoice rows into ops_hub.extras.agent_services
 * so Ops Pricing Studio sees the same cart (seed-if-empty).
 */

import type { InvoiceItem } from "@/components/invoice/ItemizedInvoiceTable";
import {
  mapCatalogCategory,
  type ServiceLineItem,
} from "@/lib/agentServices";

export function invoiceItemsToServiceLines(
  items: InvoiceItem[],
  agentName = "Guest estimate"
): ServiceLineItem[] {
  return (items || [])
    .filter((item) => {
      const title = String(item.title || "").trim();
      if (!title) return false;
      // Skip placeholder / loading rows
      if (item.id === "loading" || item.id === "exp-none") return false;
      return true;
    })
    .map((item) => {
      const isBonus = Boolean(item.isBonus);
      const list = Math.max(0, Math.round(Number(item.listPriceEur) || 0));
      const base = Math.max(
        0,
        Math.round(Number(item.basePriceEur) || 0),
        isBonus ? list : 0
      );
      const max =
        item.estimateMaxEur != null && Number.isFinite(item.estimateMaxEur)
          ? Math.max(base, Math.round(Number(item.estimateMaxEur)))
          : Math.round(base * 1.3);
      const statusRaw = String(item.status || "ACCEPTED")
        .trim()
        .toUpperCase();
      const status =
        statusRaw === "DECLINED" || statusRaw === "OPTIONAL"
          ? statusRaw
          : "ACCEPTED";
      return {
        id: String(item.id || `guest-${Date.now()}`).trim(),
        title: String(item.title || "").trim(),
        category: mapCatalogCategory(item.category),
        // Bonus: keep representative gift value on base; billable final stays 0
        basePriceEur: isBonus ? Math.max(base, list) : base,
        finalPriceEur: isBonus ? 0 : base,
        estimateMaxEur: isBonus ? 0 : max,
        isBonus,
        status,
        addedByAgent: agentName,
        notes: item.notes,
        quantity: 1,
      } satisfies ServiceLineItem;
    });
}

/**
 * Seed ops_hub.extras.agent_services from the guest invoice when Ops has
 * not saved a cart yet. Never overwrites a non-empty Ops cart.
 */
export async function syncGuestInvoiceCart(input: {
  pnr: string;
  items: InvoiceItem[];
  estimatedTotalEur?: number;
}): Promise<{ ok: boolean; seeded?: boolean; error?: string }> {
  const pnr = String(input.pnr || "")
    .trim()
    .toUpperCase();
  if (!pnr || pnr.startsWith("TMP-")) {
    return { ok: false, error: "official pnr required" };
  }
  const services = invoiceItemsToServiceLines(input.items);
  if (services.length === 0) {
    return { ok: true, seeded: false };
  }
  try {
    const res = await fetch("/api/bookings/agent-services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pnr,
        services,
        mode: "seed_if_empty",
        estimatedTotalEur:
          input.estimatedTotalEur != null &&
          Number.isFinite(Number(input.estimatedTotalEur))
            ? Math.round(Number(input.estimatedTotalEur))
            : undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      seeded?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || "cart sync failed" };
    }
    return { ok: true, seeded: Boolean(data.seeded) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "cart sync failed",
    };
  }
}
