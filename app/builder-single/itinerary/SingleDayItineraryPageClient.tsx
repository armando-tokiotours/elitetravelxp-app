"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet } from "lucide-react";
import { submitBookingRequest } from "@/lib/bookingRequest";
import {
  calculateSingleDayQuote,
  formatEur,
  singleDayPerPersonEur,
} from "@/lib/singleDayPricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { RevolutCheckoutModal } from "@/components/checkout/RevolutCheckoutModal";
import {
  PrintRequestModal,
  type PrintRequestResult,
} from "@/components/checkout/PrintRequestModal";
import { SingleDayItineraryView } from "@/components/builder-single/SingleDayItineraryView";
import { GuestTalkBubble } from "@/components/dossier/GuestTalkBubble";
import { ThankYouPassMascot } from "@/components/branding/PandaFlexibleMascot";
import { LiquidGlassHero } from "@/components/guest/LiquidGlassHero";
import { TicketVoucherDownloadBanner } from "@/components/dossier/TicketVoucherDownloadBanner";
import { ActionPillButton } from "@/components/ui/ActionPillButton";
import {
  ConciergeCommitmentFlow,
  ConciergeFeeModal,
  type ConciergePathOption,
} from "@/components/checkout/ConciergeCommitmentFlow";
import { SaveForLaterOptionsModal } from "@/components/checkout/SaveForLaterOptionsModal";
import { BalancePaymentModal } from "@/components/checkout/BalancePaymentModal";
import type { BalancePayOption } from "@/lib/balanceSettlement";
import {
  DEFAULT_CONCIERGE_FEE_EUR,
  loadConciergeEstimateCopy,
} from "@/lib/conciergeEstimateFlow";
import { SingleDayInvoicePrint } from "@/components/builder-single/SingleDayInvoicePrint";
import { SingleDayBudgetModal } from "@/components/builder-s/SingleDayBudgetModal";
import { SaveRequiredContactModal } from "@/components/builder/SaveRequiredContactModal";
import { TopNavBar } from "@/components/navigation/TopNavBar";
import { BUILDER_ROUTES } from "@/lib/builderRoutes";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";
import { dossierPrimaryCtaLabel } from "@/lib/tourPaymentStatus";
import { activeBookingRef } from "@/utils/pnr";
import {
  hasGuestContact,
  saveContactAndCreateDraft,
} from "@/lib/saveContactGate";
import {
  fetchPaymentConfigured,
  isSingleDayBuilderComplete,
  singleDayIncompleteFoxMessage,
} from "@/lib/itineraryGates";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";

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
  const preferredMovement = useSingleDayBuilderStore((s) => s.preferredMovement);
  const suicaNeeded = useSingleDayBuilderStore((s) => s.suicaNeeded);
  const suicaValueEur = useSingleDayBuilderStore((s) => s.suicaValueEur);
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
  const [feeCreditEur, setFeeCreditEur] = useState(0);
  const [printResult, setPrintResult] = useState<PrintRequestResult | null>(
    null
  );
  /** Pulsar on Send until guest opens the send flow once */
  const [sendPulsarDone, setSendPulsarDone] = useState(false);
  const [costPulsarDone, setCostPulsarDone] = useState(false);
  const [saveLaterOpen, setSaveLaterOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [saveContactOpen, setSaveContactOpen] = useState(false);
  const [pendingAfterSave, setPendingAfterSave] = useState<
    "estimate" | "budget" | null
  >(null);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [selectedPath, setSelectedPath] = useState<ConciergePathOption | null>(
    null
  );
  const [conciergeFeeEur, setConciergeFeeEur] = useState(
    DEFAULT_CONCIERGE_FEE_EUR
  );
  const [checkoutMode, setCheckoutMode] = useState<
    "deposit" | "concierge_fee" | "balance"
  >("deposit");
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState(0);
  const [balanceOption, setBalanceOption] =
    useState<BalancePayOption>("30_PERCENT");
  const [totalPaidEur, setTotalPaidEur] = useState(0);

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
    if (!hydrated) return;
    const ref = activeBookingRef({
      tempBookingRef,
      confirmedBookingRef,
      bookingStatus,
    });
    void import("@/lib/feeCredit").then(({ hydrateConciergeFeeCredit }) => {
      void hydrateConciergeFeeCredit(ref).then((eur) => {
        setFeeCreditEur(eur);
        if (eur > 0) setTotalPaidEur((prev) => (prev > 0 ? prev : eur));
      });
    });
  }, [hydrated, tempBookingRef, confirmedBookingRef, bookingStatus]);

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
        preferredMovement,
        suicaNeeded,
        suicaValueEur,
        guests: Math.max(1, adults + children),
      }),
    [
      guidePreference,
      tourHours,
      selectedExperiences,
      conciergeActive,
      preferredMovement,
      suicaNeeded,
      suicaValueEur,
      adults,
      children,
    ]
  );

  const preDraftStatus = usePreBuilderStore((s) => s.pnrDraftStatus);
  const preWhatsapp = usePreBuilderStore((s) => s.whatsapp);
  const contactReady = Boolean(
    (clientName || preName || "").trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        (clientEmail || preEmail || "").trim().toLowerCase()
      ) &&
      String(preWhatsapp || "").replace(/\D/g, "").length >= 7 &&
      (preDraftStatus === "SAVED" ||
        Boolean(
          String(usePreBuilderStore.getState().lastPayload?.bookingRef || "").trim()
        ))
  );

  const totalGuests = Math.max(1, adults + children);

  const requireContactOr = (next: "estimate" | "budget", proceed: () => void) => {
    if (hasGuestContact()) {
      proceed();
      return;
    }
    setPendingAfterSave(next);
    setSaveContactOpen(true);
  };

  const handleRequestPay = () => {
    setSubmitError(null);
    setCostPulsarDone(true);
    if (feeCreditEur > 0) {
      void requestInvoiceView();
      setBalanceOpen(true);
      return;
    }
    requireContactOr("estimate", () => setShowEstimateModal(true));
  };

  const handleBalanceConfirm = (option: BalancePayOption, amountEur: number) => {
    setBalanceOption(option);
    setBalanceAmount(amountEur);
    setBalanceOpen(false);
    setCheckoutMode("balance");
    setCheckoutRef(officialBookingRef());
    setIsCheckoutModalOpen(true);
  };

  const handleBalancePaymentSuccess = async (paymentDetails: {
    bookingRef: string;
    amountPaid: number;
    orderId: string | null;
  }) => {
    try {
      void import("@/lib/recordPayment").then(({ recordPaymentSuccess }) =>
        recordPaymentSuccess({
          pnr: paymentDetails.bookingRef,
          kind: balanceOption === "FULL" ? "tour_full" : "tour_partial",
          amountEur: paymentDetails.amountPaid,
          orderId: paymentDetails.orderId,
          guestEmail,
          guestName: customerName,
          builder: "single",
          estimatedTotalEur: quote.totalEur || quote.max,
          notes:
            balanceOption === "FULL"
              ? "Full tour balance settlement"
              : "30% progress payment on pending balance",
        })
      );
      setTotalPaidEur((prev) => prev + paymentDetails.amountPaid);
      setSubmittedRef(paymentDetails.bookingRef);
      setIsCheckoutModalOpen(false);
      setCheckoutMode("deposit");
      showSystemMessage({
        text:
          balanceOption === "FULL"
            ? "Full tour balance received — thank you."
            : "Progress payment received — remaining balance due before travel.",
        tone: "info",
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not record balance payment."
      );
    }
  };



  const openBudget = () => {
    requireContactOr("budget", () => setBudgetOpen(true));
  };

  const handleSelectEstimatePath = (path: ConciergePathOption) => {
    setSelectedPath(path);
    setShowEstimateModal(false);
    void loadConciergeEstimateCopy().then((c) => {
      setConciergeFeeEur(c.feeAmountEur);
    });
    // Persist draft before deposit so Ops sees FULL vs PARTIAL intent
    void requestSaveOnly();
    setShowFeeModal(true);
  };

  const handleSaveForLater = async () => {
    setShowEstimateModal(false);
    const ref = activeBookingRef({
      tempBookingRef,
      confirmedBookingRef,
      bookingStatus,
    });
    try {
      await fetch("/api/bookings/concierge-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_later",
          pnr: ref,
          tourDate,
        }),
      });
      showSystemMessage({
        text: "Saved as draft — open Send to get your email copy, or we’ll follow up closer to your trip.",
        tone: "info",
      });
    } catch {
      showSystemMessage({
        text: "Could not save follow-up. Your draft is still local.",
        tone: "error",
      });
    }
  };

  const handleSaveDraftAndEmail = async () => {
    setShowEstimateModal(false);
    await handleSaveForLater();
    setPrintSkipTerms(true);
    setPrintOpen(true);
  };

  const handleConciergeFeePay = () => {
    setShowFeeModal(false);
    setCheckoutMode("concierge_fee");
    setCheckoutRef(officialBookingRef());
    setIsCheckoutModalOpen(true);
  };

  const handleConciergeFeeSuccess = async (paymentDetails: {
    bookingRef: string;
    amountPaid: number;
    orderId: string | null;
  }) => {
    try {
      await fetch("/api/bookings/concierge-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fee_paid",
          pnr: paymentDetails.bookingRef,
          amount: paymentDetails.amountPaid,
          orderId: paymentDetails.orderId,
          path: selectedPath || "FULL",
        }),
      });
      void import("@/lib/recordPayment").then(({ recordPaymentSuccess }) =>
        recordPaymentSuccess({
          pnr: paymentDetails.bookingRef,
          kind: "concierge_deposit",
          amountEur: paymentDetails.amountPaid,
          orderId: paymentDetails.orderId,
          path: selectedPath || "FULL",
          guestEmail,
          guestName: customerName,
          builder: "single",
        })
      );
      void import("@/lib/feeCredit").then(({ markConciergeFeePaid }) =>
        markConciergeFeePaid(
          paymentDetails.bookingRef,
          paymentDetails.amountPaid
        )
      );
      confirmBookingRef(paymentDetails.bookingRef, "in_progress");
      setSubmittedRef(paymentDetails.bookingRef);
      setFeeCreditEur(paymentDetails.amountPaid);
      if (guestEmail) {
        void import("@/lib/syncBookingLead").then(({ syncSingleDayBookingLead }) =>
          syncSingleDayBookingLead({
            bookingRef: paymentDetails.bookingRef,
            email: guestEmail,
            state: useSingleDayBuilderStore.getState(),
            status: "in_progress",
            quote: { min: quote.min, max: quote.max },
          })
        );
      }
      showSystemMessage({
        text: "Deposit received — your dates are held. An agent will contact you soon.",
        tone: "info",
      });
    } catch {
      setSubmitError(
        "Payment succeeded but status update failed. Contact concierge with your booking ref."
      );
      setSubmittedRef(paymentDetails.bookingRef);
    } finally {
      setCheckoutMode("deposit");
      setSelectedPath(null);
    }
  };

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
        text: singleDayIncompleteFoxMessage({
          tourDate,
          tourHours,
          adults,
          cityFocus,
          selectedExperienceCount: selectedExperiences.length,
          experiencesStepDone,
        }),
        tone: "error",
      });
      return;
    }
    setMode("invoice");
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
        text: singleDayIncompleteFoxMessage({
          tourDate,
          tourHours,
          adults,
          cityFocus,
          selectedExperienceCount: selectedExperiences.length,
          experiencesStepDone,
        }),
        tone: "error",
      });
      return;
    }
    setSendPulsarDone(true);
    setPrintSkipTerms(true);
    setPrintOpen(true);
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
      // Autosave stays draft (BAL "lead") until Save & Email / submit
      status: "lead",
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
      void import("@/lib/recordPayment").then(({ recordPaymentSuccess }) =>
        recordPaymentSuccess({
          pnr: result.reference,
          kind:
            paymentDetails.paymentType === "full"
              ? "tour_full"
              : paymentDetails.paymentType === "partial"
                ? "tour_partial"
                : "tour_deposit",
          amountEur: paymentDetails.amountPaid,
          currency: paymentDetails.currency,
          orderId: paymentDetails.orderId,
          guestEmail: paymentDetails.customerEmail,
          guestName: paymentDetails.customerName,
          builder: "single",
        })
      );

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
      <TopNavBar
        brandTitle="1-Day Express Pass"
        ctaHref={BUILDER_ROUTES.dayPass}
        ctaLabel="Builder"
        locked={!contactReady}
        invoiceActive={activeView === "invoice"}
        onSave={() => void requestSaveOnly()}
        onPrint={requestPrintOnly}
        onPlan={() => setMode("dossier")}
        onInvoice={() => {
          if (activeView === "invoice") setMode("dossier");
          else void requestInvoiceView();
        }}
      />
      <div className="no-print mx-auto max-w-3xl px-4 sm:px-5">
        <LiquidGlassHero
          pnr={activeBookingRef({
            tempBookingRef,
            confirmedBookingRef,
            bookingStatus,
          })}
          bookingType="SINGLE_DAY"
          title="1-Day Express Pass · Itinerary"
          guestName={customerName !== "Guest" ? customerName : undefined}
          depositAmount={feeCreditEur}
          payLabel={dossierPrimaryCtaLabel(feeCreditEur)}
          payPulse={!costPulsarDone}
          continueHref={BUILDER_ROUTES.dayPass}
          locked={!contactReady}
          onSave={() => void requestSaveOnly()}
          onSend={() => void requestSendPdf()}
          onPrint={requestPrintOnly}
          onPlanInvoice={() => {
            if (activeView === "invoice") setMode("dossier");
            else void requestInvoiceView();
          }}
          onPayContinue={handleRequestPay}
        />
        <TicketVoucherDownloadBanner
          pnr={activeBookingRef({
            tempBookingRef,
            confirmedBookingRef,
            bookingStatus,
          })}
          className="mb-2"
        />
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
            <SingleDayItineraryView
              depositPaidEur={feeCreditEur}
              hasPaidFull={
                totalPaidEur > 0 &&
                quote.totalEur > 0 &&
                totalPaidEur >= quote.totalEur
              }
            />
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
              feeCreditEur={feeCreditEur}
            />
          </div>
        </main>

      {/* Compact dual-action bar — clear of mobile chat + bottom nav */}
      {contactReady ? (
      <div className="no-print sticky-action-bar fixed inset-x-0 bottom-28 z-30 mb-2 w-full overflow-x-hidden pr-[4.75rem] sm:bottom-6 sm:left-20 sm:pr-24 sm:pl-0">
        <div className="mx-auto flex w-full max-w-5xl px-2 sm:px-4">
          <div className="flex w-full flex-row items-center gap-2 rounded-2xl border border-white/10 bg-[#0D1117]/95 p-2 shadow-2xl backdrop-blur-md sm:gap-3 sm:p-2.5">
            <div className="min-w-0 flex-1 pl-1 sm:pl-2">
              {(() => {
                const paid = Math.max(0, totalPaidEur || feeCreditEur || 0);
                const partyMin = Math.max(0, Number(quote.min) || Number(quote.totalEur) || 0);
                const partyMax = Math.max(
                  partyMin,
                  Number(quote.max) || Number(quote.totalEur) || 0
                );
                const pendingMin = Math.max(0, partyMin - paid);
                const pendingMax = Math.max(0, partyMax - paid);
                const ppMin = singleDayPerPersonEur(pendingMin, totalGuests);
                const ppMax = singleDayPerPersonEur(pendingMax, totalGuests);
                return (
                  <>
                    <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[#00B4D8]">
                      Remaining balance due
                    </p>
                    <p className="truncate text-sm font-extrabold text-[#F6A724] sm:text-base">
                      {pendingMin === pendingMax
                        ? formatEur(pendingMin)
                        : `${formatEur(pendingMin)} ~ ${formatEur(pendingMax)}`}
                    </p>
                    <p className="truncate text-[9px] text-emerald-400/90">
                      Est.{" "}
                      {ppMin === ppMax
                        ? formatEur(ppMin)
                        : `${formatEur(ppMin)} ~ ${formatEur(ppMax)}`}{" "}
                      /pp
                      <span className="ml-1.5 text-zinc-500">
                        · party{" "}
                        {partyMin === partyMax
                          ? formatEur(partyMin)
                          : `${formatEur(partyMin)} ~ ${formatEur(partyMax)}`}
                        {paid > 0 ? ` · paid ${formatEur(paid)}` : ""}
                      </span>
                    </p>
                  </>
                );
              })()}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <button
                type="button"
                onClick={openBudget}
                aria-label="Price Composition"
                title="Price Composition"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
              >
                <Wallet className="h-4 w-4 shrink-0" aria-hidden />
              </button>
              <ActionPillButton
                conciergeFeePaid={feeCreditEur > 0}
                onClick={handleRequestPay}
                pulse={!costPulsarDone}
                className="shrink-0"
              />
            </div>
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
      ) : null}

      <SingleDayBudgetModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
      />

      <SaveRequiredContactModal
        open={saveContactOpen}
        initialName={customerName !== "Guest" ? customerName : ""}
        initialEmail={guestEmail}
        initialWhatsapp={
          usePreBuilderStore.getState().whatsapp ||
          usePreBuilderStore.getState().lastPayload?.whatsapp ||
          ""
        }
        onClose={() => {
          setSaveContactOpen(false);
          setPendingAfterSave(null);
        }}
        onSaved={async (contact) => {
          await saveContactAndCreateDraft(contact);
          setSaveContactOpen(false);
          const next = pendingAfterSave;
          setPendingAfterSave(null);
          showSystemMessage({
            text: "Draft saved — quotation unlocked.",
            tone: "info",
          });
          if (next === "estimate") setShowEstimateModal(true);
          if (next === "budget") setBudgetOpen(true);
        }}
      />

      <BalancePaymentModal
        open={balanceOpen}
        onClose={() => setBalanceOpen(false)}
        pnr={officialBookingRef()}
        guestName={customerName}
        totalPackageEur={quote.totalEur || quote.max}
        conciergeCreditEur={feeCreditEur}
        totalPaidEur={totalPaidEur || feeCreditEur}
        onConfirm={handleBalanceConfirm}
      />

      <RevolutCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => {
          setIsCheckoutModalOpen(false);
          setCheckoutMode("deposit");
        }}
        bookingRef={checkoutRef}
        totalAmount={
          checkoutMode === "concierge_fee"
            ? conciergeFeeEur
            : checkoutMode === "balance"
              ? balanceAmount
              : quote.max
        }
        totalAmountMin={
          checkoutMode === "concierge_fee" || checkoutMode === "balance"
            ? undefined
            : quote.min
        }
        currency="EUR"
        defaultDepositPercent={
          checkoutMode === "concierge_fee" || checkoutMode === "balance"
            ? 100
            : 10
        }
        fixedAmount={
          checkoutMode === "concierge_fee"
            ? conciergeFeeEur
            : checkoutMode === "balance"
              ? balanceAmount
              : undefined
        }
        fixedAmountLabel={
          checkoutMode === "balance"
            ? `€${balanceAmount} Tour balance`
            : "€60 Deposit (100% credited)"
        }
        customerEmail={guestEmail}
        customerName={customerName}
        onPaymentSuccess={(details) => {
          if (checkoutMode === "concierge_fee") {
            void handleConciergeFeeSuccess(details);
          } else if (checkoutMode === "balance") {
            void handleBalancePaymentSuccess(details);
          } else {
            void handlePaymentSuccess(details);
          }
        }}
        onPaymentError={setSubmitError}
      />

      <ConciergeCommitmentFlow
        openEstimate={showEstimateModal}
        onCloseEstimate={() => setShowEstimateModal(false)}
        totalPrice={quote.totalEur || quote.max}
        paxCount={totalGuests}
        totalDays={1}
        onSelectPath={handleSelectEstimatePath}
        onSaveForLater={() => {
          void handleSaveDraftAndEmail();
        }}
        onSeeDetails={() => {
          // Keep estimate open; Price Composition stacks above (z-120)
          setBudgetOpen(true);
        }}
      />

      {/* Legacy entry — budget / 1:1 flip cards (not estimate Option 3) */}
      <SaveForLaterOptionsModal
        open={saveLaterOpen}
        onClose={() => setSaveLaterOpen(false)}
        feeAmountEur={conciergeFeeEur}
        onPayFee={() => {
          void loadConciergeEstimateCopy().then((c) => {
            setConciergeFeeEur(c.feeAmountEur);
          });
          setShowFeeModal(true);
        }}
        onContinueEditing={() => {
          setSaveLaterOpen(false);
          window.location.href = "/builder-single";
        }}
      />

      <ConciergeFeeModal
        open={showFeeModal}
        onClose={() => setShowFeeModal(false)}
        onPay={handleConciergeFeePay}
        feeAmountEur={conciergeFeeEur}
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
            <ThankYouPassMascot size="md" className="mb-3" />
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
        <GuestTalkBubble
          pnr={activeBookingRef({
            tempBookingRef,
            confirmedBookingRef,
            bookingStatus,
          })}
          guestEmail={guestEmail}
          guestName={customerName}
          tripPath="/builder-single/itinerary"
        />
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
