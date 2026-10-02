"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { buildCityMap, getCityName } from "@/lib/cityLabels";
import { activeBookingRef } from "@/utils/pnr";
import { syncMultiDayBookingLead } from "@/lib/syncBookingLead";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote } from "@/lib/builder-pricing";
import { submitBookingRequest } from "@/lib/bookingRequest";
import { calculateCityDateRanges } from "@/lib/dateCascade";
import { allocateFleet } from "@/lib/vehicleAllocator";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { RevolutCheckoutModal } from "@/components/checkout/RevolutCheckoutModal";
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
import {
  PrintRequestModal,
  type PrintRequestResult,
} from "@/components/checkout/PrintRequestModal";
import { PrintItineraryDocument } from "@/components/builder/PrintItineraryDocument";
import {
  TravelDossierView,
  resolveHub,
} from "@/components/builder/TravelDossierView";
import { GuestTalkBubble } from "@/components/dossier/GuestTalkBubble";
import { ThankYouPassMascot } from "@/components/branding/PandaFlexibleMascot";
import { FeePaidRibbon } from "@/components/dossier/FeeCreditRibbon";
import { DossierActionToolbar } from "@/components/dossier/DossierActionToolbar";
import { TicketVoucherDownloadBanner } from "@/components/dossier/TicketVoucherDownloadBanner";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { SaveRequiredContactModal } from "@/components/builder/SaveRequiredContactModal";
import { IdleHeroMascot } from "@/components/branding/IdleHeroMascot";
import { GoldLight } from "@/components/branding/GoldLight";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";
import { dossierPrimaryCtaLabel } from "@/lib/tourPaymentStatus";
import {
  hasGuestContact,
  saveContactAndCreateDraft,
} from "@/lib/saveContactGate";
import {
  fetchPaymentConfigured,
  isMultiDayBuilderComplete,
  multiDayIncompleteFoxMessage,
} from "@/lib/itineraryGates";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";

import { PriceSummaryFooter } from "@/components/builder/PriceSummaryFooter";
import { DossierSectionOutline } from "@/components/builder/DossierSectionOutline";

type ViewMode = "dossier" | "invoice";

