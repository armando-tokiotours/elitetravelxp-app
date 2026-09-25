"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Plane } from "lucide-react";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote } from "@/lib/builder-pricing";
import { submitBookingRequest } from "@/lib/bookingRequest";
import { calculateCityDateRanges } from "@/lib/dateCascade";
import { allocateFleet } from "@/lib/vehicleAllocator";
import { useBuilderStore } from "@/store/useBuilderStore";
import { BottomNav } from "@/components/builder/BottomNav";
import { RevolutCheckoutModal } from "@/components/checkout/RevolutCheckoutModal";
import {
  PrintRequestModal,
  type PrintRequestResult,
} from "@/components/checkout/PrintRequestModal";
import { BookingTermsModal } from "@/components/checkout/BookingTermsModal";
import { PrintItineraryDocument } from "@/components/builder/PrintItineraryDocument";
import {
  TravelDossierView,
  resolveHub,
} from "@/components/builder/TravelDossierView";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { PriceSummaryFooter } from "@/components/builder/PriceSummaryFooter";
import { DossierSectionOutline } from "@/components/builder/DossierSectionOutline";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";

type ViewMode = "dossier" | "invoice";

export default function ItineraryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useBuilderStore((s) => s);
  const departureDate = useBuilderStore((s) => s.departureDate);
  const ensureTempBookingRef = useBuilderStore((s) => s.ensureTempBookingRef);
  const officialBookingRef = useBuilderStore((s) => s.officialBookingRef);
  const confirmBookingRef = useBuilderStore((s) => s.confirmBookingRef);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>("dossier");
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutRef, setCheckoutRef] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [printSkipTerms, setPrintSkipTerms] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [printResult, setPrintResult] = useState<PrintRequestResult | null>(
    null
  );
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsIntent, setTermsIntent] = useState<"invoice" | "print" | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    const boot = () => {
      if (cancelled) return;
      ensureTempBookingRef();
      void fetchBuilderConfig({ includeAccommodations: true })
        .then((cfg) => {
          if (!cancelled) setConfig(cfg);
        })
        .catch(() => {
          if (!cancelled) setConfig(null);
        });
    };

    const unsub = useBuilderStore.persist.onFinishHydration(boot);
    void Promise.resolve(useBuilderStore.persist.rehydrate()).then(boot);

    return () => {
      cancelled = true;
      unsub();
    };
  }, [ensureTempBookingRef]);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "invoice" || v === "print") setActiveView("invoice");
    if (v === "dossier") setActiveView("dossier");
  }, [searchParams]);

  // Keep multi-day itinerary isolated — send Builder S traffic to its own dossier.
  useEffect(() => {
    if (state.tripMode === "single_day") {
      const view = searchParams.get("view");
      const q =
        view === "invoice" || view === "print"
          ? "?view=invoice"
          : view === "dossier"
            ? "?view=dossier"
            : "";
      router.replace(`/builder-single/itinerary${q}`);
    }
  }, [state.tripMode, router, searchParams]);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  const totalGuests = Math.max(1, state.adults + state.children);
  const minPerPerson = quote
    ? Math.round(quote.min / totalGuests)
    : null;
  const maxPerPerson = quote
    ? Math.round(quote.max / totalGuests)
    : null;

  const totalPax = state.adults + state.children;
  const depIso = departureDate();

  const arrivalHub = resolveHub(config, state.arrivalTransferId);
  const departureHub = resolveHub(config, state.departureTransferId);

  const dateRanges = useMemo(
    () => calculateCityDateRanges(state.arrivalDate, state.locations),
    [state.arrivalDate, state.locations]
  );

  const fleetLabel = useMemo(() => {
    if (!config?.vehicles?.length || totalPax <= 0) return null;
    const fleet = allocateFleet(totalPax, config.vehicles);
    if (!fleet.units.length) return null;
    return `${fleet.label.replace("×", "x")} (${totalPax} pax)`;
  }, [config?.vehicles, totalPax]);

  const setMode = (mode: ViewMode) => {
    setActiveView(mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", mode);
    router.replace(`/builder/itinerary?${params.toString()}`, {
      scroll: false,
    });
  };

  const requestInvoiceView = () => {
    if (activeView === "invoice") return;
    setTermsIntent("invoice");
    setTermsOpen(true);
  };

  const requestSendPdf = () => {
    setTermsIntent("print");
    setTermsOpen(true);
  };

  const handleTermsConfirm = () => {
    const intent = termsIntent;
    setTermsOpen(false);
    setTermsIntent(null);
    if (intent === "invoice") {
      setMode("invoice");
      return;
    }
    if (intent === "print") {
      setPrintSkipTerms(true);
      setPrintOpen(true);
    }
  };

  const handleTermsCancel = () => {
    setTermsOpen(false);
    setTermsIntent(null);
  };

  const handleRequestPay = () => {
    setSubmitError(null);
    setCheckoutRef(officialBookingRef());
    setIsCheckoutModalOpen(true);
  };

  const handlePaymentSuccess = async (paymentDetails: {
    bookingRef: string;
    paymentType: string;
    amountPaid: number;
    currency: string;
    orderId: string | null;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
  }) => {
    try {
      const pct =
        paymentDetails.paymentType === "full"
          ? 100
          : paymentDetails.paymentType === "partial"
            ? 50
            : 10;
      const result = await submitBookingRequest({
        state,
        quote,
        departureDate: depIso,
        reference: paymentDetails.bookingRef,
        contactEmail: paymentDetails.customerEmail,
        contactName: paymentDetails.customerName,
        contactPhone: paymentDetails.customerPhone,
        depositPercent: pct,
        depositMin: paymentDetails.amountPaid,
        depositMax: paymentDetails.amountPaid,
        payment: {
          provider: "revolut",
          paymentType: paymentDetails.paymentType,
          amountPaid: paymentDetails.amountPaid,
          currency: paymentDetails.currency,
          orderId: paymentDetails.orderId,
        },
      });
      confirmBookingRef(result.reference, "in_progress");
      setSubmittedRef(result.reference);

      const email = String(paymentDetails.customerEmail || "")
        .trim()
        .toLowerCase();
      if (email && result.reference) {
        void import("@/lib/syncBookingLead").then(
          ({ syncMultiDayBookingLead, syncSingleDayBookingLead }) => {
            if (state.tripMode === "single_day") {
              void import("@/store/useSingleDayBuilderStore").then(
                ({ useSingleDayBuilderStore }) =>
                  syncSingleDayBookingLead({
                    bookingRef: result.reference,
                    email,
                    state: useSingleDayBuilderStore.getState(),
                    status: "quoted",
                    quote: quote ? { min: quote.min, max: quote.max } : null,
                  })
              );
            } else {
              void syncMultiDayBookingLead({
                bookingRef: result.reference,
                email,
                state,
                status: "quoted",
                quote: quote ? { min: quote.min, max: quote.max } : null,
              });
            }
          }
        );
      }
    } catch (e) {
      confirmBookingRef(paymentDetails.bookingRef, "in_progress");
      setSubmitError(
        e instanceof Error
          ? e.message
          : "Payment succeeded but saving the booking failed. Contact concierge with your booking ref."
      );
      setSubmittedRef(paymentDetails.bookingRef);
    }
  };

  return (
    <div className="builder-theme relative z-10 min-h-screen w-full overflow-x-hidden bg-transparent pb-28 text-white md:pb-20">
      <AppSidebar
        brandEyebrow="TOKIOTOURS"
        brandTitle="Itinerary"
        expandOnHover
      />

      <div className={APP_SIDEBAR_RAIL_PAD}>
        <div className="mx-auto w-full max-w-md px-4 py-6 md:max-w-lg lg:max-w-2xl">
          <div className="mb-3 flex items-center gap-3 lg:hidden">
            <MobileAppNav
              brandEyebrow="TOKIOTOURS"
              brandTitle="Itinerary"
            />
          </div>

          {/* Section 1 — Hero header + navigation actions */}
          <DossierSectionOutline
            label="Section 1: Hero & Nav"
            className="no-print my-4"
          >
            <header className="space-y-4 text-left">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-widest text-amber-400 uppercase">
                  My Itinerary
                </p>
                <h1 className="mt-1 font-godiva text-2xl tracking-wide text-white uppercase md:text-3xl">
                  Your Japan Journey
                </h1>
                <p className="mt-1 text-xs text-zinc-400">
                  Switch between travel dossier and private quotation.
                </p>
              </div>

              <div
                className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2"
                role="tablist"
                aria-label="Itinerary view"
              >
                <ToggleBtn
                  active={activeView === "dossier"}
                  onClick={() => setMode("dossier")}
                  icon={<Plane className="h-3.5 w-3.5" />}
                  label="Travel Dossier"
                />
                <ToggleBtn
                  active={activeView === "invoice"}
                  onClick={requestInvoiceView}
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Invoice / Print"
                />
                {activeView === "invoice" ? (
                  <>
                    <Link
                      href="/builder"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-black/30 px-3.5 py-2 text-[11px] font-bold tracking-wider text-zinc-300 uppercase transition-all hover:bg-black/60"
                    >
                      ← Edit builder
                    </Link>
                    <button
                      type="button"
                      onClick={requestSendPdf}
                      className="rounded-xl bg-[#075473] px-3.5 py-2 text-[11px] font-bold tracking-wider text-white uppercase"
                    >
                      Send / Save PDF
                    </button>
                  </>
                ) : (
                  <Link
                    href="/builder"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-black/30 px-3.5 py-2 text-[11px] font-bold tracking-wider text-zinc-300 uppercase transition-all hover:bg-black/60"
                  >
                    ← Continue editing
                  </Link>
                )}
                <NewBookingResetButton variant="nav" />
              </div>
            </header>
          </DossierSectionOutline>

          <main className="mt-6 w-full overflow-x-hidden pb-8">
            {activeView === "dossier" ? (
              <TravelDossierView
                state={state}
                config={config}
                departureIso={depIso}
                dateRanges={dateRanges}
                fleetLabel={fleetLabel}
                arrivalHub={arrivalHub}
                departureHub={departureHub}
                afterSummary={
                  <PriceSummaryFooter
                    placement="inline"
                    quoteMin={quote?.min ?? null}
                    quoteMax={quote?.max ?? null}
                    minPerPerson={minPerPerson}
                    maxPerPerson={maxPerPerson}
                    totalGuests={totalGuests}
                    onRequestPay={handleRequestPay}
                    requestDisabled={!quote}
                  />
                }
              />
            ) : null}

            {/* Always mount full itemized invoice for PDF/print capture (off-screen on dossier). */}
            <div
              className={
                activeView === "invoice"
                  ? "mt-4 rounded-2xl border border-white/10 bg-[#0A1017]/80 px-4 py-6 shadow-2xl backdrop-blur-md sm:px-6"
                  : "invoice-capture-offscreen pointer-events-none fixed left-[-10000px] top-0 z-[-1] w-[800px] bg-[#0D1117]"
              }
              aria-hidden={activeView !== "invoice"}
            >
              <PrintItineraryDocument
                embedded
                showToolbar={false}
                onPrintRequest={requestSendPdf}
              />
            </div>

            {activeView === "invoice" ? (
              <div className="mt-4">
                <PriceSummaryFooter
                  placement="inline"
                  quoteMin={quote?.min ?? null}
                  quoteMax={quote?.max ?? null}
                  minPerPerson={minPerPerson}
                  maxPerPerson={maxPerPerson}
                  totalGuests={totalGuests}
                  onRequestPay={handleRequestPay}
                  requestDisabled={!quote}
                />
              </div>
            ) : null}
          </main>
        </div>
      </div>

      <RevolutCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        bookingRef={checkoutRef}
        totalAmount={quote?.max ?? 0}
        totalAmountMin={quote?.min}
        currency="EUR"
        defaultDepositPercent={10}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentError={setSubmitError}
      />

      <BookingTermsModal
        open={termsOpen}
        onConfirm={handleTermsConfirm}
        onCancel={handleTermsCancel}
      />

      <PrintRequestModal
        isOpen={printOpen}
        skipTerms={printSkipTerms}
        onClose={() => {
          setPrintOpen(false);
          setPrintSkipTerms(false);
        }}
        onSuccess={(result) => {
          setPrintResult(result);
        }}
      />

      {submitError && !isCheckoutModalOpen ? (
        <p className="no-print fixed inset-x-0 bottom-24 z-40 mx-auto max-w-md px-4 text-center text-xs text-[#D9718C]">
          <span className="inline-block rounded-xl border border-[#D9718C]/30 bg-[#0A1017]/95 px-3 py-2">
            {submitError}
          </span>
        </p>
      ) : null}

      {printResult ? (
        <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1017]/80 p-6 shadow-2xl backdrop-blur-md">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#F6A724]">
              Itinerary saved
            </p>
            <h2 className="mt-2 font-godiva text-2xl uppercase tracking-wide text-white">
              PNR {printResult.bookingRef}
            </h2>
            <p className="mt-2 text-sm text-white/65">{printResult.message}</p>
            <button
              type="button"
              onClick={() => {
                setPrintResult(null);
                setPrintOpen(false);
                setPrintSkipTerms(false);
                document
                  .querySelectorAll(".html2pdf__overlay, .html2pdf__container")
                  .forEach((node) => node.remove());
                document.body.style.overflow = "";
              }}
              className="mt-5 w-full rounded-full bg-[#075473] py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {submittedRef ? (
        <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1017]/80 p-6 shadow-2xl backdrop-blur-md">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#F6A724]">
              Payment received
            </p>
            <h2 className="mt-2 font-godiva text-2xl uppercase tracking-wide text-white">
              Booking {submittedRef}
            </h2>
            <p className="mt-2 text-sm text-white/65">
              Thank you. Your quotation is locked. A travel expert will arrange
              the final details and confirm any remaining balance.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setSubmittedRef(null);
                  setMode("invoice");
                }}
                className="flex-1 rounded-full bg-[#075473] py-2.5 text-sm font-semibold text-white"
              >
                View quotation
              </button>
              <button
                type="button"
                onClick={() => setSubmittedRef(null)}
                className="flex-1 rounded-full border border-white/20 bg-white/5 py-2.5 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="no-print">
        <BottomNav />
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold tracking-wider uppercase transition-all ${
        active
          ? "border border-cyan-400/30 bg-[#075473] text-white shadow-md"
          : "border border-white/10 bg-black/40 text-zinc-400 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
