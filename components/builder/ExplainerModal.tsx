"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  featureExplainerMediaType,
  fetchFeatureExplainer,
  type PbAirportTransfer,
  type PbFeatureExplainer,
  type PbHub,
  type PbVehicle,
  pbFileUrl,
} from "@/lib/pocketbase/client";
import {
  allocateFleet,
  formatTransferPriceRange,
  priceFleetTransfer,
  type TransferPriceQuote,
} from "@/lib/vehicleAllocator";
import { useBuilderStore } from "@/store/useBuilderStore";

export type TransferType = "pickup" | "dropoff";

const COMBINED_KEY = "airport_transfers_combined";

export function ExplainerModal({
  open,
  onClose,
  transferType = "pickup",
  featureKey,
  hubId = null,
  arrivalHubId = null,
  departureHubId = null,
  hubs = [],
  vehicles = [],
  airportTransfers = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Legacy single-leg mode */
  transferType?: TransferType;
  /** CMS explainer key; use airport_transfers_combined for both legs */
  featureKey?: string;
  hubId?: string | null;
  arrivalHubId?: string | null;
  departureHubId?: string | null;
  hubs?: PbHub[];
  vehicles?: PbVehicle[];
  airportTransfers?: PbAirportTransfer[];
}) {
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const airportPickup = useBuilderStore((s) => s.airportPickup);
  const airportDropoff = useBuilderStore((s) => s.airportDropoff);
  const storeArrivalId = useBuilderStore((s) => s.arrivalTransferId);
  const storeDepartureId = useBuilderStore((s) => s.departureTransferId);
  const totalPax = adults + children;

  const combined =
    featureKey === COMBINED_KEY || featureKey === "airport_transfers";

  const contentOnly =
    featureKey === "private_chauffeur" ||
    featureKey === "elite_concierge" ||
    Boolean(featureKey && !combined && !featureKey.startsWith("airport_"));

  const resolvedFeatureKey = combined
    ? COMBINED_KEY
    : featureKey ||
      (transferType === "dropoff" ? "airport_dropoff" : "airport_pickup");

  const pickupHubId = contentOnly
    ? null
    : combined
      ? (arrivalHubId ?? storeArrivalId)
      : transferType === "pickup"
        ? hubId
        : null;
  const dropoffHubId = contentOnly
    ? null
    : combined
      ? (departureHubId ?? storeDepartureId)
      : transferType === "dropoff"
        ? hubId
        : null;

  const showPickup = contentOnly
    ? false
    : combined
      ? airportPickup
      : transferType === "pickup";
  const showDropoff = contentOnly
    ? false
    : combined
      ? airportDropoff
      : transferType === "dropoff";

  const showTransferPricing = !contentOnly;

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<PbFeatureExplainer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRecord(null);

    void (async () => {
      try {
        let row = await fetchFeatureExplainer(resolvedFeatureKey);
        if (!row && combined) {
          row =
            (await fetchFeatureExplainer("airport_pickup")) ||
            (await fetchFeatureExplainer("airport_dropoff"));
        }
        if (!row && resolvedFeatureKey === "airport_dropoff") {
          row = await fetchFeatureExplainer("airport_pickup");
        }
        if (cancelled) return;
        if (!row) {
          setError("This explanation isn’t available yet.");
          return;
        }
        setRecord(row);
      } catch {
        if (!cancelled) setError("Couldn’t load this explanation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, resolvedFeatureKey, combined]);

  const fleet = useMemo(
    () =>
      totalPax > 0 && vehicles.length
        ? allocateFleet(totalPax, vehicles)
        : null,
    [totalPax, vehicles]
  );

  const fleetLine = fleet
    ? `${fleet.label.replace("×", "x")} · ${totalPax} pax`
    : totalPax > 0
      ? `${totalPax} pax`
      : null;

  const pickupQuote = useMemo((): TransferPriceQuote | null => {
    if (!showPickup || !pickupHubId || totalPax <= 0 || !vehicles.length) {
      return null;
    }
    return priceFleetTransfer({
      hubId: pickupHubId,
      direction: "pickup",
      totalPax,
      vehicles,
      rates: airportTransfers,
    });
  }, [showPickup, pickupHubId, totalPax, vehicles, airportTransfers]);

  const dropoffQuote = useMemo((): TransferPriceQuote | null => {
    if (!showDropoff || !dropoffHubId || totalPax <= 0 || !vehicles.length) {
      return null;
    }
    return priceFleetTransfer({
      hubId: dropoffHubId,
      direction: "dropoff",
      totalPax,
      vehicles,
      rates: airportTransfers,
    });
  }, [showDropoff, dropoffHubId, totalPax, vehicles, airportTransfers]);

  const pickupHubName = hubs.find((h) => h.id === pickupHubId)?.name;
  const dropoffHubName = hubs.find((h) => h.id === dropoffHubId)?.name;

  const totalMin =
    (pickupQuote?.fromRates && pickupQuote.min > 0 ? pickupQuote.min : 0) +
    (dropoffQuote?.fromRates && dropoffQuote.min > 0 ? dropoffQuote.min : 0);
  const totalMax =
    (pickupQuote?.fromRates && pickupQuote.max > 0 ? pickupQuote.max : 0) +
    (dropoffQuote?.fromRates && dropoffQuote.max > 0 ? dropoffQuote.max : 0);
  const totalLabel =
    totalMin > 0
      ? formatTransferPriceRange(totalMin, Math.max(totalMax, totalMin))
      : null;

  const description = useMemo(() => {
    if (!record?.description) return "";
    return record.description.replace(/<[^>]+>/g, "");
  }, [record?.description]);

  if (!mounted) return null;

  const filename = record?.media_file || "";
  const mediaUrl =
    filename && record
      ? pbFileUrl(
          String(record.collectionId ?? "feature_explainers"),
          record.id,
          filename
        )
      : "";
  const mediaType = record ? featureExplainerMediaType(record) : "Image";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={record?.title || "Feature explanation"}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[90dvh] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:h-[min(90dvh,52rem)] sm:max-h-[min(90dvh,52rem)] sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-[#EEE8DF] bg-white px-4 pb-4 pt-6 sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B85304]">
                How it works
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-[#0B1F3A] px-4 py-1.5 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5">
              {loading ? (
                <p className="text-sm text-[#8A8278]">Loading…</p>
              ) : error ? (
                <p className="text-sm text-[#8A8278]">{error}</p>
              ) : record ? (
                <article className="overflow-hidden rounded-2xl border border-[#EEE8DF] bg-white shadow-[0_4px_20px_rgba(11,31,58,0.06)]">
                  <div className="relative aspect-[4/5] max-h-[45dvh] w-full bg-[#0B1F3A] sm:max-h-[50dvh]">
                    {mediaUrl && mediaType === "Video" ? (
                      /* Target: 1080p · ~1.5Mbps · mp4/webm · <5MB (see lib/mediaStandards.ts) */
                      <video
                        key={mediaUrl}
                        src={mediaUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        disablePictureInPicture
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-end bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] p-5">
                        <span className="font-display text-2xl text-white/90">
                          {record.title}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 md:p-6">
                    <h3 className="font-display text-xl leading-snug text-[#0B1F3A]">
                      {record.title}
                    </h3>
                    {description ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#5C6570]">
                        {description}
                      </p>
                    ) : null}

                    {showTransferPricing ? (
                    <div className="mt-5 space-y-3 border-t border-[#EEE8DF] pt-4">
                      {!showPickup && !showDropoff ? (
                        <p className="text-sm text-[#8A8278]">
                          Turn on pickup or drop-off above to see transfer
                          pricing for your party.
                        </p>
                      ) : null}

                      {showPickup ? (
                        <TransferLine
                          label="Pickup"
                          hubName={pickupHubName}
                          fleetLine={fleetLine}
                          quote={pickupQuote}
                          missingHub="Select an arrival airport to see pickup pricing"
                        />
                      ) : null}

                      {showDropoff ? (
                        <TransferLine
                          label="Drop-off"
                          hubName={dropoffHubName}
                          fleetLine={fleetLine}
                          quote={dropoffQuote}
                          missingHub="Select a departure airport to see drop-off pricing"
                        />
                      ) : null}

                      {totalLabel ? (
                        <div className="flex items-baseline justify-between gap-3 border-t border-[#EEE8DF] pt-3">
                          <span className="text-sm font-semibold text-[#0B1F3A]">
                            Total transfer cost
                          </span>
                          <span className="text-base font-semibold text-[#0B1F3A]">
                            {totalLabel}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    ) : null}
                  </div>
                </article>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function TransferLine({
  label,
  hubName,
  fleetLine,
  quote,
  missingHub,
}: {
  label: string;
  hubName?: string;
  fleetLine: string | null;
  quote: TransferPriceQuote | null;
  missingHub: string;
}) {
  const price =
    quote?.fromRates && quote.min > 0
      ? formatTransferPriceRange(quote.min, quote.max)
      : null;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B85304]">
          {label}
        </p>
        {hubName ? (
          <>
            <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">
              {hubName}
            </p>
            {fleetLine ? (
              <p className="mt-0.5 text-[11px] text-[#8A8278]">{fleetLine}</p>
            ) : null}
          </>
        ) : (
          <p className="mt-0.5 text-xs text-[#8A8278]">{missingHub}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {price ? (
          <span className="block text-sm font-semibold text-[#0B1F3A]">
            {price}
          </span>
        ) : hubName ? (
          <span className="block max-w-[7.5rem] text-[11px] font-medium leading-snug text-[#8A8278]">
            Price calculated at checkout
          </span>
        ) : null}
      </div>
    </div>
  );
}
