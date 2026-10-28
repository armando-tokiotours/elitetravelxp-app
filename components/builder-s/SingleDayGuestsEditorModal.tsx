"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { useBuilderStore } from "@/store/useBuilderStore";
import { FieldLabel } from "@/components/builder/ui";
import { type PaceId } from "@/lib/travelPace";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { PaceDetailModal } from "@/components/builder/modals/PaceDetailModal";
import { GuestCountStrip } from "@/components/branding/GuestCountStrip";
import { GuestRequirementsSelector } from "@/components/builder/GuestRequirementsSelector";
import { BuilderEditModalShell } from "@/components/builder/modals/BuilderEditModalShell";
import {
  useSingleDayBuilderStore,
  type SingleDayTravelPace,
} from "@/store/useSingleDayBuilderStore";
import type { PbCity } from "@/lib/pocketbase/client";
import {
  guestSpecialRequirementsChoicesComplete,
  guestSpecialRequirementsNotesValid,
  type GuestSpecialRequirements,
} from "@/lib/guestSpecialRequirements";
import { syncSingleDayBookingLead } from "@/lib/syncBookingLead";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";

/**
 * Builder S Guests & Pace — full-page opaque sub-step (CityFocus pattern).
 * Hours/date live in SingleDayTripDetailModal.
 */
