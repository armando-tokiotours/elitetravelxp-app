"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, HelpCircle, Save, X } from "lucide-react";
import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
  labelFor,
  parseItineraryData,
} from "@/lib/preEliteBuilder";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  BuilderEntryChargingOverlay,
  runBuilderEntryWarm,
} from "@/components/branding/HomeAssetWarmGate";
import type { WarmProgress } from "@/lib/assetWarmup";
import { TokioClockLoader } from "@/components/common/TokioClockLoader";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import {
  HiBubble,
  MascotHiZoom,
  useMascotHiTap,
} from "@/components/branding/MascotHiTap";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";

/** Prefer SVG under /svg — upright until email dispatches, then bow. */
const MASCOT_UPRIGHT = "/svg/mascot-card.svg";
const MASCOT_BOW = "/svg/mascot-bow.svg";
const TOAST_MS = 4200;

function proposalSentStorageKey(ref: string) {
  return `tokiotours:proposal-sent:${ref.trim().toUpperCase()}`;
}

function briefSavedStorageKey(ref: string) {
  return `tokiotours:brief-saved:${ref.trim().toUpperCase()}`;
}

function readProposalSent(ref: string): { email: string; sentAt: string } | null {
  if (typeof window === "undefined" || !ref) return null;
  try {
    const raw = window.localStorage.getItem(proposalSentStorageKey(ref));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; sentAt?: string };
    if (!parsed?.sentAt) return null;
    return { email: parsed.email || "", sentAt: parsed.sentAt };
  } catch {
    return null;
  }
}

function markProposalSent(ref: string, email: string) {
  try {
    window.localStorage.setItem(
      proposalSentStorageKey(ref),
      JSON.stringify({ email, sentAt: new Date().toISOString() })
    );
  } catch {
    /* private mode */
  }
  markBriefSaved(ref);
}

function readBriefSaved(ref: string): boolean {
  if (typeof window === "undefined" || !ref) return false;
  try {
    return window.localStorage.getItem(briefSavedStorageKey(ref)) === "1";
  } catch {
    return false;
  }
}

function markBriefSaved(ref: string) {
  try {
    window.localStorage.setItem(briefSavedStorageKey(ref), "1");
  } catch {
    /* private mode */
  }
}

/**
 * Pre-Build summary after qualification submit or Manage Booking retrieve.
 * Upright mascot = draft unsaved; bow = brief saved (or email sent).
 */
