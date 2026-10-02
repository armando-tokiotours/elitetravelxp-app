"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import {
  composeWhatsapp,
  DEFAULT_COUNTRY_DIAL,
  filterCountryDials,
  parseWhatsappParts,
  type CountryDial,
} from "@/lib/countryDialCodes";

const LOOK_SRC = "/brand/mascot-look.webp";
const NOTE_SRC = "/brand/mascot-note.webp";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after contact is saved locally (+ optional PB create). */
  onSaved: (contact: {
    fullName: string;
    email: string;
    whatsapp: string;
  }) => void | Promise<void>;
  initialName?: string;
  initialEmail?: string;
  initialWhatsapp?: string;
}

/**
 * Contact gate before estimate — name, email, phone with dial search.
 * Header: copy left · look/note mascot right (no jump).
 */
export function SaveRequiredContactModal({
  open,
  onClose,
  onSaved,
  initialName = "",
  initialEmail = "",
  initialWhatsapp = "",
}: Props) {
  const [guestName, setGuestName] = useState(initialName);
  const [guestEmail, setGuestEmail] = useState(initialEmail);
  const [country, setCountry] = useState<CountryDial>(DEFAULT_COUNTRY_DIAL);
  const [national, setNational] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialOpen, setDialOpen] = useState(false);
  const [dialQuery, setDialQuery] = useState("");
  const [takingNotes, setTakingNotes] = useState(false);
  const noteTimer = useRef<number | null>(null);
  const dialRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setGuestName(initialName);
    setGuestEmail(initialEmail);
    const parts = parseWhatsappParts(initialWhatsapp);
    setCountry(parts.country);
    setNational(parts.national);
    setError(null);
    setDialOpen(false);
    setDialQuery("");
    setTakingNotes(false);
  }, [open, initialName, initialEmail, initialWhatsapp]);

  useEffect(() => {
    if (!dialOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!dialRef.current?.contains(e.target as Node)) {
        setDialOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [dialOpen]);

  useEffect(() => {
    return () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
    };
  }, []);

  const filteredDials = useMemo(
    () => filterCountryDials(dialQuery),
    [dialQuery]
  );

  const flashNote = () => {
    setTakingNotes(true);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setTakingNotes(false), 1400);
  };

  if (!open) return null;

  const handleSave = async () => {
    const fullName = guestName.trim();
    const email = guestEmail.trim().toLowerCase();
    const whatsapp = composeWhatsapp(country.dial, national);
    if (!fullName) {
      setError("Enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email.");
      return;
    }
    if (whatsapp.replace(/\D/g, "").length < 8) {
      setError("Enter a valid phone / WhatsApp number.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSaved({ fullName, email, whatsapp });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-[#0A1017] p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <span className="text-[10px] font-bold tracking-wider text-[#00B4D8] uppercase">
            Contact
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Text left · character right — fixed slot, no jump */}
        <div className="grid grid-cols-[1fr_5.5rem] items-center gap-2 text-left">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-bold tracking-wide text-white uppercase sm:text-base">
              Save Your Request First
            </h3>
            <p className="text-[11px] leading-snug text-gray-400 sm:text-xs">
              Name, email, and phone unlock your estimate. Dates and guests stay
              in the builder.
            </p>
          </div>
          <div className="relative h-[5.25rem] w-[5.5rem] shrink-0 overflow-hidden">
            <AnimatePresence mode="sync" initial={false}>
              <motion.img
                key={takingNotes ? "note" : "look"}
                src={takingNotes ? NOTE_SRC : LOOK_SRC}
                alt=""
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 h-full w-full object-contain object-bottom drop-shadow-lg"
                draggable={false}
              />
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-3 text-left">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Guest Name"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                flashNote();
              }}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 py-2 text-xs text-white"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">
              Email
            </label>
            <input
              type="email"
              placeholder="you@email.com"
              value={guestEmail}
              onChange={(e) => {
                setGuestEmail(e.target.value);
                flashNote();
              }}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 py-2 text-xs text-white"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">
              Phone / WhatsApp
            </label>
            <div className="relative mt-1 flex gap-1.5" ref={dialRef}>
              <button
                type="button"
                onClick={() => setDialOpen((v) => !v)}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#F6A724]/45 bg-[#0D1117] px-2.5 py-2 text-xs text-white"
                aria-label="Choose country code"
                aria-expanded={dialOpen}
              >
                <span aria-hidden>{country.flag}</span>
                <span className="font-mono text-[11px]">{country.dial}</span>
                <ChevronDown className="h-3 w-3 text-zinc-400" aria-hidden />
              </button>
              <input
                type="tel"
                placeholder="90 1234 5678"
                value={national}
                onChange={(e) => {
                  setNational(e.target.value);
                  flashNote();
                }}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0D1117] px-3 py-2 text-xs text-white"
                autoComplete="tel-national"
              />

              {dialOpen ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-hidden rounded-xl border border-white/15 bg-[#0D1117] shadow-2xl">
                  <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-2">
                    <Search className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
                    <input
                      type="search"
                      value={dialQuery}
                      onChange={(e) => setDialQuery(e.target.value)}
                      placeholder="Search country or code…"
                      className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-600"
                      autoFocus
                    />
                  </div>
                  <ul className="max-h-36 overflow-y-auto py-1">
                    {filteredDials.map((c) => (
                      <li key={`${c.iso}-${c.dial}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setCountry(c);
                            setDialOpen(false);
                            setDialQuery("");
                            flashNote();
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-white/5 ${
                            c.iso === country.iso && c.dial === country.dial
                              ? "bg-[#075473]/25 text-white"
                              : "text-zinc-300"
                          }`}
                        >
                          <span aria-hidden>{c.flag}</span>
                          <span className="min-w-0 flex-1 truncate">{c.name}</span>
                          <span className="font-mono text-[11px] text-zinc-400">
                            {c.dial}
                          </span>
                        </button>
                      </li>
                    ))}
                    {filteredDials.length === 0 ? (
                      <li className="px-3 py-3 text-center text-[11px] text-zinc-500">
                        No match
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-left text-xs text-[#E60F43]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="w-full rounded-xl bg-[#075473] py-3 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition-transform hover:bg-[#075473]/80 active:scale-95 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save Request →"}
        </button>
      </div>
    </div>
  );
}
