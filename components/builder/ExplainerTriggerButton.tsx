"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PbAirportTransfer,
  PbHub,
  PbVehicle,
} from "@/lib/pocketbase/client";
import {
  featureExplainerThumbnailUrl,
  fetchFeatureExplainerResolved,
} from "@/lib/pocketbase/client";
import { ExplainerModal } from "./ExplainerModal";

const FALLBACK_THUMB = "/photo/11007.jpg";

function modalFeatureKey(featureKey: string): string {
  if (
    featureKey === "airport_transfers" ||
    featureKey === "airport_transfers_combined"
  ) {
    return "airport_transfers_combined";
  }
  return featureKey;
}

export function ExplainerTriggerButton({
  featureKey,
  title,
  contextId,
  className = "",
  hubs = [],
  vehicles = [],
  airportTransfers = [],
  arrivalHubId = null,
  departureHubId = null,
}: {
  featureKey: string;
  title: string;
  /** Optional city or hub id for modal pricing context */
  contextId?: string | null;
  className?: string;
  hubs?: PbHub[];
  vehicles?: PbVehicle[];
  airportTransfers?: PbAirportTransfer[];
  arrivalHubId?: string | null;
  departureHubId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string>("");
  const [loadingThumb, setLoadingThumb] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingThumb(true);
    void (async () => {
      try {
        const row = await fetchFeatureExplainerResolved(featureKey);
        if (cancelled) return;
        const url = featureExplainerThumbnailUrl(row);
        setThumbUrl(url || FALLBACK_THUMB);
      } catch {
        if (!cancelled) setThumbUrl(FALLBACK_THUMB);
      } finally {
        if (!cancelled) setLoadingThumb(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [featureKey]);

  const resolvedModalKey = useMemo(
    () => modalFeatureKey(featureKey),
    [featureKey]
  );

  const isAirport = resolvedModalKey === "airport_transfers_combined";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Watch: ${title}`}
        className={`relative flex h-16 w-full cursor-pointer items-center overflow-hidden rounded-xl px-4 shadow-sm md:h-20 ${className}`}
      >
        <span
          className={`absolute inset-0 bg-cover bg-center transition-opacity ${
            loadingThumb ? "opacity-40" : "opacity-100"
          }`}
          style={{
            backgroundImage: `url(${thumbUrl || FALLBACK_THUMB})`,
          }}
          aria-hidden
        />
        <span
          className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"
          aria-hidden
        />
        {loadingThumb ? (
          <span className="absolute inset-0 animate-pulse bg-[#0B1F3A]/25" />
        ) : null}

        <span className="relative z-10 flex w-full items-center gap-3 md:gap-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow md:h-10 md:w-10"
            aria-hidden
          >
            <span className="ml-0.5 text-sm font-bold md:text-base">▶</span>
          </span>
          <span className="min-w-0 flex flex-col text-left">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
              Watch
            </span>
            <span className="truncate text-sm font-bold text-white md:text-base">
              {title}
            </span>
          </span>
        </span>
      </button>

      <ExplainerModal
        open={open}
        onClose={() => setOpen(false)}
        featureKey={resolvedModalKey}
        hubId={isAirport ? null : contextId ?? null}
        arrivalHubId={
          isAirport ? (arrivalHubId ?? contextId ?? null) : null
        }
        departureHubId={isAirport ? departureHubId ?? null : null}
        hubs={hubs}
        vehicles={vehicles}
        airportTransfers={airportTransfers}
      />
    </>
  );
}
