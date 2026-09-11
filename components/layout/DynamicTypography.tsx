"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SITE_BRANDING,
  brandingGoogleFontsUrl,
  fetchSiteBranding,
  type PbSiteBranding,
} from "@/lib/pocketbase/client";

function safeFontName(value: string | undefined, fallback: string): string {
  const raw = (value || fallback).trim() || fallback;
  return raw.replace(/['"\\;{}]/g, "");
}

function isAllowedGoogleFontsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      (u.hostname === "fonts.googleapis.com" ||
        u.hostname === "fonts.gstatic.com")
    );
  } catch {
    return false;
  }
}

type ResolvedFont = { stack: string; weight?: string };

/**
 * Map admin-entered family names to CSS stacks (+ optional weight).
 * Local names resolve to next/font CSS variables + self-hosted @font-face names.
 */
function resolveFont(name: string, role: "display" | "sans"): ResolvedFont {
  const n = name.trim().toLowerCase();

  if (n === "momo trust display" || n === "momo") {
    return {
      stack: 'var(--font-momo), "Momo Trust Display", Georgia, serif',
    };
  }
  if (n === "poppins") {
    return {
      stack: 'var(--font-poppins), "Poppins", system-ui, sans-serif',
    };
  }
  // Century Gothic (+ Bold / ExtraBold weights) — system/desktop face
  if (n.includes("century gothic")) {
    let weight: string | undefined;
    if (n.includes("extrabold") || n.includes("extra bold") || n.includes("800"))
      weight = "800";
    else if (n.includes("bold") || n.includes("700")) weight = "700";
    return {
      stack: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif',
      weight,
    };
  }
  // Montserrat Thin / Light / ExtraBold via Google Fonts
  if (n.startsWith("montserrat") || n.startsWith("monserrat")) {
    let weight: string | undefined;
    if (n.includes("extrabold") || n.includes("extra bold") || n.includes("800"))
      weight = "800";
    else if (n.includes("bold") || n.includes("700")) weight = "700";
    else if (n.includes("thin")) weight = "100";
    else if (n.includes("extralight") || n.includes("extra light"))
      weight = "200";
    else if (n.includes("light")) weight = "300";
    return {
      stack: '"Montserrat", system-ui, sans-serif',
      weight,
    };
  }

  const fallback =
    role === "display" ? "Georgia, serif" : "system-ui, sans-serif";
  return { stack: `"${name}", ${fallback}` };
}

function defaultGoogleUrlFor(branding: PbSiteBranding | null): string {
  const configured = brandingGoogleFontsUrl(branding);
  if (configured) return configured;

  const names = [
    branding?.font_h1 || DEFAULT_SITE_BRANDING.font_h1,
    branding?.font_h2 || DEFAULT_SITE_BRANDING.font_h2,
  ]
    .join(" ")
    .toLowerCase();
  if (names.includes("montserrat") || names.includes("monserrat")) {
    return DEFAULT_SITE_BRANDING.google_fonts_url;
  }
  return "";
}

/**
 * Runtime typography — fetches site_branding and applies CSS vars + optional
 * Google Fonts stylesheet (next/font is compile-time only).
 */
export function DynamicTypography() {
  const [branding, setBranding] = useState<PbSiteBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = await fetchSiteBranding();
      if (!cancelled) setBranding(row);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = useMemo(() => {
    const h1 = resolveFont(
      safeFontName(branding?.font_h1, DEFAULT_SITE_BRANDING.font_h1),
      "display"
    );
    const h2 = resolveFont(
      safeFontName(branding?.font_h2, DEFAULT_SITE_BRANDING.font_h2),
      "sans"
    );
    const body = resolveFont(
      safeFontName(branding?.font_body, DEFAULT_SITE_BRANDING.font_body),
      "sans"
    );
    return { h1, h2, body };
  }, [branding]);

  const googleUrl = defaultGoogleUrlFor(branding);
  const allowGoogle = Boolean(googleUrl && isAllowedGoogleFontsUrl(googleUrl));

  useEffect(() => {
    if (!allowGoogle || !googleUrl) return;

    const id = "elite-google-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = googleUrl;
  }, [allowGoogle, googleUrl]);

  const css = `
:root {
  --font-h1: ${resolved.h1.stack};
  --font-h2: ${resolved.h2.stack};
  --font-body: ${resolved.body.stack};
  --font-display: var(--font-h1);
  --font-h1-weight: ${resolved.h1.weight || "inherit"};
  --font-h2-weight: ${resolved.h2.weight || "inherit"};
}
h1, .text-h1 {
  font-family: var(--font-h1) !important;
  font-weight: var(--font-h1-weight) !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
h2, .text-h2 {
  font-family: var(--font-h2) !important;
  font-weight: var(--font-h2-weight) !important;
}
.font-display {
  font-family: var(--font-h1) !important;
  font-weight: var(--font-h1-weight) !important;
}
body { font-family: var(--font-body); }
`.trim();

  return <style id="elite-dynamic-typography">{css}</style>;
}
