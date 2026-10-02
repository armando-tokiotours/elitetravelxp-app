"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Car, MapPinned, Ticket } from "lucide-react";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { GoldLight } from "@/components/branding/GoldLight";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import { ThankYouPassMascot } from "@/components/branding/PandaFlexibleMascot";
import { ConciergeCommitmentFlow, ConciergeFeeModal } from "@/components/checkout/ConciergeCommitmentFlow";
import { DossierActionToolbar } from "@/components/dossier/DossierActionToolbar";
import { DossierTermsFooterSection } from "@/components/dossier/DossierTermsFooterSection";
import { SaveForLaterOptionsModal } from "@/components/checkout/SaveForLaterOptionsModal";
import {
  FeeCreditInvoiceBlock,
  FeePaidRibbon,
} from "@/components/dossier/FeeCreditRibbon";
import { TripRangeMiniCalendar } from "@/components/builder/TripRangeMiniCalendar";
import { RevolutCheckoutModal } from "@/components/checkout/RevolutCheckoutModal";
import { BalancePaymentModal } from "@/components/checkout/BalancePaymentModal";
import type { BalancePayOption } from "@/lib/balanceSettlement";
import {
  builderEGuestSummary,
  builderETourDate,
  useBuilderEStore,
} from "@/store/useBuilderEStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { syncBuilderELead } from "@/lib/syncBuilderE";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import {
  buildBuilderEContactSnapshot,
  validateBuilderEContact,
} from "@/lib/builderEEstimate";
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import { loadConciergeEstimateCopy } from "@/lib/conciergeEstimateFlow";
import { formatEur } from "@/lib/singleDayPricing";
import { dossierPrimaryCtaLabel } from "@/lib/tourPaymentStatus";

