"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  warmCriticalAssets,
  warmBuilderEntryAssets,
  type WarmProgress,
} from "@/lib/assetWarmup";
import { BrandLogoIcon } from "@/components/branding/BrandLogoIcon";

const HOME_SESSION_KEY = "tokio-assets-warmed-v2";
const BUILDER_SESSION_KEY = "tokio-builder-entry-warmed-v1";

export function ChargingScreen({
  progress,
  label,
  logoSrc: _logoSrc,
  embedded = false,
}: {
  progress: WarmProgress;
  label: string;
  logoSrc?: string;
  /** Inline preview (Layout Builder) instead of fixed overlay */
  embedded?: boolean;
}) {
  const shell = embedded
    ? "relative flex min-h-[20rem] w-full flex-col items-center justify-center rounded-2xl bg-[#04080C] px-6 py-10 text-white"
    : "fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#04080C] px-6 text-white";

  return (
    <div className={shell}>
      <BrandLogoIcon
        priority
        className="mb-6 h-14 w-[51px] rounded-full object-cover"
      />
      <p className="font-godiva text-xs tracking-[0.28em] text-[#D91147] uppercase">
        TOKIOTOURS
      </p>
      <p className="mt-3 text-sm text-white/55">{label}</p>
      <div
        className="mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="Loading assets"
      >
        <div
          className="h-full rounded-full bg-[#075473] transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(4, progress.percent)}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] tabular-nums text-white/35">
        {progress.percent}%
      </p>
    </div>
  );
}

/**
 * Speed test: never block the homepage — warm icons/characters in the background.
 */
export function HomeAssetWarmGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HOME_SESSION_KEY) === "1") return;
    } catch {
      /* private mode */
    }

    void warmCriticalAssets((p) => {
      if (!p.done) return;
      try {
        sessionStorage.setItem(HOME_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    });
  }, []);

  return <>{children}</>;
}

/** Fire-and-forget builder warm — does not block navigation. */
export function runBuilderEntryWarm(
  onProgress?: (p: WarmProgress) => void
): Promise<void> {
  try {
    if (sessionStorage.getItem(BUILDER_SESSION_KEY) === "1") {
      onProgress?.({ loaded: 1, total: 1, percent: 100, done: true });
      return Promise.resolve();
    }
  } catch {
    /* private mode */
  }

  return warmBuilderEntryAssets((p) => {
    onProgress?.(p);
    if (p.done) {
      try {
        sessionStorage.setItem(BUILDER_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  });
}

export function BuilderEntryChargingOverlay({
  progress,
}: {
  progress: WarmProgress;
}) {
  return (
    <ChargingScreen progress={progress} label="Charging your builder…" />
  );
}