export function SingleDayGuestsEditorModal({
  open,
  onClose,
  onConfirmed,
  selectedCity,
}: {
  open: boolean;
  onClose: () => void;
  /** Fired when Done succeeds — advances guided pulsar to meeting. */
  onConfirmed?: () => void;
  selectedCity?: PbCity | null;
}) {
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const travelPace = useSingleDayBuilderStore((s) => s.travelPace);
  void selectedCity;
  const setAdultsSd = useSingleDayBuilderStore((s) => s.setAdults);
  const setChildrenSd = useSingleDayBuilderStore((s) => s.setChildren);
  const setTravelPaceSd = useSingleDayBuilderStore((s) => s.setTravelPace);

  const guestSpecialRequirements = useSingleDayBuilderStore(
    (s) => s.guestSpecialRequirements
  );
  const guestSpecialRequirementsAcked = useSingleDayBuilderStore(
    (s) => s.guestSpecialRequirementsAcked
  );
  const setGuestSpecialRequirementsSd = useSingleDayBuilderStore(
    (s) => s.setGuestSpecialRequirements
  );
  const ackGuestSpecialRequirementsSd = useSingleDayBuilderStore(
    (s) => s.ackGuestSpecialRequirements
  );
  const setAdultsM = useBuilderStore((s) => s.setAdults);
  const setChildrenM = useBuilderStore((s) => s.setChildren);
  const setTravelPaceM = useBuilderStore((s) => s.setTravelPace);
  const setGuestSpecialRequirementsM = useBuilderStore(
    (s) => s.setGuestSpecialRequirements
  );
  const ackGuestSpecialRequirementsM = useBuilderStore(
    (s) => s.ackGuestSpecialRequirements
  );

  const setAdults = (n: number) => {
    setAdultsSd(n);
    setAdultsM(n);
  };
  const setChildren = (n: number) => {
    setChildrenSd(n);
    setChildrenM(n);
  };
  const setTravelPace = (id: PaceId) => {
    setTravelPaceSd(id as SingleDayTravelPace);
    setTravelPaceM(id);
  };
  const setGuestSpecialRequirements = (reqs: GuestSpecialRequirements) => {
    setGuestSpecialRequirementsSd(reqs);
    setGuestSpecialRequirementsM(reqs);
  };
  const ackGuestSpecialRequirements = () => {
    ackGuestSpecialRequirementsSd();
    ackGuestSpecialRequirementsM();
  };

  const ensureBrandingLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const getTravelPaces = useSiteBrandingStore((s) => s.getTravelPaces);
  const travelPaces = getTravelPaces();
  void brandingItems;

  const [mounted, setMounted] = useState(false);
  const [paceModal, setPaceModal] = useState<PaceId | null>(null);
  const [doneClicked, setDoneClicked] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * Persist party/pace/reqs to the SAME PNR (confirmed-ref lock) — the
   * steppers above only dual-write the local stores, so without this the
   * next ref-bound hydration restored the old server guests (e.g. 1).
   * Same pattern as the Meeting Point modal. Upsert never demotes a
   * confirmed BAL status, so the default "lead" status is safe.
   */
  const handleDone = async () => {
    if (!guestReqsChoicesOk) {
      setDoneClicked(true);
      return;
    }
    if (!canSucceed || saving) return;
    setSaving(true);
    try {
      const bookingRef =
        useBuilderStore.getState().confirmedBookingRef ||
        useBuilderStore.getState().tempBookingRef ||
        "";
      const email = (
        useItineraryStore.getState().clientEmail ||
        usePreBuilderStore.getState().email ||
        usePreBuilderStore.getState().lastPayload?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      if (bookingRef && email) {
        await syncSingleDayBookingLead({
          bookingRef,
          email,
          state: useSingleDayBuilderStore.getState(),
        });
      }
    } catch {
      /* local stores already updated — persist is enough offline */
    } finally {
      setSaving(false);
      onConfirmed?.();
      onClose();
    }
  };

  const totalGuests = adults + children;
  const guestReqsNotesOk = guestSpecialRequirementsNotesValid(
    guestSpecialRequirements
  );
  const guestReqsChoicesOk = guestSpecialRequirementsChoicesComplete(
    guestSpecialRequirements
  );
  const canSucceed =
    travelPace !== null &&
    totalGuests > 0 &&
    guestReqsChoicesOk &&
    guestSpecialRequirementsAcked &&
    guestReqsNotesOk;

  const dietaryPending = guestSpecialRequirements.hasDietary == null;
  const mobilityPending = guestSpecialRequirements.hasMobility == null;
  const showReqsHint = doneClicked && !guestReqsChoicesOk;
  const reqsHintMessage =
    dietaryPending && mobilityPending
      ? "Please confirm Dietary & Mobility options!"
      : dietaryPending
        ? "Please select Dietary option!"
        : "Please select Mobility option!";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setDoneClicked(false);
      return;
    }
    void ensureBrandingLoaded();
  }, [open, ensureBrandingLoaded]);

  useEffect(() => {
    if (guestReqsChoicesOk) setDoneClicked(false);
  }, [guestReqsChoicesOk]);

  return (
    <>
      <BuilderEditModalShell
        open={open}
        onClose={onClose}
        title="Party & Pace"
        mounted={mounted}
        variant="fullPage"
        footer={
          <button
            type="button"
            onClick={() => void handleDone()}
            disabled={
              saving ||
              (guestReqsChoicesOk &&
                !(
                  travelPace !== null &&
                  totalGuests > 0 &&
                  guestReqsNotesOk
                ))
            }
            aria-disabled={!canSucceed}
            className={`w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40 ${
              !canSucceed && guestReqsChoicesOk ? "opacity-40" : ""
            } ${!guestReqsChoicesOk ? "opacity-40" : ""}`}
          >
            {saving ? "Saving…" : "Done →"}
          </button>
        }
      >
        <div className="flex flex-col gap-10">
          <section>
            <FieldLabel>Travel pace</FieldLabel>
            <p className="mb-3 text-xs text-zinc-500">
              Tap a style to learn more, then confirm your preferred rhythm.
            </p>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {travelPaces.map((pace) => {
                const isSelected = travelPace === pace.id;
                const hasSelection = travelPace !== null;
                const cardClass = isSelected
                  ? "border-2 border-[#0080A3] opacity-100 scale-100 z-10"
                  : hasSelection
                    ? "border border-transparent opacity-40 grayscale-[50%] scale-95"
                    : "border border-transparent opacity-100 hover:border-white/20 scale-100";
                return (
                  <button
                    key={pace.id}
                    type="button"
                    onClick={() => setPaceModal(pace.id)}
                    aria-pressed={isSelected}
                    className={`group relative overflow-hidden rounded-2xl bg-[#0D141C] text-left transition-all duration-300 ease-in-out ${cardClass}`}
                  >
                    <span className="relative block aspect-[3/4] w-full bg-zinc-900">
                      {pace.isVideo && pace.mediaUrl ? (
                        <LazyVideo
                          src={pace.mediaUrl}
                          poster={pace.posterUrl || undefined}
                          muted
                          loop
                          playsInline
                          autoPlay
                          className="h-full w-full object-cover"
                        />
                      ) : pace.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pace.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <span
                        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                        aria-hidden
                      />
                      {isSelected ? (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#D9718C] text-white">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      ) : null}
                      <span className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                        <span className="block font-display text-base text-white sm:text-lg">
                          {pace.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-zinc-300 sm:text-[11px]">
                          {pace.tagline}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FieldLabel>Guests</FieldLabel>
            <div className="mt-2 space-y-2">
              <GuestStepper
                label="Adults"
                value={adults}
                onChange={setAdults}
                min={1}
                kind="adults"
              />
              <GuestStepper
                label="Children"
                value={children}
                onChange={setChildren}
                min={0}
                kind="kids"
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-400">
              Used for vehicles and private-driver sizing.
            </p>
          </section>

          <section className="relative space-y-2">
            <FieldLabel>Dietary &amp; mobility</FieldLabel>
            {/* No mascot here: the fox rendered unconditionally with
                no error/message to present. The Done-validation hint
                is kept as plain text below the selector instead. */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D141C]">
              <GuestRequirementsSelector
                value={guestSpecialRequirements}
                onChange={setGuestSpecialRequirements}
                onAck={ackGuestSpecialRequirements}
                flat
              />
              {showReqsHint ? (
                <p
                  role="alert"
                  className="bg-[#0D141C] px-4 pb-4 font-mono text-[11px] font-bold text-amber-300"
                >
                  {reqsHintMessage}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </BuilderEditModalShell>

      <PaceDetailModal
        paceId={paceModal}
        selected={travelPace}
        onClose={() => setPaceModal(null)}
        onSelect={(id) => {
          setTravelPace(id);
          setPaceModal(null);
        }}
      />
    </>
  );
}

function GuestStepper({
  label,
  value,
  onChange,
  min,
  kind,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  kind: "adults" | "kids";
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-[#0D141C] px-4 py-3.5">
      <span className="w-16 shrink-0 text-sm font-medium text-white">{label}</span>
      <GuestCountStrip kind={kind} count={value} />
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-white transition hover:bg-zinc-950"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-semibold text-white">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-white transition hover:bg-zinc-950"
        >
          +
        </button>
      </div>
    </div>
  );
}
