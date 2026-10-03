"use client";

import { PlanInvoiceToggleSwitch } from "@/components/ui/PlanInvoiceToggleSwitch";

/**
 * Compact Plan ↔ Invoice switch for itinerary top chrome (replaces Builder pill).
 * Save / Send / Print live in LiquidGlassHero top-right.
 */
export function ItineraryTopActions({
  locked = false,
  invoiceActive = false,
  onPlan,
  onInvoice,
}: {
  locked?: boolean;
  invoiceActive?: boolean;
  onPlan?: () => void;
  onInvoice?: () => void;
}) {
  return (
    <PlanInvoiceToggleSwitch
      activeTab={invoiceActive ? "invoice" : "plan"}
      disabled={locked || !onInvoice}
      onChange={(tab) => {
        if (locked) return;
        if (tab === "invoice") onInvoice?.();
        else onPlan?.();
      }}
      className="h-8 w-[7.5rem] shrink-0 sm:h-9 sm:w-36"
    />
  );
}
