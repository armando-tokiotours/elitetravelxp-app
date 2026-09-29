"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import {
  DIAL_CODES,
  filterDialCodes,
  formatPhoneValue,
  parsePhoneValue,
  type DialCode,
} from "@/lib/dialCodes";

type Props = {
  value: string;
  onChange: (full: string) => void;
  className?: string;
};

/**
 * Phone input: country dial code (search + scroll) + national number.
 * Emits a single string like "+81 9012345678".
 */
export function PhoneCountryField({ value, onChange, className = "" }: Props) {
  const parsed = useMemo(() => parsePhoneValue(value), [value]);
  const [country, setCountry] = useState<DialCode>(parsed.country);
  const [national, setNational] = useState(parsed.national);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync inward when parent value changes from outside
  useEffect(() => {
    const next = parsePhoneValue(value);
    setCountry(next.country);
    setNational(next.national);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 40);
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  const options = useMemo(() => filterDialCodes(query), [query]);

  const emit = (c: DialCode, n: string) => {
    onChange(formatPhoneValue(c, n));
  };

  const pick = (c: DialCode) => {
    setCountry(c);
    setOpen(false);
    setQuery("");
    emit(c, national);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Country dial code"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-[#121212] px-2.5 py-2.5 text-sm text-white transition hover:border-white/25"
        >
          <span aria-hidden className="text-base leading-none">
            {country.flag}
          </span>
          <span className="font-medium tabular-nums">+{country.dial}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-white/50 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="90 1234 5678"
          value={national}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d\s-]/g, "");
            setNational(next);
            emit(country, next);
          }}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#075473]"
        />
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code…"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="rounded-full p-1 text-white/40 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <ul
            className="max-h-52 overflow-y-auto overscroll-contain py-1"
            role="listbox"
          >
            {options.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-white/40">
                No countries match
              </li>
            ) : (
              options.map((c) => {
                const selected = c.iso === country.iso && c.dial === country.dial;
                return (
                  <li key={`${c.iso}-${c.dial}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(c)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                        selected ? "bg-[#075473]/25 text-white" : "text-white/85"
                      }`}
                    >
                      <span aria-hidden className="text-base">
                        {c.flag}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="shrink-0 tabular-nums text-white/55">
                        +{c.dial}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <p className="border-t border-white/10 px-3 py-1.5 text-[10px] text-white/35">
            {DIAL_CODES.length} countries · scroll or type to find
          </p>
        </div>
      ) : null}
    </div>
  );
}
