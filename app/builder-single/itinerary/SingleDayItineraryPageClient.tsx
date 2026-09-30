"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileText, Luggage, Printer, Receipt, Save, Send, Wallet } from "lucide-react";
import { submitBookingRequest } from "@/lib/bookingRequest";
import { calculateSingleDayQuote, formatEur } from "@/lib/singleDayPricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { BottomNav } from "@/components/builder/BottomNav";
import { RevolutCheckoutModal } from "@/components/checkout/RevolutCheckoutModal";
import {
  PrintRequestModal,
  type PrintRequestResult,
} from "@/components/checkout/PrintRequestModal";
import { BookingTermsModal } from "@/components/checkout/BookingTermsModal";
import { SingleDayItineraryView } from "@/components/builder-single/SingleDayItineraryView";
import { SingleDayInvoicePrint } from "@/components/builder-single/SingleDayInvoicePrint";
import { SingleDayBudgetModal } from "@/components/builder-s/SingleDayBudgetModal";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
} from "@/components/navigation/AppSidebar";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { IdleHeroMascot } from "@/components/branding/IdleHeroMascot";
import { GoldLight } from "@/components/branding/GoldLight";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";
import {
  fetchPaymentConfigured,
  isSingleDayBuilderComplete,
} from "@/lib/itineraryGates";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { activeBookingRef } from "@/utils/pnr";

type ViewMode = "dossier" | "invoice";

