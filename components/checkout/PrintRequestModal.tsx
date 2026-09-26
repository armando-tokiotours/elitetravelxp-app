"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Pencil,
  Printer,
  X,
} from "lucide-react";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote } from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import {
  downloadItineraryPdf,
  printItineraryLocally,
  type SendDocSelection,
} from "@/lib/clientItineraryPdf";
import { BookingTermsModal } from "@/components/checkout/BookingTermsModal";
import { activeBookingRef } from "@/utils/pnr";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { EMAIL_CONFIG_DEFAULTS } from "@/config/emailDefaults";

export type PrintRequestResult = {
  bookingRef: string;
  mailSent: boolean;
  message: string;
};

function resolveKnownEmail(): string {
  const it = useItineraryStore.getState();
  const pre = usePreBuilderStore.getState();
  return (
    it.clientEmail ||
    pre.email ||
    pre.lastPayload?.email ||
    ""
  )
    .trim()
    .toLowerCase();
}

function resolveKnownName(): string {
  const it = useItineraryStore.getState();
  const pre = usePreBuilderStore.getState();
  return (it.clientName || pre.fullName || pre.lastPayload?.fullName || "").trim();
}

function teamBccLabel(): string {
  return EMAIL_CONFIG_DEFAULTS.routing.bccRecipient || "armando@tokiotours.nl";
}

/**
 * Send / Print — pick dossier and/or invoice, email guest + team BCC,
 * advance lead Draft → In Progress.
 */