export function BuilderEDossierView() {
  const state = useBuilderEStore();
  const category = state.category;
  const pnr = state.bookingRef || "······";
  const ensureBookingRef = useBuilderEStore((s) => s.ensureBookingRef);
  const setGuestName = useBuilderEStore((s) => s.setGuestName);
  const setGuestEmail = useBuilderEStore((s) => s.setGuestEmail);
  const setGuestWhatsapp = useBuilderEStore((s) => s.setGuestWhatsapp);
  const setContactGateComplete = useBuilderEStore(
    (s) => s.setContactGateComplete
  );
  const guestName = useBuilderEStore((s) => s.guestName);
  const guestEmail = useBuilderEStore((s) => s.guestEmail);
  const guestWhatsapp = useBuilderEStore((s) => s.guestWhatsapp);
  const contactDone = useBuilderEStore((s) => s.contactGateComplete);
  const [savingContact, setSavingContact] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [saveLaterOpen, setSaveLaterOpen] = useState(false);
  const [costPulsarDone, setCostPulsarDone] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutRef, setCheckoutRef] = useState("");
  const [checkoutPath, setCheckoutPath] = useState<"FULL" | "PARTIAL">("FULL");
  const [conciergeFeeEur, setConciergeFeeEur] = useState(DEFAULT_CONCIERGE_FEE_EUR);
  const [feeCreditEur, setFeeCreditEur] = useState(0);
  const [totalPaidEur, setTotalPaidEur] = useState(0);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState(0);
  const [balanceOption, setBalanceOption] =
    useState<BalancePayOption>("30_PERCENT");
  const [balanceCheckout, setBalanceCheckout] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const contactSnapshot = useMemo(
    () => buildBuilderEContactSnapshot(state.cart),
    [state.cart]
  );
  const contactError = validateBuilderEContact({
    fullName: guestName,
    email: guestEmail,
    whatsapp: guestWhatsapp,
  });

  useEffect(() => {
    ensureBookingRef();
  }, [ensureBookingRef]);

  useEffect(() => {
    void import("@/lib/feeCredit").then(({ hydrateConciergeFeeCredit }) => {
      void hydrateConciergeFeeCredit(state.bookingRef).then((eur) => {
        setFeeCreditEur(eur);
        if (eur > 0) setTotalPaidEur((prev) => (prev > 0 ? prev : eur));
      });
    });
  }, [state.bookingRef]);

  useEffect(() => {
    const it = useItineraryStore.getState();
    const pre = usePreBuilderStore.getState();
    const nextName = (
      guestName ||
      it.clientName ||
      pre.fullName ||
      pre.lastPayload?.fullName ||
      ""
    ).trim();
    const nextEmail = (
      guestEmail ||
      it.clientEmail ||
      pre.email ||
      pre.lastPayload?.email ||
      ""
    )
      .trim()
      .toLowerCase();
    const nextWhatsapp = (
      guestWhatsapp ||
      pre.whatsapp ||
      pre.lastPayload?.whatsapp ||
      ""
    ).trim();
    if (nextName && !guestName) setGuestName(nextName);
    if (nextEmail && !guestEmail) setGuestEmail(nextEmail);
    if (nextWhatsapp && !guestWhatsapp) setGuestWhatsapp(nextWhatsapp);
  }, [
    guestEmail,
    guestName,
    guestWhatsapp,
    setGuestEmail,
    setGuestName,
    setGuestWhatsapp,
  ]);

  const title = useMemo(() => {
    if (category === "DRIVER") return "PRIVATE TRANSFER PASS";
    if (category === "EXPERIENCE") return "EXPERIENCE DAY PASS";
    if (category === "TRANSIT") return "TRANSIT & RAIL PASS";
    return "BUILDER E PASS";
  }, [category]);

  const Icon =
    category === "DRIVER" ? Car : category === "TRANSIT" ? Ticket : MapPinned;

  const unlockEstimate = async () => {
    if (state.cart.length === 0) {
      showSystemMessage({
        text: "Add at least one Builder E service before unlocking the estimate.",
        tone: "error",
      });
      return;
    }
    setSavingContact(true);
    try {
      const result = await syncBuilderELead({
        state: useBuilderEStore.getState(),
        status: "draft",
      });
      if (!result.ok) {
        throw new Error(result.error || "Could not save draft.");
      }
      setContactGateComplete(true);
      setEstimateOpen(true);
      showSystemMessage({
        text: "Contact saved. Your estimate is unlocked.",
        tone: "info",
      });
      void loadConciergeEstimateCopy().then((copy) => {
        setConciergeFeeEur(copy.feeAmountEur);
      });
    } catch (err) {
      showSystemMessage({
        text: err instanceof Error ? err.message : "Could not save contact.",
        tone: "error",
      });
    } finally {
      setSavingContact(false);
    }
  };

  const openFeeCheckout = async (path: "FULL" | "PARTIAL") => {
    setCheckoutPath(path);
    setEstimateOpen(false);
    void loadConciergeEstimateCopy().then((copy) => {
      setConciergeFeeEur(copy.feeAmountEur);
    });
    // Persist draft + selected path intent before deposit
    void syncBuilderELead({
      state: useBuilderEStore.getState(),
      status: "draft",
    }).then((result) => {
      if (!result.ok && result.error) {
        showSystemMessage({ text: result.error, tone: "error" });
      }
    });
    setFeeOpen(true);
  };

  const saveDraftAndEmail = async () => {
    setEstimateOpen(false);
    setSavingContact(true);
    try {
      const result = await syncBuilderELead({
        state: useBuilderEStore.getState(),
        status: "draft",
      });
      if (!result.ok) {
        showSystemMessage({
          text: result.error || "Could not save draft.",
          tone: "error",
        });
        return;
      }
      await fetch("/api/bookings/concierge-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_later",
          pnr,
          tourDate: builderETourDate(useBuilderEStore.getState()),
        }),
      });
      showSystemMessage({
        text: "Draft saved — your brief is ready to review. We’ll email follow-up shortly.",
        tone: "info",
      });
    } catch {
      showSystemMessage({
        text: "Could not save draft.",
        tone: "error",
      });
    } finally {
      setSavingContact(false);
    }
  };

  const payConciergeFee = () => {
    setFeeOpen(false);
    setCheckoutRef(pnr);
    setCheckoutOpen(true);
  };

  const handlePaymentSuccess = async (paymentDetails: {
    bookingRef: string;
    amountPaid: number;
    orderId: string | null;
    paymentType: string;
  }) => {
    try {
      const res = await fetch("/api/bookings/concierge-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fee_paid",
          pnr: paymentDetails.bookingRef,
          amount: paymentDetails.amountPaid,
          orderId: paymentDetails.orderId,
          path: checkoutPath,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not record fee payment.");
      }
      void import("@/lib/recordPayment").then(({ recordPaymentSuccess }) =>
        recordPaymentSuccess({
          pnr: paymentDetails.bookingRef,
          kind: "concierge_deposit",
          amountEur: paymentDetails.amountPaid,
          orderId: paymentDetails.orderId,
          path: checkoutPath,
          guestEmail,
          guestName,
          builder: "builder-e",
        })
      );
      void import("@/lib/feeCredit").then(({ markConciergeFeePaid }) =>
        markConciergeFeePaid(
          paymentDetails.bookingRef,
          paymentDetails.amountPaid
        )
      );
      setFeeCreditEur(paymentDetails.amountPaid);
      setTotalPaidEur(paymentDetails.amountPaid);
      setSubmittedRef(paymentDetails.bookingRef);
      setCheckoutOpen(false);
      showSystemMessage({
        text: "Deposit received — your dates are held. TokioTours will follow up shortly.",
        tone: "info",
      });
    } catch (err) {
      showSystemMessage({
        text:
          err instanceof Error
            ? err.message
            : "Payment succeeded, but the follow-up update failed.",
        tone: "error",
      });
    }
  };

  const saveAndNotify = async () => {
    if (!category || !guestEmail) {
      showSystemMessage({
        text: "Complete category and contact details on the builder first.",
        tone: "error",
      });
      return;
    }
    void unlockEstimate();
  };

  return (
    <div className="builder-theme relative z-10 min-h-screen overflow-x-hidden bg-transparent pb-28 text-white">
      <SystemMessageFox />
      <div className="no-print">
        <MobileTopChrome
          brandTitle="Builder E"
          ctaHref="/builder-e"
          ctaLabel="Edit"
        />
      </div>

      <div className="mx-auto w-full max-w-lg px-4 pt-20 lg:max-w-xl lg:pt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href="/builder-e"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-400 uppercase hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue editing
          </Link>
          <span className="font-mono text-xs text-[#F6A724]">{pnr}</span>
        </div>

        <header className="mb-6">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
            Experience · Dossier
          </p>
          <h1 className="font-godiva mt-1 text-2xl tracking-wide uppercase sm:text-3xl">
            {state.guestName || "Guest"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Micro-service booking · draft until Ops confirms
          </p>
          {(state.experience.targetDate || state.transit.travelDate) ? (
            <div className="mt-3 max-w-xs">
              <TripRangeMiniCalendar
                arrivalDate={
                  state.experience.targetDate || state.transit.travelDate || null
                }
                tripDays={1}
              />
            </div>
          ) : null}
        </header>

        {!contactDone ? (
          <section className="mb-4 rounded-3xl border border-white/10 bg-[#0A1017]/95 p-5">
            <GoldLight color="#F6A724" placement="top-center" />
            <div className="relative z-10 space-y-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
                  Step 3 · Contact Gate
                </p>
                <h2 className="mt-1 font-godiva text-xl tracking-wide text-white uppercase">
                  Unlock estimate and draft PNR
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Enter your contact details before any booking record or pricing
                  is saved.
                </p>
              </div>

              <div className="grid gap-3">
                <label className="block text-xs text-zinc-400">
                  Full name
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600"
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </label>
                <label className="block text-xs text-zinc-400">
                  Email
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600"
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </label>
                <label className="block text-xs text-zinc-400">
                  WhatsApp
                  <input
                    value={guestWhatsapp}
                    onChange={(e) => setGuestWhatsapp(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600"
                    placeholder="+81 90 1234 5678"
                    autoComplete="tel"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => void unlockEstimate()}
                disabled={savingContact || Boolean(contactError)}
                className="w-full rounded-xl bg-[#075473] px-4 py-3 text-xs font-bold tracking-wider text-white uppercase transition hover:bg-[#054F70] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingContact ? "Saving…" : "Unlock estimate & PNR"}
              </button>

              {contactError ? (
                <p className="text-xs text-[#D9718C]">{contactError}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {!category && state.cart.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-zinc-400">
            No service selected yet.{" "}
            <Link href="/builder-e" className="text-[#7dd3fc] underline">
              Choose a category
            </Link>
            .
          </p>
        ) : (
          <>
            {state.cart.length > 0 ? (
              <section className="mb-4 space-y-2 rounded-2xl border border-white/10 bg-[#0A1017]/95 p-4">
                <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  Cart · {state.cart.length} item
                  {state.cart.length === 1 ? "" : "s"}
                </p>
                {state.cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                      {item.category}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-zinc-500">{item.summary}</p>
                  </div>
                ))}
              </section>
            ) : null}
            {category ? (
          <section className="relative overflow-hidden rounded-3xl border border-dashed border-white/25 bg-[#0A1017]/95 p-5">
            <GoldLight color="#075473" placement="top-center" />
            <div className="relative z-10">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Icon className="h-5 w-5 text-[#F6A724]" aria-hidden />
                  </span>
                  <div>
                    <p className="font-godiva text-sm tracking-wider text-white uppercase">
                      TOKIOTOURS
                    </p>
                    <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
                      {title}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="rounded-full border border-gray-500/30 bg-gray-500/20 px-3 py-1 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                    DRAFT
                  </span>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                    {category}
                  </span>
                </div>
              </div>

              {category === "DRIVER" ? (
                <div className="space-y-3 text-sm">
                  <Row
                    label="Pickup"
                    value={
                      [
                        state.driver.pickupLocation || "—",
                        state.driver.pickupTime,
                        state.driver.flightNumber
                          ? `Flight ${state.driver.flightNumber}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    }
                  />
                  <Row
                    label="Drop-off"
                    value={state.driver.dropoffLocation || "—"}
                  />
                  <Row
                    label="Party & luggage"
                    value={builderEGuestSummary(state)}
                  />
                  <BadgeRow
                    badges={[
                      state.driver.pickupTime
                        ? `Pickup ${state.driver.pickupTime}`
                        : "Pickup time TBD",
                      "Vehicle sizing · Alphard / HiAce",
                      `${state.driver.luggageCount} bags`,
                    ]}
                  />
                </div>
              ) : null}

              {category === "EXPERIENCE" ? (
                <div className="space-y-3 text-sm">
                  <Row
                    label="Experience"
                    value={state.experience.activityTitle || "—"}
                  />
                  <Row
                    label="When"
                    value={[
                      state.experience.targetDate || "Date TBD",
                      state.experience.timeSlot || "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <Row
                    label="Guests"
                    value={
                      state.experience.guestNames
                        .split(/[\n,]+/)
                        .map((x) => x.trim())
                        .filter(Boolean)
                        .join(", ") || "—"
                    }
                  />
                  <Row
                    label="Guide language"
                    value={state.experience.guideLanguage || "—"}
                  />
                  <BadgeRow
                    badges={[
                      state.experience.timeSlot
                        ? `${state.experience.timeSlot} entry`
                        : "Time slot TBD",
                      state.experience.guestNames.trim()
                        ? "Passport names on file"
                        : "Passport verification pending",
                      "Ticket fulfillment pending",
                    ]}
                  />
                </div>
              ) : null}

              {category === "TRANSIT" ? (
                <div className="space-y-3 text-sm">
                  <Row
                    label="Pass"
                    value={
                      state.transit.passType.replace(/_/g, " ") || "—"
                    }
                  />
                  <Row
                    label="Route"
                    value={
                      state.transit.routeFrom || state.transit.routeTo
                        ? `${state.transit.routeFrom || "—"} → ${state.transit.routeTo || "—"}`
                        : "—"
                    }
                  />
                  <Row
                    label="Travel"
                    value={[
                      state.transit.travelDate || "Date TBD",
                      state.transit.preferredTime,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <Row
                    label="Fulfillment"
                    value={
                      state.transit.delivery.replace(/_/g, " ") || "—"
                    }
                  />
                  <BadgeRow
                    badges={[
                      state.transit.passType === "shinkansen"
                        ? "Shinkansen reserved"
                        : state.transit.passType === "jr_pass"
                          ? "JR Pass"
                          : state.transit.passType.includes("suica")
                            ? "Suica / IC"
                            : "Transit pass",
                      "Tix needed",
                      state.transit.delivery
                        ? state.transit.delivery.replace(/_/g, " ")
                        : "Fulfillment pending",
                    ]}
                  />
                </div>
              ) : null}

              {state.guestEmail ? (
                <p className="mt-4 text-xs text-zinc-500">
                  Contact: {state.guestName || "Guest"} · {state.guestEmail}
                  {state.guestWhatsapp ? ` · ${state.guestWhatsapp}` : ""}
                </p>
              ) : null}
              {contactSnapshot.estimated_total > 0 ? (
                <p className="mt-3 text-sm font-semibold text-white">
                  Package estimate{" "}
                  <span className="tabular-nums text-[#F6A724]">
                    {formatEur(contactSnapshot.estimated_total)}
                  </span>
                </p>
              ) : null}
              {feeCreditEur > 0 ? (
                <FeeCreditInvoiceBlock
                  packageTotalEur={contactSnapshot.estimated_total}
                  feeCreditEur={feeCreditEur}
                  className="mt-3"
                />
              ) : null}
            </div>
          </section>
            ) : null}
          </>
        )}

        <div className="mt-6">
          <DossierTermsFooterSection />
        </div>

        <div className="mt-6">
          {feeCreditEur > 0 ? (
            <FeePaidRibbon feeEur={feeCreditEur} className="mb-3" />
          ) : null}
          <DossierActionToolbar
            contactReady={contactDone}
            costPulsarDone={costPulsarDone}
            continueHref="/builder-e"
            howMuchDisabled={!category || savingContact}
            howMuchLabel={dossierPrimaryCtaLabel(feeCreditEur)}
            conciergeFeePaid={feeCreditEur > 0}
            onHowMuchCost={() => {
              setCostPulsarDone(true);
              if (feeCreditEur > 0) {
                setBalanceOpen(true);
                return;
              }
              void saveAndNotify();
            }}
            showInvoice={false}
            resetScope="builder-e"
            onSave={
              contactDone
                ? () => {
                    showSystemMessage({
                      text: "Draft already saved with your contact.",
                      tone: "info",
                    });
                  }
                : undefined
            }
            onSend={
              contactDone
                ? () => {
                    showSystemMessage({
                      text: "Ask Ops from chat once your estimate is unlocked.",
                      tone: "info",
                    });
                  }
                : undefined
            }
            onPrint={
              contactDone
                ? () => {
                    window.print();
                  }
                : undefined
            }
          />
        </div>
      </div>

      <ConciergeCommitmentFlow
        openEstimate={estimateOpen}
        onCloseEstimate={() => setEstimateOpen(false)}
        totalPrice={contactSnapshot.estimated_total}
        paxCount={contactSnapshot.paxCount}
        totalDays={1}
        onSelectPath={(path) => void openFeeCheckout(path)}
        onSaveForLater={() => {
          void saveDraftAndEmail();
        }}
        onSeeDetails={() => {
          setEstimateOpen(false);
          showSystemMessage({
            text: "Open your service cards above for line-item price details.",
            tone: "info",
          });
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
          setFeeOpen(true);
        }}
        onContinueEditing={() => {
          setSaveLaterOpen(false);
          window.location.href = "/builder-e";
        }}
      />

      <ConciergeFeeModal
        open={feeOpen}
        onClose={() => setFeeOpen(false)}
        onPay={payConciergeFee}
        feeAmountEur={conciergeFeeEur}
      />

      <BalancePaymentModal
        open={balanceOpen}
        onClose={() => setBalanceOpen(false)}
        pnr={pnr}
        guestName={guestName}
        totalPackageEur={contactSnapshot.estimated_total}
        conciergeCreditEur={feeCreditEur}
        totalPaidEur={totalPaidEur || feeCreditEur}
        onConfirm={(option, amountEur) => {
          setBalanceOption(option);
          setBalanceAmount(amountEur);
          setBalanceOpen(false);
          setBalanceCheckout(true);
          setCheckoutRef(pnr);
          setCheckoutOpen(true);
        }}
      />

      <RevolutCheckoutModal
        isOpen={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false);
          setBalanceCheckout(false);
        }}
        bookingRef={checkoutRef}
        totalAmount={balanceCheckout ? balanceAmount : conciergeFeeEur}
        fixedAmount={balanceCheckout ? balanceAmount : conciergeFeeEur}
        fixedAmountLabel={
          balanceCheckout
            ? `€${balanceAmount} Tour balance`
            : `€${conciergeFeeEur} Deposit (100% credited)`
        }
        currency="EUR"
        customerEmail={guestEmail}
        customerName={guestName}
        customerPhone={guestWhatsapp}
        onPaymentSuccess={(details) => {
          if (balanceCheckout) {
            void import("@/lib/recordPayment").then(({ recordPaymentSuccess }) =>
              recordPaymentSuccess({
                pnr: details.bookingRef,
                kind: balanceOption === "FULL" ? "tour_full" : "tour_partial",
                amountEur: details.amountPaid,
                orderId: details.orderId,
                guestEmail,
                guestName,
                builder: "builder-e",
                estimatedTotalEur: contactSnapshot.estimated_total,
              })
            );
            setTotalPaidEur((prev) => prev + details.amountPaid);
            setBalanceCheckout(false);
            setCheckoutOpen(false);
            setSubmittedRef(details.bookingRef);
            showSystemMessage({
              text:
                balanceOption === "FULL"
                  ? "Full tour balance received — thank you."
                  : "Progress payment received — remaining balance due before travel.",
              tone: "info",
            });
            return;
          }
          void handlePaymentSuccess(details);
        }}
        onPaymentError={(message) =>
          showSystemMessage({ text: message, tone: "error" })
        }
      />

      {submittedRef ? (
        <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A1017]/80 p-6 shadow-2xl backdrop-blur-md">
            <ThankYouPassMascot size="md" className="mb-3" />
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#F6A724]">
              Fee received
            </p>
            <h2 className="mt-2 font-godiva text-2xl uppercase tracking-wide text-white">
              Booking {submittedRef}
            </h2>
            <p className="mt-2 text-sm text-white/65">
              Thank you. Your Concierge Fee is credited toward the final
              balance. A travel expert will confirm remaining details.
            </p>
            <button
              type="button"
              onClick={() => setSubmittedRef(null)}
              className="mt-5 w-full rounded-full bg-[#075473] py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2">
      <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
        {label}
      </span>
      <span className="max-w-[65%] text-right text-sm text-zinc-100">
        {value}
      </span>
    </div>
  );
}

function BadgeRow({ badges }: { badges: string[] }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {badges.map((b) => (
        <span
          key={b}
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-300 uppercase"
        >
          {b}
        </span>
      ))}
    </div>
  );
}