export default function SingleDayItineraryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setTripMode = useBuilderStore((s) => s.setTripMode);
  const ensureTempBookingRef = useBuilderStore((s) => s.ensureTempBookingRef);
  const officialBookingRef = useBuilderStore((s) => s.officialBookingRef);
  const confirmBookingRef = useBuilderStore((s) => s.confirmBookingRef);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const experienceService = useBuilderStore((s) => s.experienceService);

  const clientName = useItineraryStore((s) => s.clientName);
  const clientEmail = useItineraryStore((s) => s.clientEmail);
  const preName = usePreBuilderStore(
    (s) => s.fullName || s.lastPayload?.fullName || ""
  );
  const preEmail = usePreBuilderStore(
    (s) => s.email || s.lastPayload?.email || ""
  );
  const customerName = (clientName || preName || "").trim() || "Guest";
  const guestEmail = (clientEmail || preEmail || "").trim().toLowerCase();
  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);

  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const guidePreference = useSingleDayBuilderStore((s) => s.guidePreference);
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );
  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const experiencesStepDone = useSingleDayBuilderStore(
    (s) => s.experiencesStepDone
  );

  const [activeView, setActiveView] = useState<ViewMode>("dossier");
  const [hydrated, setHydrated] = useState(false);
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
  const [budgetOpen, setBudgetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await useBuilderStore.persist.rehydrate();
      await useSingleDayBuilderStore.persist.rehydrate();
      if (cancelled) return;
      setTripMode("single_day");
      ensureTempBookingRef();
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureTempBookingRef, setTripMode]);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "invoice" || v === "print") setActiveView("invoice");
    if (v === "dossier") setActiveView("dossier");
  }, [searchParams]);

  const conciergeActive =
    isEliteConcierge || experienceService === "concierge";

  const quote = useMemo(
    () =>
      calculateSingleDayQuote({
        guidePreference,
        tourHours,
        experiencePrices: selectedExperiences.map((e) => Number(e.price) || 0),
        conciergeActive,
      }),
    [guidePreference, tourHours, selectedExperiences, conciergeActive]
  );

  const totalGuests = Math.max(1, adults + children);
  void totalGuests;

  const setMode = (mode: ViewMode) => {
    setActiveView(mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", mode);
    router.replace(`/builder-single/itinerary?${params.toString()}`, {
      scroll: false,
    });
  };

  const requestInvoiceView = async () => {
    if (activeView === "invoice") return;
    const okPay = await fetchPaymentConfigured();
    if (!okPay) {
      showSystemMessage({
        text: getSystemMessage("payment_not_ready"),
        tone: "error",
      });
      return;
    }
    if (
      !isSingleDayBuilderComplete({
        tourDate,
        tourHours,
        adults,
        cityFocus,
        selectedExperienceCount: selectedExperiences.length,
        experiencesStepDone,
      })
    ) {
      showSystemMessage({
        text: getSystemMessage("builder_incomplete"),
        tone: "error",
      });
      return;
    }
    setTermsIntent("invoice");
    setTermsOpen(true);
  };

  const requestSendPdf = async () => {
    const okPay = await fetchPaymentConfigured();
    if (!okPay) {
      showSystemMessage({
        text: getSystemMessage("payment_not_ready"),
        tone: "error",
      });
      return;
    }
    if (
      !isSingleDayBuilderComplete({
        tourDate,
        tourHours,
        adults,
        cityFocus,
        selectedExperienceCount: selectedExperiences.length,
        experiencesStepDone,
      })
    ) {
      showSystemMessage({
        text: getSystemMessage("builder_incomplete"),
        tone: "error",
      });
      return;
    }
    setTermsIntent("print");
    setTermsOpen(true);
  };

  const requestSaveOnly = async () => {
    const ref = activeBookingRef({
      tempBookingRef,
      confirmedBookingRef,
      bookingStatus,
    });
    if (!guestEmail) {
      showSystemMessage({
        text: "Add your email in Pre-Elite / booking details before saving.",
        tone: "error",
      });
      return;
    }
    const sd = useSingleDayBuilderStore.getState();
    const { syncSingleDayBookingLead } = await import("@/lib/syncBookingLead");
    const ok = await syncSingleDayBookingLead({
      bookingRef: ref,
      email: guestEmail,
      state: sd,
      status: "in_progress",
      quote: quote ? { min: quote.min, max: quote.max } : undefined,
    });
    showSystemMessage({
      text: ok ? "Itinerary saved." : "Could not save itinerary.",
      tone: ok ? "info" : "error",
    });
  };

  const requestPrintOnly = () => {
    window.print();
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
      const builderState = useBuilderStore.getState();
      const result = await submitBookingRequest({
        state: { ...builderState, tripMode: "single_day" },
        quote: {
          min: quote.min,
          max: quote.max,
          vehiclesNeeded: "1 × Private day vehicle",
        },
        departureDate: tourDate,
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
        void import("@/lib/syncBookingLead").then(({ syncSingleDayBookingLead }) =>
          syncSingleDayBookingLead({
            bookingRef: result.reference,
            email,
            state: useSingleDayBuilderStore.getState(),
            status: "quoted",
            quote: { min: quote.min, max: quote.max },
          })
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

  if (!hydrated) {
    return (
      <p className="p-10 text-center text-sm text-white/50">
        Loading single-day itinerary…
      </p>
    );
  }

  return (
    <div className="builder-theme relative z-10 min-h-screen overflow-x-hidden bg-transparent pb-44 text-white md:pb-36">
      <SystemMessageFox />
      <AppSidebar
        brandEyebrow="TOKIOTOURS"
        brandTitle="Itinerary"
        expandOnHover
      />

      <div className={APP_SIDEBAR_RAIL_PAD}>
        <MobileTopChrome
          brandTitle="Itinerary"
          ctaHref="/builder-single"
          ctaLabel="Builder"
        />
        <div className="mx-auto mt-4 max-w-3xl px-4 sm:px-5">
          <header className="group no-print relative overflow-visible rounded-2xl border border-white/10 bg-[#0A1017]/80 px-4 py-5 shadow-2xl backdrop-blur-md sm:px-5">
            <div
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl"
              aria-hidden
            >
              <GoldLight color="#F6A724" active />
            </div>
            <div className="relative z-10">
          <div className="relative grid grid-cols-3 items-end gap-2">
            <div className="col-span-2 min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#F6A724]">
                Builder S · Itinerary
              </p>
              <h1 className="mt-1 break-words font-godiva text-2xl uppercase leading-tight tracking-wide text-white sm:text-3xl">
                {customerName}
              </h1>
              <h2 className="mt-0.5 font-godiva text-[1.125rem] uppercase tracking-wider text-white/90">
                Single Day Tour Dossier
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Hour-by-hour day plan and private single-day quotation.
              </p>
            </div>
            <div className="col-span-1 flex justify-end self-end">
              <IdleHeroMascot
                activeSrc="/brand/mascot-phone.webp"
                idleSrc="/brand/mascot-time.webp"
                idleMs={7_000}
                className="z-[1] -mb-2 h-28 w-auto select-none object-contain sm:h-36 md:h-40"
              />
            </div>
          </div>

          <div
            className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-2"
            role="tablist"
            aria-label="Single-day itinerary view"
          >
            <div className="grid grid-cols-2 gap-2">
              <ToggleBtn
                active={activeView === "dossier"}
                onClick={() => setMode("dossier")}
                icon={<Luggage className="h-3.5 w-3.5" />}
                label="Travel Dossier"
                className="w-full justify-center"
              />
              <ToggleBtn
                active={activeView === "invoice"}
                onClick={requestInvoiceView}
                icon={<Receipt className="h-3.5 w-3.5" />}
                label="Invoice"
                className="w-full justify-center"
              />
            </div>
            <div className="grid grid-cols-5 items-center gap-2">
              <button
                type="button"
                onClick={() => void requestSaveOnly()}
                aria-label="Save"
                title="Save"
                className="col-span-1 inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/40 p-2.5 text-zinc-200 hover:text-white"
              >
                <Save className="h-4 w-4" aria-hidden />
              </button>
              <span className="col-span-1" aria-hidden />
              <button
                type="button"
                onClick={() => void requestSendPdf()}
                aria-label="Send"
                title="Send"
                className="col-span-1 inline-flex items-center justify-center rounded-xl bg-[#075473] p-2.5 text-white hover:bg-[#064560]"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
              <span className="col-span-1" aria-hidden />
              <button
                type="button"
                onClick={requestPrintOnly}
                aria-label="Print"
                title="Print"
                className="col-span-1 inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/40 p-2.5 text-zinc-200 hover:text-white"
              >
                <Printer className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-5 items-center gap-2">
              <Link
                href="/builder-single"
                className="col-span-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-black/30 px-3.5 py-2 text-[11px] font-bold tracking-wider text-zinc-300 uppercase transition-all hover:bg-black/60"
              >
                ← Continue editing
              </Link>
              <span className="col-span-1" aria-hidden />
              <div className="col-span-1 flex justify-end">
                <NewBookingResetButton variant="nav" />
              </div>
            </div>
          </div>
          </div>
        </header>
        </div>

        <main className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 py-6 pb-40 md:pb-28">
          <div
            className={
              activeView === "dossier"
                ? undefined
                : "invoice-capture-offscreen pointer-events-none fixed left-[-10000px] top-0 z-[-1] w-[800px] bg-[#0D1117]"
            }
            aria-hidden={activeView !== "dossier"}
          >
            <SingleDayItineraryView />
          </div>

          <div
            className={
              activeView === "invoice"
                ? "print-document rounded-2xl border border-white/10 bg-[#0D1117] px-4 py-6 sm:px-6"
                : "invoice-capture-offscreen pointer-events-none fixed left-[-10000px] top-0 z-[-1] w-[800px] bg-[#0D1117]"
            }
            aria-hidden={activeView !== "invoice"}
          >
            <SingleDayInvoicePrint
              embedded
              showToolbar={false}
              onPrintRequest={requestSendPdf}
            />
          </div>
        </main>
      </div>

      {/* Compact dual-action bar: Request/Pay + Target Budget */}
      <div className="no-print sticky-action-bar fixed inset-x-0 bottom-16 z-30 mb-2 w-full overflow-x-hidden md:bottom-4 lg:left-16 lg:pl-0">
        <div className="mx-auto flex w-full max-w-5xl px-2 sm:px-4">
          <div className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-[#0D1117]/95 p-2 shadow-2xl backdrop-blur-md sm:gap-3 sm:p-2.5">
            <div className="min-w-0 flex-1 pl-1 sm:pl-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#00B4D8]">
                Single-Day Package
              </p>
              <p className="truncate text-sm font-extrabold text-white sm:text-base">
                {formatEur(quote.totalEur)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBudgetOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-white/10 sm:px-4 sm:text-xs"
            >
              <Wallet className="h-3.5 w-3.5" />
              Target Budget
            </button>
            <button
              type="button"
              onClick={handleRequestPay}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#075473] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-white transition hover:bg-[#05384c] sm:px-4 sm:text-xs"
            >
              Request / Pay
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
        {submitError ? (
          <p className="mx-auto mt-2 max-w-5xl px-4 text-center text-xs text-[#E60F43]">
            {submitError}
          </p>
        ) : null}
        {submittedRef ? (
          <p className="mx-auto mt-2 max-w-5xl px-4 text-center text-xs text-[#1CA67F]">
            Request received · {submittedRef}
          </p>
        ) : null}
      </div>

      <SingleDayBudgetModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
      />

      <RevolutCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        bookingRef={checkoutRef}
        totalAmount={quote.max}
        totalAmountMin={quote.min}
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
              Proposal saved
            </p>
            <h2 className="mt-2 font-display text-2xl text-[#0B1F3A]">
              PNR {printResult.bookingRef}
            </h2>
            <p className="mt-2 text-sm text-[#5C6570]">{printResult.message}</p>
            <button
              type="button"
              onClick={() => {
                setPrintResult(null);
                document
                  .querySelectorAll(".html2pdf__overlay, .html2pdf__container")
                  .forEach((node) => node.remove());
                document.body.style.overflow = "";
              }}
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
              Thank you. Your single-day tour is locked. A travel expert will
              confirm guide language and final ticketing.
            </p>
            <button
              type="button"
              onClick={() => setSubmittedRef(null)}
              className="mt-5 w-full rounded-full bg-[#0B1F3A] py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
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
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
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
      } ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}