export default function ItineraryPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useBuilderStore((s) => s);
  const departureDate = useBuilderStore((s) => s.departureDate);
  const ensureTempBookingRef = useBuilderStore((s) => s.ensureTempBookingRef);
  const officialBookingRef = useBuilderStore((s) => s.officialBookingRef);
  const confirmBookingRef = useBuilderStore((s) => s.confirmBookingRef);
  const clientName = useItineraryStore((s) => s.clientName);
  const preName = usePreBuilderStore(
    (s) => s.fullName || s.lastPayload?.fullName || ""
  );
  const clientEmail = useItineraryStore((s) => s.clientEmail);
  const preEmail = usePreBuilderStore(
    (s) => s.email || s.lastPayload?.email || ""
  );
  const guestEmail = (clientEmail || preEmail || "").trim().toLowerCase();
  const customerName = (clientName || preName || "").trim() || "Guest";
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>("dossier");
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
  const [sendPulsarDone, setSendPulsarDone] = useState(false);
  const [costPulsarDone, setCostPulsarDone] = useState(false);
  const [saveContactOpen, setSaveContactOpen] = useState(false);
  const [pendingAfterSave, setPendingAfterSave] = useState<
    "save" | "pay" | "estimate" | null
  >(null);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [saveLaterOpen, setSaveLaterOpen] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [conciergeFeeEur, setConciergeFeeEur] = useState(DEFAULT_CONCIERGE_FEE_EUR);
  const [checkoutMode, setCheckoutMode] = useState<
    "deposit" | "concierge_fee" | "balance"
  >("deposit");
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState(0);
  const [balanceOption, setBalanceOption] =
    useState<BalancePayOption>("30_PERCENT");
  const [totalPaidEur, setTotalPaidEur] = useState(0);
  const [selectedPath, setSelectedPath] = useState<ConciergePathOption | null>(
    null
  );
  const preDraftStatus = usePreBuilderStore((s) => s.pnrDraftStatus);
  const preWhatsapp = usePreBuilderStore((s) => s.whatsapp);
  const contactReady = Boolean(
    (clientName || preName || "").trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) &&
      String(preWhatsapp || "").replace(/\D/g, "").length >= 7 &&
      (preDraftStatus === "SAVED" ||
        Boolean(
          String(usePreBuilderStore.getState().lastPayload?.bookingRef || "").trim()
        ))
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

  useEffect(() => {
    const ref = activeBookingRef({
      tempBookingRef: state.tempBookingRef,
      confirmedBookingRef: state.confirmedBookingRef,
      bookingStatus: state.bookingStatus,
    });
    void import("@/lib/feeCredit").then(({ hydrateConciergeFeeCredit }) => {
      void hydrateConciergeFeeCredit(ref).then((eur) => {
        setFeeCreditEur(eur);
        if (eur > 0) setTotalPaidEur((prev) => (prev > 0 ? prev : eur));
      });
    });
  }, [
    state.tempBookingRef,
    state.confirmedBookingRef,
    state.bookingStatus,
  ]);

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
      !isMultiDayBuilderComplete(state.highestUnlockedStep, {
        arrivalDate: state.arrivalDate,
        durationDays: state.durationDays,
        adults: state.adults,
        children: state.children,
        arrivalTransferId: state.arrivalTransferId,
        departureTransferId: state.departureTransferId,
        locations: state.locations,
        cityHotels: state.cityHotels,
      })
    ) {
      const snap = {
        arrivalDate: state.arrivalDate,
        durationDays: state.durationDays,
        adults: state.adults,
        children: state.children,
        arrivalTransferId: state.arrivalTransferId,
        departureTransferId: state.departureTransferId,
        locations: state.locations,
        cityHotels: state.cityHotels,
      };
      showSystemMessage({
        text: multiDayIncompleteFoxMessage(state.highestUnlockedStep, snap),
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
      !isMultiDayBuilderComplete(state.highestUnlockedStep, {
        arrivalDate: state.arrivalDate,
        durationDays: state.durationDays,
        adults: state.adults,
        children: state.children,
        arrivalTransferId: state.arrivalTransferId,
        departureTransferId: state.departureTransferId,
        locations: state.locations,
        cityHotels: state.cityHotels,
      })
    ) {
      const snap = {
        arrivalDate: state.arrivalDate,
        durationDays: state.durationDays,
        adults: state.adults,
        children: state.children,
        arrivalTransferId: state.arrivalTransferId,
        departureTransferId: state.departureTransferId,
        locations: state.locations,
        cityHotels: state.cityHotels,
      };
      showSystemMessage({
        text: multiDayIncompleteFoxMessage(state.highestUnlockedStep, snap),
        tone: "error",
      });
      return;
    }
    setSendPulsarDone(true);
    setPrintSkipTerms(true);
    setPrintOpen(true);
  };

  const requireContactOr = (
    next: "save" | "pay" | "estimate",
    proceed: () => void | Promise<void>
  ) => {
    if (hasGuestContact()) {
      void proceed();
      return;
    }
    setPendingAfterSave(next);
    setSaveContactOpen(true);
  };

  const requestSaveOnly = async () => {
    const run = async () => {
      const ref = activeBookingRef({
        tempBookingRef: state.tempBookingRef,
        confirmedBookingRef: state.confirmedBookingRef,
        bookingStatus: state.bookingStatus,
      });
      const email = (
        useItineraryStore.getState().clientEmail ||
        usePreBuilderStore.getState().email ||
        ""
      )
        .trim()
        .toLowerCase();
      if (!email) {
        showSystemMessage({
          text: "Add your email before saving.",
          tone: "error",
        });
        return;
      }
      const cityMap = buildCityMap(config?.cities);
      const cityNames: Record<string, string> = {};
      for (const loc of state.locations) {
        cityNames[loc.cityId] = getCityName(loc.cityId, cityMap);
      }
      const ok = await syncMultiDayBookingLead({
        bookingRef: ref,
        email,
        state,
        cityNames,
        status: "lead",
        quote: quote ? { min: quote.min, max: quote.max } : undefined,
      });
      showSystemMessage({
        text: ok ? "Itinerary saved." : "Could not save itinerary.",
        tone: ok ? "info" : "error",
      });
    };
    requireContactOr("save", run);
  };

  const requestPrintOnly = () => {
    window.print();
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
    setCheckoutRef(
      activeBookingRef({
        tempBookingRef: state.tempBookingRef,
        confirmedBookingRef: state.confirmedBookingRef,
        bookingStatus: state.bookingStatus,
      })
    );
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
          builder: "multi",
          estimatedTotalEur: quote?.max ?? 0,
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

  const handleSelectEstimatePath = (path: ConciergePathOption) => {
    setSelectedPath(path);
    setShowEstimateModal(false);
    void loadConciergeEstimateCopy().then((c) => {
      setConciergeFeeEur(c.feeAmountEur);
    });
    void requestSaveOnly();
    setShowFeeModal(true);
  };

  const handleSaveDraftAndEmail = async () => {
    setShowEstimateModal(false);
    const ref = activeBookingRef({
      tempBookingRef: state.tempBookingRef,
      confirmedBookingRef: state.confirmedBookingRef,
      bookingStatus: state.bookingStatus,
    });
    try {
      await fetch("/api/bookings/concierge-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_later",
          pnr: ref,
          tourDate: state.arrivalDate,
        }),
      });
      await requestSaveOnly();
      showSystemMessage({
        text: "Draft saved — send yourself an email copy next.",
        tone: "info",
      });
      setPrintSkipTerms(true);
      setPrintOpen(true);
    } catch {
      showSystemMessage({
        text: "Could not save draft. Try Save from the toolbar.",
        tone: "error",
      });
    }
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
          builder: "multi",
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
      showSystemMessage({
        text: "Deposit received — your dates are held. An agent will contact you soon.",
        tone: "info",
      });
    } catch {
      showSystemMessage({
        text: "Payment succeeded, but updating the booking failed. Contact concierge with your ref.",
        tone: "error",
      });
    } finally {
      setCheckoutMode("deposit");
      setSelectedPath(null);
    }
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
          builder: "multi",
        })
      );

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
      <SystemMessageFox />
      <MobileTopChrome
        brandTitle="Itinerary"
        ctaHref="/builder"
        ctaLabel="Builder"
      />
      <div className="mx-auto w-full max-w-md px-4 py-6 md:max-w-lg lg:max-w-2xl">
          {/* Section 1 — Hero header + navigation actions */}
          <DossierSectionOutline
            label="Section 1: Hero & Nav"
            className="no-print my-4"
          >
            <header className="group relative overflow-visible rounded-2xl border border-white/10 bg-[#0A1017]/80 p-5 shadow-2xl backdrop-blur-md sm:p-6">
              {/* Clip gold wash to card interior — mascot can still sit outside */}
              <div
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl"
                aria-hidden
              >
                <GoldLight color="#F6A724" active />
              </div>
              <div className="relative z-10 space-y-4 text-left">
              <div className="relative grid grid-cols-3 items-end gap-2">
                <div className="col-span-2 min-w-0">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#F6A724]">
                    Multi day · Itinerary
                  </p>
                  <h1 className="mt-1 break-words font-godiva text-2xl uppercase leading-tight tracking-wide text-white sm:text-3xl">
                    {customerName}
                  </h1>
                  <h2 className="mt-0.5 font-godiva text-[1.125rem] uppercase tracking-wider text-white/90">
                    Dossier
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    Day-by-day Japan route and private multi-day quotation.
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

              <div className="border-t border-white/10 pt-2">
                {feeCreditEur > 0 ? (
                  <FeePaidRibbon feeEur={feeCreditEur} className="mb-3" />
                ) : null}
                <TicketVoucherDownloadBanner
                  pnr={activeBookingRef({
                    tempBookingRef: state.tempBookingRef,
                    confirmedBookingRef: state.confirmedBookingRef,
                    bookingStatus: state.bookingStatus,
                  })}
                  className="mb-3"
                />
                <DossierActionToolbar
                  contactReady={contactReady}
                  costPulsarDone={costPulsarDone}
                  continueHref="/builder"
                  howMuchLabel={dossierPrimaryCtaLabel(feeCreditEur)}
                  conciergeFeePaid={feeCreditEur > 0}
                  onHowMuchCost={handleRequestPay}
                  onSave={() => void requestSaveOnly()}
                  onSend={() => void requestSendPdf()}
                  onPrint={requestPrintOnly}
                  onItinerary={() => setMode("dossier")}
                  onInvoice={() => {
                    if (activeView === "invoice") setMode("dossier");
                    else void requestInvoiceView();
                  }}
                  invoiceActive={activeView === "invoice"}
                />
              </div>
              </div>
            </header>
          </DossierSectionOutline>

          <main className="mt-6 w-full overflow-x-hidden pb-8">
            <div
              className={
                activeView === "dossier"
                  ? undefined
                  : "invoice-capture-offscreen pointer-events-none fixed left-[-10000px] top-0 z-[-1] w-[800px] bg-[#0D1117]"
              }
              aria-hidden={activeView !== "dossier"}
            >
              <TravelDossierView
                state={state}
                config={config}
                departureIso={depIso}
                dateRanges={dateRanges}
                fleetLabel={fleetLabel}
                arrivalHub={arrivalHub}
                departureHub={departureHub}
                afterSummary={
                  activeView === "dossier" ? (
                    <PriceSummaryFooter
                      placement="inline"
                      quoteMin={quote?.min ?? null}
                      quoteMax={quote?.max ?? null}
                      minPerPerson={minPerPerson}
                      maxPerPerson={maxPerPerson}
                      totalGuests={totalGuests}
                      onRequestPay={handleRequestPay}
                      requestDisabled={!quote}
                      reserveLabel={dossierPrimaryCtaLabel(feeCreditEur)}
                    />
                  ) : null
                }
              />
            </div>

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
                feeCreditEur={feeCreditEur}
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
                  reserveLabel={dossierPrimaryCtaLabel(feeCreditEur)}
                />
              </div>
            ) : null}
          </main>
        </div>

      <BalancePaymentModal
        open={balanceOpen}
        onClose={() => setBalanceOpen(false)}
        pnr={activeBookingRef({
          tempBookingRef: state.tempBookingRef,
          confirmedBookingRef: state.confirmedBookingRef,
          bookingStatus: state.bookingStatus,
        })}
        guestName={customerName}
        totalPackageEur={quote?.max ?? 0}
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
              : quote?.max ?? 0
        }
        totalAmountMin={
          checkoutMode === "concierge_fee" || checkoutMode === "balance"
            ? undefined
            : quote?.min
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
        currency="EUR"
        defaultDepositPercent={
          checkoutMode === "concierge_fee" || checkoutMode === "balance"
            ? 100
            : 10
        }
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

      <SaveRequiredContactModal
        open={saveContactOpen}
        initialName={(
          useItineraryStore.getState().clientName ||
          usePreBuilderStore.getState().fullName ||
          ""
        ).trim()}
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
          if (next === "pay") {
            setCheckoutRef(officialBookingRef());
            setIsCheckoutModalOpen(true);
          }
          if (next === "save") {
            void requestSaveOnly();
          }
        }}
      />

      <ConciergeCommitmentFlow
        openEstimate={showEstimateModal}
        onCloseEstimate={() => setShowEstimateModal(false)}
        totalPrice={quote?.max ?? quote?.min ?? 0}
        paxCount={totalGuests}
        totalDays={Math.max(1, state.durationDays || 1)}
        onSelectPath={handleSelectEstimatePath}
        onSaveForLater={() => {
          void handleSaveDraftAndEmail();
        }}
        onSeeDetails={() => {
          setShowEstimateModal(false);
          void requestInvoiceView();
        }}
      />

      <SaveForLaterOptionsModal
        open={saveLaterOpen}
        onClose={() => setSaveLaterOpen(false)}
        feeAmountEur={conciergeFeeEur}
        onPayFee={() => {
          void loadConciergeEstimateCopy().then((c) =>
            setConciergeFeeEur(c.feeAmountEur)
          );
          setShowFeeModal(true);
        }}
        onContinueEditing={() => {
          setSaveLaterOpen(false);
          window.location.href = "/builder";
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
            <ThankYouPassMascot size="md" className="mb-3" />
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
        <GuestTalkBubble
          pnr={activeBookingRef({
            tempBookingRef: state.tempBookingRef,
            confirmedBookingRef: state.confirmedBookingRef,
            bookingStatus: state.bookingStatus,
          })}
          guestEmail={guestEmail}
          guestName={customerName}
          tripPath="/builder/itinerary"
        />
      </div>
    </div>
  );
}
