"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Link2 } from "lucide-react";
import { BRAND_URL } from "@/lib/brand";

type DraftResult = {
  bookingRef: string;
  guestName: string;
  guestEmail: string;
  magicLink: string;
};

function firstName(full: string): string {
  const part = String(full || "")
    .trim()
    .split(/\s+/)[0];
  return part || "there";
}

function buildWhatsAppTemplate(r: DraftResult): string {
  return (
    `Hi ${firstName(r.guestName)}, I've prepared a draft itinerary for you. ` +
    `You can review your trip and select your transport options here:\n\n` +
    `Link: ${r.magicLink}\n` +
    `Booking ID: ${r.bookingRef}`
  );
}

export function DraftBookingIntake() {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  const template = useMemo(
    () => (result ? buildWhatsAppTemplate(result) : ""),
    [result]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(null);
    try {
      const res = await fetch("/api/agent/draft-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName, guestEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        bookingRef?: string;
        guestName?: string;
        guestEmail?: string;
        magicLink?: string;
      };
      if (!res.ok || !data.ok || !data.bookingRef || !data.magicLink) {
        setError(data.error || "Could not generate booking link.");
        return;
      }
      setResult({
        bookingRef: data.bookingRef,
        guestName: data.guestName || guestName,
        guestEmail: data.guestEmail || guestEmail,
        magicLink: data.magicLink,
      });
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(kind: "link" | "message", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Clipboard blocked — copy manually.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#0D1117]/70 p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2 text-[#F6A724]">
          <Link2 className="h-4 w-4" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
            Staff intake
          </span>
        </div>
        <h2 className="font-godiva text-xl uppercase tracking-wider text-white sm:text-2xl">
          Draft booking link
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Create a draft PNR and a production magic link (
          <span className="text-zinc-300">{BRAND_URL.replace(/^https?:\/\//, "")}</span>
          ) for WhatsApp or email. Does not use localhost.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Guest name
            </span>
            <input
              type="text"
              required
              autoComplete="name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Alex Rivera"
              className="w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-white outline-none ring-[#075473] placeholder:text-zinc-600 focus:ring-1"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Guest email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@email.com"
              className="w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 text-sm text-white outline-none ring-[#075473] placeholder:text-zinc-600 focus:ring-1"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[#075473] py-3 text-sm font-semibold text-white transition hover:bg-[#054F70] disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate Booking Link"}
          </button>
        </form>
      </div>

      <AnimatePresence>
        {result ? (
          <motion.div
            key={result.bookingRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="space-y-3 rounded-2xl border border-[#F6A724]/25 bg-[#0D1117]/70 p-5 sm:p-6"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F6A724]">
              Ready to send
            </p>
            <div>
              <p className="text-xs text-zinc-500">Booking ID</p>
              <p className="mt-0.5 font-mono text-lg font-semibold tracking-wide text-white">
                {result.bookingRef}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Magic link</p>
              <p className="mt-0.5 break-all text-sm text-[#7dd3fc]">
                {result.magicLink}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => copyText("link", result.magicLink)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                {copied === "link" ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied === "link" ? "Link copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => copyText("message", template)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#F6A724] py-2.5 text-sm font-semibold text-[#0A1017] hover:bg-[#ffb83d]"
              >
                {copied === "message" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied === "message" ? "Message copied" : "Copy WhatsApp message"}
              </button>
            </div>

            <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-300">
              {template}
            </pre>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
