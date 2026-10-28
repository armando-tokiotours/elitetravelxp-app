"use client";

import { useEffect } from "react";
import Script from "next/script";

const LANG_STORAGE_KEY = "tokiotours_display_lang";

export type TranslateLang = "en" | "fr" | "de" | "nl";

export const TRANSLATE_LANGS: readonly {
  code: TranslateLang;
  label: string;
}[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "nl", label: "Nederlands" },
] as const;

type TranslateElementCtor = new (
  options: {
    pageLanguage: string;
    includedLanguages?: string;
    autoDisplay?: boolean;
    layout?: number;
  },
  elementId: string
) => void;

type GoogleTranslateApi = {
  translate?: {
    TranslateElement: TranslateElementCtor;
  };
};

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
  }
}

function getGoogleTranslateApi(): GoogleTranslateApi | undefined {
  // Window.google is already typed for Maps — cast only the translate surface.
  return (window as Window & { google?: GoogleTranslateApi }).google;
}

function initGoogleTranslateElement() {
  if (typeof window === "undefined") return;
  const api = getGoogleTranslateApi();
  if (!api?.translate?.TranslateElement) return;
  const host = document.getElementById("google_translate_element");
  if (!host) return;
  // Avoid double-init if the gadget already mounted
  if (host.querySelector(".goog-te-combo")) return;
  new api.translate.TranslateElement(
    {
      pageLanguage: "en",
      includedLanguages: "en,fr,de,nl",
      autoDisplay: false,
    },
    "google_translate_element"
  );
}

function cookieDomainVariants(): string[] {
  const host = window.location.hostname;
  if (!host || host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return [""];
  }
  const parts = host.split(".");
  const domains = [""];
  // hostname and leading-dot parent (e.g. example.com → .example.com)
  domains.push(host);
  if (parts.length >= 2) {
    domains.push(`.${parts.slice(-2).join(".")}`);
    if (parts.length > 2) domains.push(`.${host}`);
  }
  return [...new Set(domains)];
}

/** Expire googtrans on path=/ for hostname and common domain variants. */
export function clearGoogTransCookies() {
  if (typeof document === "undefined") return;
  const expire = "Thu, 01 Jan 1970 00:00:00 GMT";
  for (const domain of cookieDomainVariants()) {
    const domainPart = domain ? `; domain=${domain}` : "";
    document.cookie = `googtrans=; expires=${expire}; path=/${domainPart}`;
    document.cookie = `googtrans=; expires=${expire}; path=/; max-age=0${domainPart}`;
  }
}

function setGoogTransCookie(value: string) {
  // Google expects raw `/en/{code}` (do not URI-encode the slashes)
  document.cookie = `googtrans=${value}; path=/`;
  const host = window.location.hostname;
  if (host && host !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split(".");
    if (parts.length >= 2) {
      document.cookie = `googtrans=${value}; path=/; domain=.${parts.slice(-2).join(".")}`;
    }
  }
}

/** Strip Translate chrome left in the DOM and undo body offset. */
export function teardownGoogleTranslateDom() {
  if (typeof document === "undefined") return;

  const selectors = [
    ".goog-te-banner-frame",
    ".goog-te-balloon-frame",
    "#goog-gt-tt",
    ".goog-te-spinner-pos",
    ".goog-tooltip",
    "iframe.skiptranslate",
    ".goog-te-menu-frame",
  ];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => el.remove());
  }

  const host = document.getElementById("google_translate_element");
  if (host) host.innerHTML = "";

  document
    .querySelectorAll(".goog-text-highlight, font[style*='background-color']")
    .forEach((el) => {
      el.classList.remove("goog-text-highlight");
    });

  const body = document.body;
  if (body) {
    body.style.top = "0";
    body.style.position = "";
    body.classList.remove("translated-ltr", "translated-rtl");
  }
  const html = document.documentElement;
  if (html) {
    html.classList.remove("translated-ltr", "translated-rtl");
  }
}

/**
 * Switch display language. Non-English sets googtrans=/en/{code} then reloads.
 * English clears googtrans + storage, tears down Translate DOM, then hard-reloads
 * so the page returns to native English without a cached Translate session.
 */
export function setGoogleTranslateLanguage(lang: TranslateLang): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (lang === "en") {
      window.localStorage.removeItem(LANG_STORAGE_KEY);
    } else {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    }
  } catch {
    /* ignore */
  }

  if (lang === "en") {
    try {
      sessionStorage.removeItem("tokiotours_cleared_googtrans");
    } catch {
      /* ignore */
    }
    clearGoogTransCookies();
    teardownGoogleTranslateDom();
    // Reload after clear so cookie expiry sticks and native DOM returns
    window.location.reload();
    return true;
  }

  setGoogTransCookie(`/en/${lang}`);
  // Also nudge the combo when present (helps before reload finishes)
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (combo && combo.value !== lang) {
    combo.value = lang;
    combo.dispatchEvent(new Event("change"));
  }
  window.location.reload();
  return true;
}

export function readStoredTranslateLang(): TranslateLang {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (raw === "en" || raw === "fr" || raw === "de" || raw === "nl") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "en";
}

/**
 * Loads the Google Translate Element (hidden). HeaderSelectors drives language
 * by changing `.goog-te-combo` — banner/gadget chrome is CSS-hidden in globals.
 */
export function GoogleTranslateScript() {
  useEffect(() => {
    window.googleTranslateElementInit = initGoogleTranslateElement;
    // Script may already be loaded (client nav remount)
    initGoogleTranslateElement();

    const stored = readStoredTranslateLang();
    // Native English: ensure no leftover googtrans session re-activates Translate
    if (stored === "en") {
      const hasGoogtrans = document.cookie
        .split(";")
        .some((c) => c.trim().startsWith("googtrans="));
      const alreadyTried = (() => {
        try {
          return sessionStorage.getItem("tokiotours_cleared_googtrans") === "1";
        } catch {
          return false;
        }
      })();
      if (hasGoogtrans && !alreadyTried) {
        try {
          sessionStorage.setItem("tokiotours_cleared_googtrans", "1");
        } catch {
          /* ignore */
        }
        clearGoogTransCookies();
        teardownGoogleTranslateDom();
        window.location.reload();
      } else if (!hasGoogtrans) {
        try {
          sessionStorage.removeItem("tokiotours_cleared_googtrans");
        } catch {
          /* ignore */
        }
        teardownGoogleTranslateDom();
      }
      return;
    }

    // Re-apply stored non-EN language once the combo appears (cookie may already be set)
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
      if (!combo) {
        if (tries > 40) window.clearInterval(id);
        return;
      }
      if (combo.value === stored || tries > 40) {
        window.clearInterval(id);
        return;
      }
      combo.value = stored;
      combo.dispatchEvent(new Event("change"));
      window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <div
        id="google_translate_element"
        className="google-translate-host"
        aria-hidden
      />
      <Script
        id="google-translate-element"
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
        onReady={initGoogleTranslateElement}
      />
    </>
  );
}
