"use client";

import { useEffect, useState, type ReactNode } from "react";
import { warmCriticalAssets, type WarmProgress } from "@/lib/assetWarmup";
import { BRAND_LOGO_ICON } from "@/lib/brand";

const SESSION_KEY = "tokio-assets-warmed-v2";

/**
 * Home gate: center progress bar until characters + key videos are cached.
 * Skip on return visits in the same tab session.
 */
export function HomeAssetWarmGate({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<WarmProgress>({
    loaded: 0,
    total: 1,
    percent: 0,
    done: false,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") {
        setReady(true);
        setProgress({ loaded: 1, total: 1, percent: 100, done: true });
        return;
      }
    } catch {
      /* private mode */
    }

    let cancelled = false;
    void warmCriticalAssets((p) => {
      if (cancelled) return;
      setProgress(p);
      if (p.done) {
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          /* ignore */
        }
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (ready) return <>{children}</>;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_ICON}
        alt=""
        className="mb-6 h-14 w-14 rounded-full object-cover"
      />
      <p className="font-godiva text-xs tracking-[0.28em] text-[#D91147] uppercase">
        TOKIOTOURS
      </p>
      <p className="mt-3 text-sm text-white/55">Charging your trip assets…</p>
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
