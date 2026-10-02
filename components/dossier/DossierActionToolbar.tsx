"use client";

import Link from "next/link";
import { Printer, Save, Send } from "lucide-react";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { ActionPillButton } from "@/components/ui/ActionPillButton";
import { PlanInvoiceToggleSwitch } from "@/components/ui/PlanInvoiceToggleSwitch";

const iconBtnBase =
  "inline-flex items-center justify-center rounded-lg border px-1.5 py-1.5 text-[8px] font-bold uppercase tracking-wider transition";
const iconBtnOn =
  "border-white/10 bg-white/5 text-white hover:bg-white/10";
const iconBtnOff =
  "cursor-not-allowed border-white/5 bg-white/[0.03] text-zinc-600 opacity-45";

/**
 * Shared dossier toolbar for Builder M / S / E.
 * Primary CTA: neon pill — Secure My Dates / Pay Balance.
 */
export function DossierActionToolbar({
  contactReady,
  costPulsarDone,
  continueHref,
  onHowMuchCost,
  onSave,
  onSend,
  onPrint,
  onInvoice,
  onItinerary,
  invoiceActive = false,
  showInvoice = true,
  resetScope = "full",
  howMuchDisabled = false,
  howMuchLabel = "How much cost?",
  conciergeFeePaid = false,
  tourFullyPaid = false,
}: {
  contactReady: boolean;
  costPulsarDone: boolean;
  continueHref: string;
  onHowMuchCost: () => void;
  onSave?: () => void;
  onSend?: () => void;
  onPrint?: () => void;
  onInvoice?: () => void;
  onItinerary?: () => void;
  invoiceActive?: boolean;
  showInvoice?: boolean;
  resetScope?: "full" | "builder-e";
  howMuchDisabled?: boolean;
  howMuchLabel?: string;
  /** Server/guest fee credit — true after €60 Concierge Fee */
  conciergeFeePaid?: boolean;
  /** Hide pay CTA when tour is fully settled */
  tourFullyPaid?: boolean;
  /** @deprecated graphics removed — kept for call-site compat */
  useGraphicCta?: boolean;
}) {
  const locked = !contactReady;

  return (
    <div
      className="mx-auto flex w-full max-w-lg flex-col gap-2"
      role="toolbar"
      aria-label="Dossier actions"
    >
      {/* Row — Plan/Invoice toggle · Save · Send · Print */}
      <div className="flex items-center gap-1.5">
        {showInvoice ? (
          <PlanInvoiceToggleSwitch
            activeTab={invoiceActive ? "invoice" : "plan"}
            disabled={locked || !onInvoice}
            onChange={(tab) => {
              if (locked) return;
              if (tab === "invoice") onInvoice?.();
              else onItinerary?.();
            }}
            className="shrink-0"
          />
        ) : null}
        <div className="ml-auto grid flex-1 grid-cols-3 gap-1.5">
          <button
            type="button"
            disabled={locked || !onSave}
            onClick={() => {
              if (locked || !onSave) return;
              onSave();
            }}
            aria-label="Save"
            title={locked ? "Save contact first" : "Save"}
            className={`${iconBtnBase} ${locked || !onSave ? iconBtnOff : iconBtnOn}`}
          >
            <Save className="h-3 w-3" aria-hidden />
          </button>
          <button
            type="button"
            disabled={locked || !onSend}
            onClick={() => {
              if (locked || !onSend) return;
              onSend();
            }}
            aria-label="Send"
            title={locked ? "Save contact first" : "Send to TokioTours"}
            className={`${iconBtnBase} ${locked || !onSend ? iconBtnOff : iconBtnOn}`}
          >
            <Send className="h-3 w-3" aria-hidden />
          </button>
          <button
            type="button"
            disabled={locked || !onPrint}
            onClick={() => {
              if (locked || !onPrint) return;
              onPrint();
            }}
            aria-label="Print"
            title={locked ? "Save contact first" : "Print"}
            className={`${iconBtnBase} ${locked || !onPrint ? iconBtnOff : iconBtnOn}`}
          >
            <Printer className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </div>

      {/* Main row: CTA 3/6 · Continue 2/6 · New booking 1/6 */}
      <div className="grid grid-cols-6 items-center gap-1.5">
        <div className="col-span-3 flex min-w-0 justify-stretch">
          <ActionPillButton
            conciergeFeePaid={conciergeFeePaid}
            paymentConfirmed={tourFullyPaid}
            onClick={onHowMuchCost}
            disabled={howMuchDisabled}
            pulse={!costPulsarDone}
            className="w-full [&_span.relative]:w-full [&_span.relative]:justify-center"
          />
        </div>
        <Link
          href={continueHref}
          className="col-span-2 inline-flex items-center justify-center rounded-lg border border-white/20 bg-transparent px-1.5 py-2 text-[8px] font-bold tracking-wider text-zinc-300 uppercase transition hover:bg-white/5"
        >
          ← Continue
        </Link>
        <div className="col-span-1 flex items-stretch [&_button]:h-full [&_button]:w-full [&_button]:min-w-0 [&_button]:rounded-lg [&_button]:p-1.5">
          <NewBookingResetButton variant="icon" scope={resetScope} />
        </div>
      </div>
    </div>
  );
}
