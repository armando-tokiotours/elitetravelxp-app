"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Printer,
  X,
} from "lucide-react";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote } from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  downloadItineraryPdf,
  itineraryPdfToBase64,
  printItineraryLocally,
} from "@/lib/clientItineraryPdf";

export type PrintRequestResult = {
  bookingRef: string;
  mailSent: boolean;
  message: string;
};

/**
 * Send / Save PDF — emails via Hostinger SMTP / Resend, with instant local PDF.
 */
export function PrintRequestModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: PrintRequestResult) => void;
}) {
  const state = useBuilderStore();
  const departureDate = useBuilderStore((s) => s.departureDate);
  const confirmBookingRef = useBuilderStore((s) => s.confirmBookingRef);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDirectDownload, setShowDirectDownload] = useState(false);
  const [pdfRef, setPdfRef] = useState(state.tempBookingRef || "TMP-DRAFT");

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccess(null);
    setShowDirectDownload(false);
    setPdfRef(
      state.confirmedBookingRef || state.tempBookingRef || "TMP-DRAFT"
    );
    fetchBuilderConfig({ includeAccommodations: true })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [isOpen, state.confirmedBookingRef, state.tempBookingRef]);

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
      await downloadItineraryPdf(ref);
    } catch (err) {
      console.warn("[PrintRequestModal] client PDF failed, using print()", err);
      printItineraryLocally();
    }
  };

  if (!isOpen) return null;

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
    const to = email.trim();

    let clientPdfBase64: string | undefined;
    try {
      clientPdfBase64 = await itineraryPdfToBase64(pdfRef);
    } catch {
      clientPdfBase64 = undefined;
    }

    try {
      const res = await fetch("/api/send-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: to,
          contactName: name.trim(),
          email: to,
          fullName: name.trim(),
          state,
          quote,
          departureDate: departureDate(),
          cityNames,
          tempBookingRef: state.tempBookingRef,
          pdfBase64: clientPdfBase64,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ref = String(data.bookingRef || pdfRef);
      setPdfRef(ref);

      if (!res.ok) {
        setError(
          "Email notice delayed, but your PDF is ready below!"
        );
        setShowDirectDownload(true);
        setSuccess(null);
        return;
      }

      if (typeof data.bookingRef === "string" && data.bookingRef) {
        confirmBookingRef(data.bookingRef, "requested");
      }

      setSuccess(
        "✓ Proposal emailed to you and copy sent to armando@tokiotours.nl"
      );
      // Instant local PDF after success banner
      await runLocalPdf(ref);
      onSuccess?.({
        bookingRef: ref,
        mailSent: Boolean(data.mailSent ?? data.success),
        message:
          data.message ||
          `Proposal emailed to ${to} (BCC armando@tokiotours.nl). Reference: ${ref}`,
      });
      window.setTimeout(() => onClose(), 1800);
    } catch {
      setError("Email notice delayed, but your PDF is ready below!");
      setShowDirectDownload(true);
      setSuccess(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-request-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#B85304]">
              Send / Save PDF
            </p>
            <h2
              id="print-request-title"
              className="mt-1 font-display text-2xl text-[#0B1F3A]"
            >
              Email your itinerary
            </h2>
            <p className="mt-1 text-sm text-[#5C6570]">
              We’ll save your trip, issue a booking PNR, and email your dossier.
              A PDF also downloads to this device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#8A8278] hover:bg-[#F5F0E8]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSendPdf} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8278]">
              Full name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#B85304]"
              placeholder="Optional"
              autoComplete="name"
              disabled={busy}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8278]">
              Email *
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#B85304]"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
            />
          </label>

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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#B85304] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
            disabled={busy || localBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending your itinerary...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send / Save PDF
              </>
            )}
          </button>

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
        </form>
      </div>
    </div>
  );
}

/** Spec alias */
export const SendPdfModal = PrintRequestModal;