export function PrintRequestModal({
  isOpen,
  onClose,
  onSuccess,
  skipTerms = false,
  /** Local print button — off on Builder M/S itinerary; on for export/designer tools. */
  showLocalPrint = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: PrintRequestResult) => void;
  /** When true, skip the deposit/how-it-works gate (already acknowledged upstream). */
  skipTerms?: boolean;
  showLocalPrint?: boolean;
}) {
  const state = useBuilderStore();
  const departureDate = useBuilderStore((s) => s.departureDate);
  const confirmBookingRef = useBuilderStore((s) => s.confirmBookingRef);
  const setClientEmail = useItineraryStore((s) => s.setClientEmail);
  const setClientName = useItineraryStore((s) => s.setClientName);

  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [emailLocked, setEmailLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDirectDownload, setShowDirectDownload] = useState(false);
  const [pdfRef, setPdfRef] = useState(state.tempBookingRef || "TMP-DRAFT");
  const [termsAccepted, setTermsAccepted] = useState(skipTerms);
  const [sendDocs, setSendDocs] = useState<SendDocSelection>({
    dossier: true,
    invoice: true,
  });

  useModalDismiss(isOpen && termsAccepted, () => {
    setBusy(false);
    setLocalBusy(false);
    document
      .querySelectorAll(".html2pdf__overlay, .html2pdf__container")
      .forEach((node) => node.remove());
    document.body.style.overflow = "";
    onClose();
  }, { lockScroll: false });

  const handleDismiss = () => {
    setBusy(false);
    setLocalBusy(false);
    document
      .querySelectorAll(".html2pdf__overlay, .html2pdf__container")
      .forEach((node) => node.remove());
    document.body.style.overflow = "";
    onClose();
  };

  const bookingRefDisplay = useMemo(
    () =>
      activeBookingRef({
        tempBookingRef: state.tempBookingRef,
        confirmedBookingRef: state.confirmedBookingRef,
        bookingStatus: state.bookingStatus,
      }) ||
      state.confirmedBookingRef ||
      state.tempBookingRef ||
      pdfRef ||
      "TMP-DRAFT",
    [
      state.tempBookingRef,
      state.confirmedBookingRef,
      state.bookingStatus,
      pdfRef,
    ]
  );

  useEffect(() => {
    if (!isOpen) {
      setTermsAccepted(skipTerms);
      return;
    }
    setTermsAccepted(skipTerms);
    setError(null);
    setSuccess(null);
    setShowDirectDownload(false);
    setSendDocs({ dossier: true, invoice: true });

    const knownEmail = resolveKnownEmail();
    const knownName = resolveKnownName();
    setEmail(knownEmail);
    setName(knownName);
    // Lock when we already have an email on file; unlock for empty / edit
    setEmailLocked(Boolean(knownEmail));

    const ref =
      state.confirmedBookingRef || state.tempBookingRef || "TMP-DRAFT";
    setPdfRef(ref);

    fetchBuilderConfig({ includeAccommodations: true })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [isOpen, skipTerms, state.confirmedBookingRef, state.tempBookingRef]);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  const cityNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of config?.cities ?? []) map[c.id] = c.name;
    return map;
  }, [config]);

  const runLocalPdf = async (ref: string) => {
    try {
      if (sendDocs.invoice) await downloadItineraryPdf(ref, "invoice");
      else if (sendDocs.dossier) await downloadItineraryPdf(ref, "dossier");
      else await downloadItineraryPdf(ref, "invoice");
    } catch (err) {
      console.warn("[PrintRequestModal] html2pdf failed, using print()", err);
      await printItineraryLocally(ref);
    }
  };

  if (!isOpen) return null;

  // Prefer prop gate so skipTerms takes effect on the same render as open
  // (avoids a second terms flash after parent already acknowledged).
  if (!skipTerms && !termsAccepted) {
    return (
      <BookingTermsModal
        open
        onConfirm={() => setTermsAccepted(true)}
        onCancel={handleDismiss}
        confirmLabel="I Understand — Proceed to Send / Print →"
        cancelLabel="Back to Builder"
      />
    );
  }

  const handleDirectDownload = async () => {
    setLocalBusy(true);
    setError(null);
    try {
      await runLocalPdf(pdfRef);
      setSuccess("✓ PDF downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save PDF.");
    } finally {
      setLocalBusy(false);
    }
  };

  const handleLocalSave = async () => {
    setError(null);
    setShowDirectDownload(false);
    setLocalBusy(true);
    try {
      await runLocalPdf(pdfRef);
      setSuccess("✓ PDF saved locally.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save PDF.");
      setShowDirectDownload(true);
    } finally {
      setLocalBusy(false);
    }
  };

  const handleSendPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setShowDirectDownload(false);
    setBusy(true);
    const to = email.trim().toLowerCase();
    const displayName = name.trim();

    if (!sendDocs.dossier && !sendDocs.invoice) {
      setError("Select Travel Dossier, Invoice, or both to email.");
      setBusy(false);
      return;
    }

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setError("Enter a valid email address to receive your itinerary.");
      setBusy(false);
      setEmailLocked(false);
      return;
    }

    // Persist identity for Manage Booking / future opens
    setClientEmail(to);
    if (displayName) setClientName(displayName);

    // Server Send path builds mobile Chromium PDFs (430px dark theme).
    // No client html2pdf required for email attachments.
    try {
      const res = await fetch("/api/send-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: to,
          contactName: displayName,
          email: to,
          fullName: displayName,
          state,
          quote,
          departureDate: departureDate(),
          cityNames,
          tempBookingRef: state.tempBookingRef,
          sendDocs,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ref = String(data.bookingRef || pdfRef);
      setPdfRef(ref);

      const dualWriteLead = () => {
        if (!to || !ref) return;
        void import("@/lib/syncBookingLead").then(
          ({ syncMultiDayBookingLead, syncSingleDayBookingLead }) => {
            if (state.tripMode === "single_day") {
              void import("@/store/useSingleDayBuilderStore").then(
                ({ useSingleDayBuilderStore }) =>
                  syncSingleDayBookingLead({
                    bookingRef: ref,
                    email: to,
                    state: useSingleDayBuilderStore.getState(),
                    status: "in_progress",
                    quote: quote ? { min: quote.min, max: quote.max } : null,
                  })
              );
            } else {
              void syncMultiDayBookingLead({
                bookingRef: ref,
                email: to,
                state,
                cityNames,
                status: "in_progress",
                quote: quote ? { min: quote.min, max: quote.max } : null,
              });
            }
          }
        );
      };

      if (!res.ok) {
        dualWriteLead();
        setError("Email notice delayed, but your PDF is ready below!");
        setShowDirectDownload(true);
        setSuccess(null);
        return;
      }

      if (typeof data.bookingRef === "string" && data.bookingRef) {
        confirmBookingRef(data.bookingRef, "in_progress");
      }

      dualWriteLead();

      const bcc = teamBccLabel();
      const parts = [
        sendDocs.dossier ? "dossier" : null,
        sendDocs.invoice ? "invoice" : null,
      ]
        .filter(Boolean)
        .join(" + ");
      setSuccess(
        `✓ ${parts} emailed to you (team copy → ${bcc}). Status: In Progress.`
      );
      if (showLocalPrint) {
        try {
          await runLocalPdf(ref);
        } catch {
          /* email already succeeded */
        }
      }
      setBusy(false);
      onSuccess?.({
        bookingRef: ref,
        mailSent: Boolean(data.mailSent ?? data.success),
        message:
          data.message ||
          `Emailed ${parts} to ${to} (BCC ${bcc}). Reference: ${ref}`,
      });
      // Close immediately so Done sheet is not trapped under this modal
      onClose();
      document
        .querySelectorAll(".html2pdf__overlay, .html2pdf__container")
        .forEach((node) => node.remove());
      document.body.style.overflow = "";
    } catch {
      setError("Email notice delayed, but your PDF is ready below!");
      setShowDirectDownload(true);
      setSuccess(null);
    } finally {
      setBusy(false);
      setLocalBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 sm:items-center no-print print:hidden">
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0"
        onClick={handleDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-request-title"
        className="relative z-[1] w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#075473]">
              Send / Print
            </p>
            <h2
              id="print-request-title"
              className="mt-1 font-display text-2xl text-[#0B1F3A]"
            >
              Email your itinerary
            </h2>
            <p className="mt-1 text-sm text-[#5C6570]">
              Choose dossier and/or invoice. We email you, BCC the concierge
              team, and move this booking to In Progress.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#0B1F3A]/20 bg-[#F5F0E8] text-[#0B1F3A]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Booking reference prominence */}
        <div className="mt-4 rounded-xl border-2 border-[#F6A724]/55 bg-[#FFF8EB] px-4 py-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#B8860B]">
            Booking Ref
          </p>
          <p className="mt-1 font-godiva text-xl uppercase tracking-wider text-[#0B1F3A]">
            {bookingRefDisplay}
          </p>
        </div>

        <form onSubmit={handleSendPdf} className="mt-5 space-y-3">
          <fieldset className="rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3.5 py-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-[#8A8278]">
              Send by email
            </legend>
            <div className="mt-1 space-y-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#0B1F3A]">
                <input
                  type="checkbox"
                  checked={sendDocs.dossier}
                  onChange={(e) =>
                    setSendDocs((s) => ({ ...s, dossier: e.target.checked }))
                  }
                  disabled={busy}
                  className="h-4 w-4 rounded border-[#D9D2C7] text-[#075473] focus:ring-[#075473]"
                />
                Travel Dossier
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#0B1F3A]">
                <input
                  type="checkbox"
                  checked={sendDocs.invoice}
                  onChange={(e) =>
                    setSendDocs((s) => ({ ...s, invoice: e.target.checked }))
                  }
                  disabled={busy}
                  className="h-4 w-4 rounded border-[#D9D2C7] text-[#075473] focus:ring-[#075473]"
                />
                Invoice / Quotation
              </label>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#8A8278]">
              Team copy goes to {teamBccLabel()} only on this send — not during
              draft / pre-build.
            </p>
          </fieldset>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8278]">
              Full name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#075473]"
              placeholder="Optional"
              autoComplete="name"
              disabled={busy}
            />
          </label>

          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8278]">
                Email *
              </span>
              {emailLocked && email ? (
                <button
                  type="button"
                  onClick={() => setEmailLocked(false)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#075473] hover:underline disabled:opacity-50"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  Change Email
                </button>
              ) : null}
            </div>

            {emailLocked && email ? (
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#0B1F3A]">
                  {email}
                </p>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  On file
                </span>
              </div>
            ) : (
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => {
                  const next = email.trim().toLowerCase();
                  setEmail(next);
                  if (next && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
                    setEmailLocked(true);
                  }
                }}
                className="mt-1 w-full rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#075473]"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={busy}
                autoFocus={!emailLocked}
              />
            )}
          </div>

          {/* Access notice */}
          <div
            role="note"
            className="rounded-xl border border-amber-300/70 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950"
          >
            <p className="font-semibold text-amber-900">Please verify your email</p>
            <p className="mt-1">
              You will need access to this email address along with your Booking
              Reference (
              <span className="font-godiva font-bold uppercase tracking-wider text-[#0B1F3A]">
                {bookingRefDisplay}
              </span>
              ) to retrieve, manage, or edit your itinerary in the future.
            </p>
          </div>

          {success ? (
            <p className="inline-flex w-full items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {success}
            </p>
          ) : null}

          {error ? (
            <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>{error}</p>
              {showDirectDownload ? (
                <button
                  type="button"
                  disabled={localBusy || busy}
                  onClick={() => void handleDirectDownload()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#075473] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {localBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing PDF…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download PDF Directly
                    </>
                  )}
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || localBusy || (!sendDocs.dossier && !sendDocs.invoice)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Confirm &amp; Email Selected
              </>
            )}
          </button>

          {showLocalPrint ? (
            <button
              type="button"
              disabled={busy || localBusy}
              onClick={() => void handleLocalSave()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#D9D2C7] bg-white py-3 text-sm font-semibold text-[#0B1F3A] disabled:opacity-60"
            >
              {localBusy && !showDirectDownload ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing PDF…
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Print / Save as PDF (Local)
                </>
              )}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

/** Spec alias */
export const SendPdfModal = PrintRequestModal;
