"use client";

import { useEffect, useMemo, useState } from "react";
import { LOCAL_FONTS } from "@/lib/brand";
import { fetchSiteBranding, type PbSiteBranding } from "@/lib/pocketbase/client";

type ResolvedFont = { stack: string; weight?: string };

function localStacks() {
  return {
    h1: {
      stack: 'var(--font-godiva-face), "Godiva", Georgia, serif',
      weight: "400",
    } satisfies ResolvedFont,
    h2: {
      stack: 'var(--font-hanson-face), "Hanson", Impact, sans-serif',
      weight: "700",
    } satisfies ResolvedFont,
    body: {
      stack:
        'var(--font-futura-face), "Futura", "Trebuchet MS", system-ui, sans-serif',
      weight: "500",
    } satisfies ResolvedFont,
  };
}

/**
 * Force local TOKIOTOURS typography — PocketBase/admin Google Font picks
 * no longer load external stylesheets or override Godiva/Hanson/Futura.
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
    void branding;
    void LOCAL_FONTS;
    return localStacks();
  }, [branding]);

  // Strip any previously injected Google Fonts link from older sessions
  useEffect(() => {
    for (const id of ["tokio-google-fonts", "elite-google-fonts", "elite-admin-google-fonts"]) {
      document.getElementById(id)?.remove();
    }
  }, []);

  const css = `
:root {
  --font-h1: ${resolved.h1.stack};
  --font-h2: ${resolved.h2.stack};
  --font-body: ${resolved.body.stack};
  --font-caption: var(--font-geosans-face), "GeosansLight", system-ui, sans-serif;
  --font-display: var(--font-h1);
  --font-h1-weight: ${resolved.h1.weight};
  --font-h2-weight: ${resolved.h2.weight};
}
h1, .text-h1, .font-godiva-h1, .h1-title {
  font-family: var(--font-h1) !important;
  font-weight: var(--font-h1-weight) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em;
}
h2, .text-h2, h3, .text-h3 {
  font-family: var(--font-h2) !important;
  font-weight: var(--font-h2-weight) !important;
}
.font-display, .font-godiva {
  font-family: var(--font-h1) !important;
  font-weight: var(--font-h1-weight) !important;
}
.font-hanson, .font-anton, .font-h2 {
  font-family: var(--font-h2) !important;
  font-weight: var(--font-h2-weight) !important;
}
.font-futura, .font-sans {
  font-family: var(--font-body) !important;
}
.font-geosans {
  font-family: var(--font-caption) !important;
}
.font-beauty, .japan-keyword {
  font-family: var(--font-beauty-face), "Beauty", cursive, serif !important;
  font-weight: 400 !important;
  text-transform: none !important;
}
h1 .japan-keyword, h1 .font-beauty,
.text-h1 .japan-keyword, .h1-title .japan-keyword, .font-godiva-h1 .japan-keyword {
  text-transform: none !important;
}
body { font-family: var(--font-body); }
`.trim();

  return <style id="tokio-dynamic-typography">{css}</style>;
}
