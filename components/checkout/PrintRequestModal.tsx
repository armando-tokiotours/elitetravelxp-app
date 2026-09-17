"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote } from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";

export type PrintRequestResult = {
  bookingRef: string;
  mailSent: boolean;
  message: string;
};

/**
 * Collects email, saves itinerary + PNR server-side, emails PDF via Resend.
 * Replaces fragile client window.print() for "Send / Save PDF".
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchBuilderConfig().then(setConfig).catch(() => setConfig(null));
  }, [isOpen]);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  const cityNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of config?.cities ?? []) map[c.id] = c.name;
    return map;
  }, [config]);

  if (!isOpen) return null;

  const handleSendPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const to = email.trim();
    try {
      const res = await fetch("/api/send-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: to,
          contactName: name.trim(),
          state,
          quote,
          departureDate: departureDate(),
          cityNames,
          tempBookingRef: state.tempBookingRef,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const savedRef =
          typeof data?.bookingRef === "string" ? data.bookingRef : "";
        throw new Error(
          data?.error ||
            (savedRef
              ? `Saved as ${savedRef}, but email failed.`
              : "Could not save and email your itinerary.")
        );
      }
      const ref = String(data.bookingRef || "");
      confirmBookingRef(ref, "requested");
      onSuccess?.({
        bookingRef: ref,
        mailSent: Boolean(data.mailSent ?? data.success),
        message:
          data.message ||
          `Itinerary emailed to ${to}! Reference: ${ref}`,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
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
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#C4A35A]">
              Send / Save PDF
            </p>
            <h2
              id="print-request-title"
              className="mt-1 font-display text-2xl text-[#0B1F3A]"
            >
              Email your itinerary
            </h2>
            <p className="mt-1 text-sm text-[#5C6570]">
              We’ll save your trip, issue a booking PNR, and email a PDF
              dossier to you. Our team is notified automatically (BCC). Use
              email + PNR anytime via Manage Booking to reload and edit.
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
              className="mt-1 w-full rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#C4A35A]"
              placeholder="Optional"
              autoComplete="name"
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
              className="mt-1 w-full rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#C4A35A]"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
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
                Send / Save PDF
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
