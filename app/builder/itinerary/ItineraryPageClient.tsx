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

type ViewMode = "dossier" | "invoice";

export default function ItineraryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useBuilderStore();
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
    void (async () => {
      await useBuilderStore.persist.rehydrate();
      if (cancelled) return;
      ensureTempBookingRef();
      try {
        const cfg = await fetchBuilderConfig({ includeAccommodations: true });
        if (!cancelled) setConfig(cfg);
      } catch {
        if (!cancelled) setConfig(null);
      }
    })();
    return () => {
      cancelled = true;
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
    <div className="builder-theme min-h-screen overflow-x-hidden bg-[#F5F0E8] pb-44 text-[#0B1F3A] md:pb-36">
      <AppSidebar
        brandEyebrow="TOKIOTOURS"
        brandTitle="Itinerary"
        expandOnHover
      />

      <div className={APP_SIDEBAR_RAIL_PAD}>
        <header className="no-print border-b border-[#E8E2D9] bg-[#FBF8F2] px-4 py-5">
          <div className="mb-3 flex items-center gap-3 lg:hidden">
            <MobileAppNav
              brandEyebrow="TOKIOTOURS"
              brandTitle="Itinerary"
            />
          </div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#4B4B4B]">
            My Itinerary
          </p>
          <h1 className="mt-1 font-display text-3xl">Your Japan Journey</h1>
          <p className="mt-1 text-sm text-[#8A8278]">
            Switch between travel dossier and private quotation.
          </p>

        <div
          className="mt-4 inline-flex rounded-full border border-[#E8E2D9] bg-white p-1 shadow-sm"
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
        </div>

        {activeView === "invoice" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/builder"
              className="rounded-full border border-[#D9D2C7] bg-white px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
            >
              ← Edit builder
            </Link>
            <button
              type="button"
              onClick={requestSendPdf}
              className="rounded-full bg-[#0B1F3A] px-5 py-2 text-sm font-semibold text-white"
            >
              Send / Save PDF
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/builder"
              className="inline-flex rounded-full border border-[#0B1F3A]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1F3A]"
            >
              Continue editing
            </Link>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 py-6 pb-40 md:pb-28">
        {activeView === "dossier" ? (
          <TravelDossierView
            state={state}
            config={config}
            departureIso={depIso}
            dateRanges={dateRanges}
            fleetLabel={fleetLabel}
            arrivalHub={arrivalHub}
            departureHub={departureHub}
          />
        ) : null}

        {/* Always mount full itemized invoice for PDF/print capture (off-screen on dossier). */}
        <div
          className={
            activeView === "invoice"
              ? "print-document rounded-2xl border border-[#E8E2D9] bg-white px-4 py-6 sm:px-6"
              : "invoice-capture-offscreen pointer-events-none fixed left-[-10000px] top-0 z-[-1] w-[800px] bg-white"
          }
          aria-hidden={activeView !== "invoice"}
        >
          <PrintItineraryDocument
            embedded
            showToolbar={false}
            onPrintRequest={requestSendPdf}
          />
        </div>
      </main>
      </div>

      <PriceSummaryFooter
        quoteMin={quote?.min ?? null}
        quoteMax={quote?.max ?? null}
        minPerPerson={minPerPerson}
        maxPerPerson={maxPerPerson}
        totalGuests={totalGuests}
        onRequestPay={handleRequestPay}
        requestDisabled={!quote}
      />

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
        <p className="no-print fixed inset-x-0 bottom-[8.5rem] z-40 mx-auto max-w-3xl px-4 text-center text-xs text-red-700 md:bottom-28">
          <span className="inline-block rounded-lg bg-red-50 px-3 py-2">
            {submitError}
          </span>
        </p>
      ) : null}

      {printResult ? (
        <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#075473]">
              Itinerary saved
            </p>
            <h2 className="mt-2 font-display text-2xl text-[#0B1F3A]">
              PNR {printResult.bookingRef}
            </h2>
            <p className="mt-2 text-sm text-[#5C6570]">{printResult.message}</p>
            <button
              type="button"
              onClick={() => setPrintResult(null)}
              className="mt-5 w-full rounded-full bg-[#0B1F3A] py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {submittedRef ? (
        <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#075473]">
              Payment received
            </p>
            <h2 className="mt-2 font-display text-2xl text-[#0B1F3A]">
              Booking {submittedRef}
            </h2>
            <p className="mt-2 text-sm text-[#5C6570]">
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
                className="flex-1 rounded-full bg-[#0B1F3A] py-2.5 text-sm font-semibold text-white"
              >
                View quotation
              </button>
              <button
                type="button"
                onClick={() => setSubmittedRef(null)}
                className="flex-1 rounded-full border border-[#D9D2C7] py-2.5 text-sm font-semibold text-[#0B1F3A]"
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
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
        active
          ? "bg-[#0B1F3A] text-white"
          : "text-[#5C6570] hover:text-[#0B1F3A]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