export function PreBuildConfirmation({
  bookingRef,
  fullName,
  email,
  itineraryData,
  onReset,
}: {
  bookingRef: string;
  fullName: string;
  email?: string;
  itineraryData: string;
  onReset?: () => void;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  /** True after SAVE (local) or SAVE & EMAIL / prior send for this ref. */
  const [isBriefSaved, setIsBriefSaved] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [saveGateOpen, setSaveGateOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [builderCharging, setBuilderCharging] = useState(false);
  const [builderWarmProgress, setBuilderWarmProgress] = useState<WarmProgress>({
    loaded: 0,
    total: 1,
    percent: 0,
    done: false,
  });
  const emailSentCount = usePreBuilderStore((s) => s.emailSentCount);
  const bumpEmailSentCount = usePreBuilderStore((s) => s.bumpEmailSentCount);
  const { showHi, triggerHi } = useMascotHiTap();

  const data = parseItineraryData(itineraryData);
  const isSingleDay = data?.tripType === "single_day";
  const firstName = (fullName || "").trim().split(/\s+/)[0] || "";
  const emailOnFile = (email || "").trim().toLowerCase();

  /** Unlock Trip Builder when brief saved locally and/or email sent. */
  const builderUnlocked =
    isBriefSaved ||
    isEmailSent ||
    emailSentCount >= 1 ||
    readBriefSaved(bookingRef) ||
    Boolean(readProposalSent(bookingRef));

  useEffect(() => {
    const priorEmail =
      Boolean(readProposalSent(bookingRef)) || emailSentCount >= 1;
    const priorSave = readBriefSaved(bookingRef) || priorEmail;
    setIsEmailSent(priorEmail);
    setIsBriefSaved(priorSave);
  }, [bookingRef, emailSentCount]);

  useEffect(() => {
    // Clear any leftover html2pdf overlay from a prior hung save.
    document
      .querySelectorAll(".html2pdf__overlay, .html2pdf__container")
      .forEach((node) => node.remove());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  const closeResendModal = () => {
    setSending(false);
    setResendOpen(false);
    cleanupHtml2PdfOverlay();
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  };

  const closeSaveGateModal = () => {
    setSaveGateOpen(false);
    setSending(false);
    cleanupHtml2PdfOverlay();
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
  };

  useModalDismiss(resendOpen, closeResendModal);
  useModalDismiss(saveGateOpen, closeSaveGateModal);
  useModalDismiss(saveModalOpen, () => setSaveModalOpen(false));
  useModalDismiss(helpOpen, () => setHelpOpen(false));
  useModalDismiss(newBookingOpen, () => setNewBookingOpen(false));

  const confirmNewBooking = () => {
    setNewBookingOpen(false);
    setSending(false);
    setIsEmailSent(false);
    setIsBriefSaved(false);
    cleanupHtml2PdfOverlay();
    onReset?.();
  };

  /** Persist brief locally (no email) + warm media assets. */
  const saveBriefLocal = () => {
    markBriefSaved(bookingRef);
    setIsBriefSaved(true);
    setSaveModalOpen(false);
    setSaveGateOpen(false);
    setActionMsg("Request saved. Media charged for Trip Builder.");
    setToast("Brief saved — Trip Builder unlocked.");
    setBuilderCharging(true);
    setBuilderWarmProgress({
      loaded: 0,
      total: 1,
      percent: 0,
      done: false,
    });
    void runBuilderEntryWarm((p) => setBuilderWarmProgress(p)).then(() => {
      setBuilderCharging(false);
    });
  };

  const openBuilder = () => {
    if (!builderUnlocked) {
      setSaveGateOpen(true);
      return;
    }
    setIsBriefSaved(true);

    const builder = useBuilderStore.getState();
    const single = useSingleDayBuilderStore.getState();
    const alreadyLoaded =
      builder.confirmedBookingRef === bookingRef &&
      (builder.highestUnlockedStep > 1 ||
        (Array.isArray(builder.locations) && builder.locations.length > 0) ||
        (isSingleDay &&
          (!!single.tourDate ||
            single.selectedExperiences.length > 0 ||
            !!single.cityFocus)));

    const href = (() => {
      if (alreadyLoaded) {
        return isSingleDay
          ? `/builder-single?ref=${encodeURIComponent(bookingRef)}`
          : `/builder?ref=${encodeURIComponent(bookingRef)}`;
      }
      const result = hydrateStoresFromPreEliteBrief({
        bookingRef,
        fullName,
        email,
        itineraryData,
      });
      if (!result) {
        return isSingleDay ? "/builder-single" : "/builder";
      }
      return result.href;
    })();

    setBuilderCharging(true);
    setBuilderWarmProgress({
      loaded: 0,
      total: 1,
      percent: 0,
      done: false,
    });
    void runBuilderEntryWarm((p) => setBuilderWarmProgress(p)).then(() => {
      router.push(href);
    });
  };

  /** html2pdf can leave a full-screen overlay that swallows all clicks. */
  const cleanupHtml2PdfOverlay = () => {
    if (typeof document === "undefined") return;
    document
      .querySelectorAll(".html2pdf__overlay, .html2pdf__container")
      .forEach((node) => node.remove());
  };

  const downloadBriefPdf = async () => {
    const el = cardRef.current;
    if (!el) return;
    try {
      const mod = await import("html2pdf.js");
      const html2pdf = (mod.default || mod) as (el?: HTMLElement) => {
        set: (opts: unknown) => {
          from: (src: HTMLElement) => { save: () => Promise<void> };
        };
      };
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `TOKIOTOURS-brief-${bookingRef}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#0D1117" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(el)
        .save();
    } finally {
      cleanupHtml2PdfOverlay();
    }
  };

  /** First click sends; later clicks open the re-send confirm modal. */
  const onSaveEmailClick = () => {
    if (sending) return;
    if (builderUnlocked) {
      setIsEmailSent(true);
      setResendOpen(true);
      return;
    }
    void sendProposal({ resend: false });
  };

  const sendProposal = async ({ resend }: { resend: boolean }) => {
    const to = emailOnFile;
    if (!to) {
      setActionErr("An email on file is required to send the proposal.");
      setResendOpen(false);
      return;
    }
    setSending(true);
    setActionErr(null);
    setActionMsg(null);
    if (resend) {
      showSystemMessage({
        text: getSystemMessage("sending_again"),
        tone: "info",
        durationMs: 8000,
      });
    }
    try {
      const res = await fetch("/api/send-prebuilder-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingRef,
          fullName,
          email: to,
          itineraryData,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Could not send proposal email.");
      }
      const guestSent = Boolean(payload?.guestSent);
      const teamSent = Boolean(payload?.teamSent);
      const mailErrors = Array.isArray(payload?.errors)
        ? payload.errors.filter(Boolean)
        : [];
      if (!guestSent && !teamSent) {
        throw new Error(
          mailErrors[0] ||
            "Mail server accepted the request but did not send any messages."
        );
      }
      if (!guestSent) {
        throw new Error(
          mailErrors[0] ||
            "Could not deliver email to your inbox. Team alert may have been sent — try again or check spam."
        );
      }
      markProposalSent(bookingRef, to);
      setIsEmailSent(true);
      bumpEmailSentCount(
        typeof payload?.emailSentCount === "number"
          ? payload.emailSentCount
          : undefined
      );
      setResendOpen(false);
      const okMsg = resend
        ? "Email resent — check your inbox and spam folder."
        : "Request saved and email sent — check your inbox.";
      setActionMsg(okMsg);
      if (resend) {
        setToast(okMsg);
      }
      // Unlock UI before PDF — html2pdf overlays must never freeze buttons.
      setSending(false);
      void downloadBriefPdf().catch(() => {
        /* email still succeeded */
      });
    } catch (err) {
      setActionErr(
        err instanceof Error ? err.message : "Could not send proposal email."
      );
      setResendOpen(false);
    } finally {
      setSending(false);
      cleanupHtml2PdfOverlay();
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    }
  };

  const summaryItems = data
    ? [
        {
          label: "Style",
          value: labelFor(TRAVEL_STYLES, data.travelStyle),
        },
        {
          label: "Interests",
          value: data.interests
            .map((id) => labelFor(INTERESTS, id))
            .join(", "),
        },
        {
          label: "Motivation",
          value: labelFor(MOTIVATIONS, data.tripMotivation),
        },
        {
          label: "Concerns",
          value: data.painPoints
            .map((id) => labelFor(PAIN_POINTS, id))
            .join(", "),
        },
        {
          label: "Trip type",
          value:
            data.tripType === "single_day"
              ? "Single-Day Tour"
              : "Multi-Day Journey",
        },
        { label: "Timing", value: data.dates },
        {
          label: "Group",
          value: `${data.groupSize.adults} adults, ${data.groupSize.children} children`,
        },
      ]
    : [];

  return (
    <>
      <SystemMessageFox />
      {/* Main Card Container - MUST HAVE overflow-visible */}
      <div
        ref={cardRef}
        className="relative mx-auto mt-12 w-full max-w-md overflow-visible rounded-2xl border border-white/10 bg-[#0A1017]/90 p-5 pt-8 text-left shadow-2xl"
      >
        {/* Top Hero Section: Split 1/3 (Left) & 2/3 (Right) */}
        <div className="relative z-10 grid grid-cols-12 items-start gap-3">
          {/* LEFT COLUMN (≈1/3): Mascot + Vertical Stacked Buttons */}
          <div className="relative col-span-5 flex flex-col items-center space-y-2">
            {/* 1. Mascot — upright until email sent, then respectful bow · tap = HI */}
            <button
              type="button"
              aria-label="Say hi"
              onClick={triggerHi}
              className="absolute -top-16 -left-2 z-30 h-32 w-32 cursor-pointer overflow-visible border-0 bg-transparent p-0 select-none"
            >
              <HiBubble
                show={showHi}
                className="-right-2 -top-1 w-[5.5rem] sm:w-[6.5rem]"
              />
              <MascotHiZoom showHi={showHi} className="pointer-events-none h-full w-full">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={builderUnlocked ? "bow" : "upright"}
                    src={builderUnlocked ? MASCOT_BOW : MASCOT_UPRIGHT}
                    alt="Tokiotours Mascot"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                    className="h-32 w-32 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
                    draggable={false}
                  />
                </AnimatePresence>
              </MascotHiZoom>
            </button>

            {/* Spacer under overlapping mascot — never capture clicks */}
            <div className="pointer-events-none h-16 w-full" aria-hidden />

            {/* 2. Grey Save + grey ? · gold Continue · New Booking */}
            <div className="relative z-20 flex w-full flex-col items-center space-y-2 pt-1">
              <div className="relative z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (builderUnlocked) {
                      setSaveModalOpen(true);
                      return;
                    }
                    saveBriefLocal();
                  }}
                  disabled={builderCharging}
                  aria-label={
                    builderCharging
                      ? "Charging"
                      : builderUnlocked
                        ? "Saved"
                        : "Save brief"
                  }
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/80 text-zinc-400 transition-all pointer-events-auto hover:border-zinc-500 hover:text-zinc-300 disabled:opacity-50"
                >
                  {builderCharging ? (
                    <span className="font-mono text-[9px] text-zinc-500">…</span>
                  ) : (
                    <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  aria-label="Help"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/80 text-zinc-400 transition-all pointer-events-auto hover:border-zinc-500 hover:text-zinc-300"
                >
                  <HelpCircle className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSending(false);
                  cleanupHtml2PdfOverlay();
                  openBuilder();
                }}
                className="relative z-20 flex min-h-[5.25rem] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/10 px-2 py-3 text-center text-[#F6A724] shadow-md transition-all pointer-events-auto animate-locations-help-glow hover:bg-white/[0.14]"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 animate-locations-help-ring rounded-xl border border-white/80"
                />
                <span className="relative z-10 inline-flex max-w-[9.5rem] flex-col items-center gap-1 px-1">
                  <span className="text-[11px] font-bold leading-tight tracking-wider uppercase">
                    Continue to Trip Builder!
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </button>

              {onReset ? (
                <button
                  type="button"
                  onClick={() => setNewBookingOpen(true)}
                  className="relative z-20 flex min-h-[2.75rem] w-full cursor-pointer items-center justify-center rounded-xl border border-zinc-700 bg-black/40 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-200 transition-all pointer-events-auto hover:bg-zinc-800"
                >
                  New Booking
                </button>
              ) : null}
            </div>
          </div>

          {/* RIGHT COLUMN (≈2/3): Header & Greeting Text Block */}
          <div className="col-span-7 space-y-1 pt-1 pl-1">
            <span className="block text-[10px] font-bold tracking-widest text-amber-400 uppercase">
              {builderUnlocked
                ? "We've Got Your Request"
                : "Prepared For Review"}
            </span>
            {firstName ? (
              <h2 className="font-godiva text-[1.575rem] leading-tight font-bold tracking-wide text-white uppercase">
                {firstName},
              </h2>
            ) : null}
            <h3 className="font-godiva text-sm leading-tight font-bold tracking-wide text-white uppercase">
              {builderUnlocked
                ? "Your Brief Is With Us!"
                : "We're Ready To Save Your Brief"}
            </h3>
            <p className="pt-1 text-[11px] leading-relaxed text-zinc-400">
              {builderUnlocked
                ? "Thank you! Now let's build your trip."
                : "Review your selections below. Tap Save to unlock Trip Builder."}
            </p>
            {(actionMsg || actionErr) && (
              <p
                className={`pt-2 text-xs ${actionErr ? "text-[#D9718C]" : "text-[#1CA67F]"}`}
                role="status"
              >
                {actionErr || actionMsg}
              </p>
            )}
          </div>
        </div>

        {/* 3. Centered Booking Reference Number */}
        <div className="my-6 text-center">
          <span className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-5 py-2 font-mono text-xl font-bold tracking-wider text-[#F6A724] shadow-inner">
            {bookingRef}
          </span>
        </div>

        {sending ? (
          <div className="mb-5 flex justify-center px-1">
            <TokioClockLoader
              message="SENDING YOUR BRIEF…"
              subMessage="Almost there"
              className="!max-w-sm"
            />
          </div>
        ) : null}

        {/* 4. Details Table - Full-Width Edge-to-Edge */}
        {summaryItems.length > 0 ? (
          <div className="w-full space-y-3 border-t border-white/10 pt-4 text-left">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="flex flex-col border-b border-white/5 pb-2"
              >
                <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                  {item.label}
                </span>
                <span className="mt-0.5 text-xs font-medium text-white">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <ProposalResendModal
        open={resendOpen}
        email={emailOnFile}
        sending={sending}
        onCancel={closeResendModal}
        onConfirm={() => void sendProposal({ resend: true })}
      />

      <SaveEmailGateModal
        open={saveGateOpen}
        onClose={closeSaveGateModal}
        onSave={() => {
          closeSaveGateModal();
          saveBriefLocal();
        }}
      />

      <SaveConfirmModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSaveAgain={saveBriefLocal}
      />

      <PreBuildHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <NewBookingWarningModal
        open={newBookingOpen}
        incomplete={!builderUnlocked}
        onClose={() => setNewBookingOpen(false)}
        onConfirm={confirmNewBooking}
      />

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[140] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-[#1CA67F]/40 bg-[#0D1117]/95 px-4 py-3 text-center text-sm text-[#1CA67F] shadow-2xl backdrop-blur-md"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {builderCharging ? (
        <BuilderEntryChargingOverlay progress={builderWarmProgress} />
      ) : null}
    </>
  );
}

function SaveEmailGateModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="save-email-gate"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="save-email-gate-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1117] p-5 shadow-2xl sm:p-6"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <p className="text-[10px] font-bold tracking-[0.2em] text-amber-400 uppercase">
              Save required
            </p>
            <h3
              id="save-email-gate-title"
              className="mt-2 font-godiva text-2xl tracking-wider text-white uppercase"
            >
              Save Your Request First
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Tap Save to unlock Trip Builder before continuing.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/5"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onSave}
                className="rounded-xl bg-[#075473] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#096a91]"
              >
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function NewBookingWarningModal({
  open,
  incomplete,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** Brief not saved yet — booking is incomplete. */
  incomplete: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === "undefined") return null;

  const body = incomplete
    ? `${getSystemMessage("builder_incomplete")} Starting a new booking will erase this incomplete brief.`
    : "If you start a new booking, you will lose this trip — tours, activities, and the other configurations you need to continue will no longer be available on this brief.";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="new-booking-warn"
          className="fixed inset-0 z-[140] flex flex-col items-center justify-center bg-[#04080C]/95 px-5 py-8 backdrop-blur-md"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="new-booking-warn-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Fox peeks from bottom-left corner */}
          <motion.img
            src="/brand/fox-peek.webp"
            alt=""
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            className="pointer-events-none absolute bottom-[5.5rem] left-0 z-[1] h-[7.5rem] w-auto object-contain object-left drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)] sm:bottom-28 sm:h-36"
          />

          <motion.div
            className="relative z-[2] flex w-full max-w-lg flex-col items-center text-center"
            initial={{ y: 28, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={MASCOT_UPRIGHT}
              alt=""
              className="mb-5 h-24 w-24 object-contain sm:h-28 sm:w-28"
            />
            <p className="text-[10px] font-bold tracking-[0.22em] text-amber-400 uppercase">
              Wait!
            </p>
            <h3
              id="new-booking-warn-title"
              className="mt-2 font-godiva text-2xl tracking-wider text-white uppercase sm:text-3xl"
            >
              {incomplete ? "Booking incomplete" : "Start a new booking?"}
            </h3>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
              {body}
            </p>
            <div className="mt-8 grid w-full max-w-sm grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 bg-black/50 px-4 py-3.5 text-sm font-semibold text-white/85"
              >
                Keep this trip
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3.5 text-sm font-semibold text-red-300"
              >
                Yes, new booking
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function PreBuildHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="prebuild-help"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prebuild-help-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/30 bg-[#0D1117] p-5 shadow-[0_0_40px_rgba(246,167,36,0.2)] sm:p-6"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <p className="text-[10px] font-bold tracking-[0.2em] text-amber-400 uppercase">
              Quick help
            </p>
            <h3
              id="prebuild-help-title"
              className="mt-2 font-godiva text-2xl tracking-wider text-white uppercase"
            >
              What next?
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/70">
              <li>
                <span className="font-semibold text-white">1. Save</span>
              </li>
              <li>
                <span className="font-semibold text-white">
                  2. Continue to Trip Builder!
                </span>
              </li>
              <li>
                <span className="font-semibold text-white">3. New Booking</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-[#075473] px-4 py-3 text-sm font-semibold text-white"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function SaveConfirmModal({
  open,
  onClose,
  onSaveAgain,
}: {
  open: boolean;
  onClose: () => void;
  onSaveAgain: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="save-confirm"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-confirm-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117] p-5 shadow-2xl sm:p-6"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0A1017]/80 p-4">
              <GoldLightLocal />
              <p className="relative z-10 text-[10px] font-bold tracking-[0.2em] text-amber-400 uppercase">
                Already saved
              </p>
              <h3
                id="save-confirm-title"
                className="relative z-10 mt-2 font-godiva text-xl tracking-wider text-white uppercase"
              >
                Brief is on file
              </h3>
              <p className="relative z-10 mt-2 text-sm text-white/65">
                Trip Builder is unlocked. Save again to re-charge media, or
                continue building.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onSaveAgain}
                className="rounded-xl bg-[#075473] px-4 py-3 text-sm font-semibold text-white"
              >
                Save again
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function GoldLightLocal() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -top-8 left-1/2 h-24 w-40 -translate-x-1/2 rounded-full bg-[#F6A724]/35 blur-2xl"
    />
  );
}

function ProposalResendModal({
  open,
  email,
  sending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  email: string;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === "undefined") return null;

  const displayEmail = email || "your inbox";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="proposal-resend"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proposal-resend-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0"
            onClick={onCancel}
            disabled={sending}
          />
          <motion.div
            className="relative z-[1] w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1117] p-5 shadow-2xl sm:p-6"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={sending}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white disabled:opacity-50"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <p className="text-[10px] font-bold tracking-[0.2em] text-[#F29727] uppercase">
              Email proposal
            </p>
            <h3
              id="proposal-resend-title"
              className="mt-2 font-godiva text-2xl tracking-wider text-white uppercase"
            >
              Proposal Already Sent
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              We already delivered a copy of this brief to{" "}
              <span className="font-medium text-white">{displayEmail}</span>. Do
              you want to send it again?
            </p>

            {sending ? (
              <p className="mt-4 text-center text-sm font-semibold tracking-wide text-[#1CA67F]">
                {/* fox speaks via SystemMessageFox on confirm */}
                Sending again…
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={sending}
                className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={sending}
                className="rounded-xl bg-[#075473] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#096a91] disabled:opacity-60"
              >
                {sending ? "Sending…" : "Yes, Send Again"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
