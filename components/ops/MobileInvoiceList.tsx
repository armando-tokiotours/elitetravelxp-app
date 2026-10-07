"use client";

/**
 * Thin adapter — prefer FlatInvoiceBrief directly.
 * Maps legacy `title` rows onto FlatInvoiceBrief `description` rows.
 */
import {
  FlatInvoiceBrief,
  type InvoiceRow as FlatInvoiceRow,
} from "@/components/ops/FlatInvoiceBrief";
import type { PriceMode } from "@/lib/agentServices";

export interface InvoiceRow {
  id: string;
  title: string;
  category: string;
  status: "ACCEPTED" | "PENDING" | "OPTIONAL";
  minPrice: number;
  maxPrice: number;
  icon?: string;
  isBonus?: boolean;
  listPriceEur?: number;
}

export function MobileInvoiceList({
  items,
  depositAmount = 0,
  totalPaidEur,
  finalApprovedPrice = null,
  priceMode = null,
}: {
  items: InvoiceRow[];
  /** Concierge fee / initial deposit amount (typically €60). */
  depositAmount?: number;
  /** Total paid toward tour (fee + milestones). */
  totalPaidEur?: number;
  /** Ops deal lock — exact package when > 0. */
  finalApprovedPrice?: number | null;
  /** Ops Pricing Studio: estimate | exact. */
  priceMode?: PriceMode | null;
  /** @deprecated unused — kept for call-site compatibility */
  paxCount?: number;
}) {
  const rows: FlatInvoiceRow[] = items.map((item) => ({
    id: item.id,
    description: item.icon
      ? `${item.icon} ${item.title}`
      : item.title,
    category: item.category,
    status: item.status,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    isBonus: item.isBonus,
    listPriceEur: item.listPriceEur,
  }));

  return (
    <FlatInvoiceBrief
      items={rows}
      depositAmount={depositAmount}
      totalPaidEur={totalPaidEur}
      finalApprovedPrice={finalApprovedPrice}
      priceMode={priceMode}
    />
  );
}
