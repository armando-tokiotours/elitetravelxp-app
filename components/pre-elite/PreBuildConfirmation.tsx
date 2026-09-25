"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Mail, RotateCcw, X } from "lucide-react";
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
import { useBuilderStore } from "@/store/useBuilderStore";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";

/** Prefer PNG (transparent) under /brand — jpg would flatten the pop-out. */
const MASCOT_UPRIGHT = "/svg/mascot-card.svg";
const MASCOT_BOW = "/svg/mascot-bow.svg";
const BOW_DELAY_MS = 1200;
const TOAST_MS = 4200;

function proposalSentStorageKey(ref: string) {
  return `tokiotours:proposal-sent:${ref.trim().toUpperCase()}`;
}

function readProposalSent(ref: string): { email: string; sentAt: string } | null {
  if (typeof window === "undefined" || !ref) return null;
  try {
    const raw = window.localStorage.getItem(proposalSentStorageKey(ref));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; sentAt?: string };
    if (!parsed?.sentAt) return null;
    return {
      email: String(parsed.email || "").trim().toLowerCase(),
      sentAt: String(parsed.sentAt),
    };
  } catch {
    return null;
  }
}

function markProposalSent(ref: string, email: string) {
  if (typeof window === "undefined" || !ref) return;
  try {
    window.localStorage.setItem(
      proposalSentStorageKey(ref),
      JSON.stringify({
        email: email.trim().toLowerCase(),
        sentAt: new Date().toISOString(),
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Pre-Build summary after qualification submit or Manage Booking retrieve.
 * Centered card: mascot pops out of top border, then action row + greeting.
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
  const [bowing, setBowing] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const data = parseItineraryData(itineraryData);
  const isSingleDay = data?.tripType === "single_day";
  const firstName = (fullName || "").trim().split(/\s+/)[0] || "";
  const emailOnFile = (email || "").trim().toLowerCase();

  useEffect(() => {
    const t = window.setTimeout(() => setBowing(true), BOW_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    setAlreadySent(Boolean(readProposalSent(bookingRef)));
  }, [bookingRef]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  const closeResendModal = () => {
    if (sending) return;
    setResendOpen(false);
  };

  useModalDismiss(resendOpen, closeResendModal);

  const openBuilder = () => {
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

    if (alreadyLoaded) {
      router.push(
        isSingleDay
          ? `/builder-single?ref=${encodeURIComponent(bookingRef)}`
          : `/builder?ref=${encodeURIComponent(bookingRef)}`
      );
      return;
    }

    const result = hydrateStoresFromPreEliteBrief({
      bookingRef,
      fullName,
      email,
      itineraryData,
    });
    if (!result) {
      router.push(isSingleDay ? "/builder-single" : "/builder");
      return;
    }
    router.push(result.href);
  };

  const downloadBriefPdf = async () => {
    const el = cardRef.current;
    if (!el) return;
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
  };

  /** First click sends; later clicks open the re-send confirm modal. */
  const onSaveEmailClick = () => {
    if (sending) return;
    if (alreadySent || readProposalSent(bookingRef)) {
      setAlreadySent(true);
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
      try {
        await downloadBriefPdf();
      } catch {
        /* email still succeeded */
      }
      markProposalSent(bookingRef, to);
      setAlreadySent(true);
      setResendOpen(false);
      const guestOk = Boolean(payload.guestSent);
      if (resend) {
        setToast(
          guestOk
            ? "Proposal sent again — PDF downloaded."
            : "Snapshot refreshed. Email may be delayed — PDF downloaded."
        );
        setActionMsg(
          guestOk
            ? "Proposal sent again — PDF downloaded."
            : "Snapshot refreshed. Email may be delayed — PDF downloaded."
        );
      } else {
        setActionMsg(
          guestOk
            ? "Proposal email sent — PDF downloaded."
            : "Snapshot saved. Email may be delayed — PDF downloaded."
        );
      }
    } catch (err) {
      setActionErr(
        err instanceof Error ? err.message : "Could not send proposal email."
      );
    } finally {
      setSending(false);
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
      {/* Main Card Container - MUST HAVE overflow-visible */}
      <div
        ref={cardRef}
        className="relative mx-auto mt-12 w-full max-w-md overflow-visible rounded-2xl border border-white/10 bg-[#0A1017]/90 p-5 pt-8 text-left shadow-2xl"
      >
        {/* Top Hero Section: Split 1/3 (Left) & 2/3 (Right) */}
        <div className="relative z-10 grid grid-cols-12 items-start gap-3">
          {/* LEFT COLUMN (≈1/3): Mascot + Vertical Stacked Buttons */}
          <div className="relative col-span-5 flex flex-col items-center space-y-2">
            {/* 1. Large Mascot Popping OUT of the Top-Left Frame Border */}
            <div className="pointer-events-none absolute -top-16 -left-2 z-30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bowing ? MASCOT_BOW : MASCOT_UPRIGHT}
                alt="Tokiotours Mascot"
                className="h-32 w-32 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] transition-all duration-500"
              />
            </div>

            {/* Invisible spacer so buttons sit cleanly BELOW the overlapping mascot */}
            <div className="h-16 w-full" />

            {/* 2. Stacked Buttons directly beneath mascot (full labels, no truncation) */}
            <div className="flex w-full flex-col space-y-2 pt-1">
              <button
                type="button"
                onClick={onSaveEmailClick}
                disabled={sending}
                className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#075473] px-2 py-2 text-[10px] font-bold tracking-wider text-white uppercase shadow-md transition-all hover:bg-[#096a91] disabled:opacity-60"
              >
                <Mail className="h-3 w-3 shrink-0" />
                <span>{sending ? "Sending…" : "Save & Email"}</span>
              </button>

              <button
                type="button"
                onClick={openBuilder}
                className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-cyan-500/40 bg-cyan-500/20 px-2 py-2 text-[10px] font-bold tracking-wider text-cyan-300 uppercase transition-all hover:bg-cyan-500/30"
              >
                <span>Trip Builder</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
              </button>

              {onReset ? (
                <button
                  type="button"
                  onClick={onReset}
                  title="Start Another Brief / Restart"
                  aria-label="Restart Brief"
                  className="flex w-full items-center justify-center rounded-xl border border-zinc-700 bg-black/40 py-1.5 font-bold text-zinc-300 transition-all hover:bg-zinc-800"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-zinc-300" />
                </button>
              ) : null}
            </div>
          </div>

          {/* RIGHT COLUMN (≈2/3): Header & Greeting Text Block */}
          <div className="col-span-7 space-y-1 pt-1 pl-1">
            <span className="block text-[10px] font-bold tracking-widest text-amber-400 uppercase">
              We&apos;ve Got Your Request
            </span>
            {firstName ? (
              <h2 className="font-godiva text-[1.575rem] leading-tight font-bold tracking-wide text-white uppercase">
                {firstName},
              </h2>
            ) : null}
            <h3 className="font-godiva text-sm leading-tight font-bold tracking-wide text-white uppercase">
              {bowing
                ? "Your Brief Is With Us!"
                : "We're Ready To Save Your Brief"}
            </h3>
            <p className="pt-1 text-[11px] leading-relaxed text-zinc-400">
              We&apos;ve got your ideas saved. Keep this reference handy — your
              concierge will use it to design your trip.
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

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[140] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-[#1CA67F]/40 bg-[#0D1117]/95 px-4 py-3 text-center text-sm text-[#1CA67F] shadow-2xl backdrop-blur-md"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </>
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
          className="fixed inset-0 z-[130] flex items-end justify-center bg-[#05080C]/75 backdrop-blur-sm sm:items-center sm:p-4"
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
            className="relative z-[1] w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0D1117] p-5 shadow-2xl sm:rounded-2xl sm:p-6"
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
