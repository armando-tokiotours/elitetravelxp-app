"use client";

import type { ReactNode } from "react";
import { Printer, Save } from "lucide-react";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { ItineraryTopActions } from "@/components/navigation/ItineraryTopActions";

/**
 * Sticky Tokiotours top bar: hamburger · brand · Save / Print / Plan↔Invoice.
 */
export function TopNavBar({
  brandTitle,
  ctaHref = "#",
  ctaLabel = "Itinerary",
  locked = false,
  invoiceActive = false,
  onSave,
  onPrint,
  onPlan,
  onInvoice,
  extraActions,
}: {
  brandTitle: string;
  ctaHref?: string;
  ctaLabel?: string;
  locked?: boolean;
  invoiceActive?: boolean;
  onSave?: () => void;
  onPrint?: () => void;
  onPlan?: () => void;
  onInvoice?: () => void;
  extraActions?: ReactNode;
}) {
  const iconBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9";

  return (
    <MobileTopChrome
      brandTitle={brandTitle}
      ctaHref={ctaHref}
      ctaLabel={ctaLabel}
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            disabled={locked || !onSave}
            onClick={() => onSave?.()}
            className={iconBtn}
            title={locked ? "Save contact first" : "Save"}
            aria-label="Save"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={locked || !onPrint}
            onClick={() => onPrint?.()}
            className={iconBtn}
            title={locked ? "Save contact first" : "Print"}
            aria-label="Print"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
          </button>
          <ItineraryTopActions
            locked={locked}
            invoiceActive={invoiceActive}
            onPlan={onPlan}
            onInvoice={onInvoice}
          />
          {extraActions}
        </div>
      }
    />
  );
}
