/**
 * Lightweight catalog for Ops Agent Cart (visual grid + search).
 * Always merges a curated default pack so agents see Tours / Transport / Tickets
 * even when PocketBase collections are empty.
 */

import type PocketBase from "pocketbase";
import {
  mapCatalogCategory,
  type CartCatalogItem,
} from "@/lib/agentServices";
import type { TransportProduct } from "@/lib/transportProducts";

/** Curated core services — always available in the pricing studio grid. */
export const DEFAULT_SERVICE_CATALOG: CartCatalogItem[] = [
  {
    id: "cat-6h-tour",
    title: "Tokyo 6-Hour Private Walking Tour",
    category: "TOUR",
    priceEur: 380,
    subtitle: "Private walking · 6h",
  },
  {
    id: "cat-8h-tour",
    title: "Tokyo 8-Hour Full-Day Private Tour",
    category: "TOUR",
    priceEur: 480,
    subtitle: "Private walking · 8h",
  },
  {
    id: "cat-3h-night",
    title: "Tokyo 3-Hour Evening Night Tour",
    category: "TOUR",
    priceEur: 220,
    subtitle: "Night tour · 3h",
  },
  {
    id: "cat-alphard-transfer",
    title: "Alphard Private Airport Transfer (Haneda/Narita)",
    category: "TRANSPORT",
    priceEur: 280,
    subtitle: "Airport transfer",
  },
  {
    id: "cat-hiace-full-day",
    title: "HiAce Private Van Full Day (10h Chauffeur)",
    category: "TRANSPORT",
    priceEur: 650,
    subtitle: "Full-day chauffeur",
  },
  {
    id: "cat-shinkansen-bullet",
    title: "Bullet Train Shinkansen Ticket Reservation",
    category: "TRANSPORT",
    priceEur: 130,
    subtitle: "Shinkansen reservation",
  },
  {
    id: "cat-suica-card",
    title: "Suica IC Digital Transit Setup & Pre-load",
    category: "TICKET",
    priceEur: 20,
    subtitle: "IC card setup",
  },
  {
    id: "cat-teamlab-tix",
    title: "teamLab Planets Tokyo Entry Ticket",
    category: "TICKET",
    priceEur: 35,
    subtitle: "Admission",
  },
  {
    id: "cat-shibuya-sky",
    title: "Shibuya Sky Observation Deck Ticket",
    category: "TICKET",
    priceEur: 25,
    subtitle: "Admission",
  },
];

function tourPrice(row: Record<string, unknown>): number {
  const n = Number(
    row.base_price_eur ??
      row.price_1_pax ??
      row.price ??
      row.estimated_eur ??
      0
  );
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function mergeCatalog(primary: CartCatalogItem[]): CartCatalogItem[] {
  const seen = new Set<string>();
  const out: CartCatalogItem[] = [];
  // Prefer live PocketBase rows; fill gaps with curated defaults.
  for (const item of [...primary, ...DEFAULT_SERVICE_CATALOG]) {
    const idKey = String(item.id || "").toLowerCase();
    const titleKey = `t:${item.title.trim().toLowerCase()}`;
    if ((idKey && seen.has(idKey)) || seen.has(titleKey)) continue;
    if (idKey) seen.add(idKey);
    seen.add(titleKey);
    out.push(item);
  }
  return out;
}

export async function loadOpsCartCatalog(
  pb: PocketBase
): Promise<CartCatalogItem[]> {
  const out: CartCatalogItem[] = [];
  const seen = new Set<string>();

  try {
    const tours = await pb.collection("tours").getFullList<Record<string, unknown>>({
      filter: "is_active != false",
      sort: "title",
      requestKey: null,
    });
    for (const t of tours) {
      const id = String(t.id || "");
      const title = String(t.title || "").trim();
      if (!id || !title || seen.has(id)) continue;
      seen.add(id);
      const isCatalogBonus = Boolean(t.is_bonus);
      out.push({
        id,
        title,
        category: mapCatalogCategory(String(t.category || t.access_type || "tour")),
        priceEur: tourPrice(t),
        subtitle: isCatalogBonus
          ? "🎁 Bonus gift · agent-only"
          : String(t.category || "Experience"),
        isCatalogBonus,
      });
    }
  } catch {
    /* tours optional */
  }

  try {
    const eap = await pb
      .collection("experiences_and_places")
      .getFullList<Record<string, unknown>>({
        filter: "is_active != false",
        sort: "title",
        requestKey: null,
      });
    for (const row of eap) {
      const id = String(row.id || "");
      const title = String(row.title || "").trim();
      if (!id || !title || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        title,
        category: mapCatalogCategory(String(row.type || "activity")),
        priceEur: Math.round(
          Number(row.price_eur || row.estimated_eur || 0) || 0
        ),
        subtitle: String(row.type || "Activity"),
      });
    }
  } catch {
    /* eap optional */
  }

  try {
    const transport = await pb
      .collection("transport_products")
      .getFullList<TransportProduct>({
        filter: "is_active != false",
        sort: "name",
        requestKey: null,
      });
    for (const t of transport) {
      const id = String(t.id || "");
      const title = String(t.name || "").trim();
      if (!id || !title || seen.has(`tp-${id}`)) continue;
      seen.add(`tp-${id}`);
      out.push({
        id: `tp-${id}`,
        title,
        category: "TRANSPORT",
        priceEur: Math.round(Number(t.price_per_person) || 0),
        subtitle: String(t.transport_type || "Transport"),
      });
    }
  } catch {
    /* transport optional */
  }

  return mergeCatalog(out).sort((a, b) => a.title.localeCompare(b.title));
}
