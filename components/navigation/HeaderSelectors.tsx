"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Banknote, Globe } from "lucide-react";
import {
  DISPLAY_CURRENCIES,
  type DisplayCurrency,
} from "@/lib/currency";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import {
  readStoredTranslateLang,
  setGoogleTranslateLanguage,
  TRANSLATE_LANGS,
  type TranslateLang,
} from "@/components/i18n/GoogleTranslateScript";

type OpenMenu = "lang" | "currency" | null;

type HeaderSelectorsProps = {
  /** Match light or dark guest chrome */
  tone?: "dark" | "light";
  className?: string;
};

/**
 * Compact language + currency icon menus for guest chrome.
 * Place immediately left of the MANAGE / Manage Booking control.
 */
export function HeaderSelectors({
  tone = "dark",
  className = "",
}: HeaderSelectorsProps) {
  const { currency, setCurrency } = useCurrency();
  const [lang, setLang] = useState<TranslateLang>("en");
  const [open, setOpen] = useState<OpenMenu>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const langListId = useId();
  const currencyListId = useId();

  useEffect(() => {
    setLang(readStoredTranslateLang());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const iconBtn =
    tone === "dark"
      ? "flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-300 transition hover:border-white/30 hover:text-white sm:h-9 sm:w-9"
      : "flex h-8 w-8 items-center justify-center rounded-full border border-[#D9D2C7] bg-white text-[#0B1F3A] transition hover:border-[#075473] sm:h-9 sm:w-9";

  const menuPanel =
    tone === "dark"
      ? "absolute right-0 top-[calc(100%+0.35rem)] z-[60] min-w-[9.5rem] overflow-hidden rounded-xl border border-white/15 bg-[#0A1017]/95 py-1 shadow-xl backdrop-blur-md"
      : "absolute right-0 top-[calc(100%+0.35rem)] z-[60] min-w-[9.5rem] overflow-hidden rounded-xl border border-[#D9D2C7] bg-white py-1 shadow-xl";

  const itemBase =
    tone === "dark"
      ? "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[11px] font-semibold tracking-wide text-zinc-300 transition hover:bg-white/10 hover:text-white"
      : "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[11px] font-semibold tracking-wide text-[#0B1F3A] transition hover:bg-[#075473]/10";

  const activeItem =
    tone === "dark" ? "bg-white/10 text-white" : "bg-[#075473]/10 text-[#075473]";

  const pickLang = (code: TranslateLang) => {
    setLang(code);
    setGoogleTranslateLanguage(code);
    setOpen(null);
  };

  const pickCurrency = (code: DisplayCurrency) => {
    setCurrency(code);
    setOpen(null);
  };

  return (
    <div
      ref={rootRef}
      className={`relative flex shrink-0 items-center gap-1.5 sm:gap-2 ${className}`}
    >
      <div className="relative">
        <button
          type="button"
          className={iconBtn}
          aria-label="Language"
          aria-haspopup="listbox"
          aria-expanded={open === "lang"}
          aria-controls={langListId}
          onClick={() => setOpen((v) => (v === "lang" ? null : "lang"))}
        >
          <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
        </button>
        {open === "lang" ? (
          <ul id={langListId} role="listbox" className={menuPanel}>
            {TRANSLATE_LANGS.map((row) => (
              <li key={row.code} role="option" aria-selected={lang === row.code}>
                <button
                  type="button"
                  className={`${itemBase} ${lang === row.code ? activeItem : ""}`}
                  onClick={() => pickLang(row.code)}
                >
                  <span>{row.label}</span>
                  <span className="font-mono text-[10px] opacity-70">
                    {row.code.toUpperCase()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          className={iconBtn}
          aria-label="Currency"
          aria-haspopup="listbox"
          aria-expanded={open === "currency"}
          aria-controls={currencyListId}
          onClick={() =>
            setOpen((v) => (v === "currency" ? null : "currency"))
          }
        >
          <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
        </button>
        {open === "currency" ? (
          <ul id={currencyListId} role="listbox" className={menuPanel}>
            {DISPLAY_CURRENCIES.map((code) => (
              <li key={code} role="option" aria-selected={currency === code}>
                <button
                  type="button"
                  className={`${itemBase} ${currency === code ? activeItem : ""}`}
                  onClick={() => pickCurrency(code)}
                >
                  <span>{code}</span>
                  {currency === code ? (
                    <span className="text-[10px] opacity-70">Active</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
