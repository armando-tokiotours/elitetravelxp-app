"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  tourPrice,
  type PbTour,
} from "@/lib/pocketbase/client";
import {
  canAddTourOnDate,
  getAvailableHours,
  TOUR_DAY_PACKED_MESSAGE,
  tourDurationHours,
} from "@/lib/tourValidator";
import {
  countsTowardGuideHours,
  formatDurationBadge,
  isGuideBudgetCatalogItem,
  selectedGuideHoursTotal,
  type CatalogItem,
} from "@/lib/experiencesPlaces";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import { languageToCode, tourLanguageChoices } from "@/lib/tourLanguages";
import { TourDetailModal } from "@/components/builder/TourDetailModal";
import { ScheduleTourDaySheet } from "@/components/builder/ScheduleTourDaySheet";
import {
  ReplaceGuidedTourModal,
  type ReplaceGuidedTourSide,
} from "@/components/builder/modals/ReplaceGuidedTourModal";
import {
  CLOSE_DISCOVER_EVENT,
  DISCOVER_OVERLAY_STATE_EVENT,
  type DiscoverOverlayStateDetail,
} from "@/components/navigation/AppNavDock";
import { useBuilderStore } from "@/store/useBuilderStore";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
  type SingleDaySelectedExperience,
} from "@/store/useSingleDayBuilderStore";

type PendingGuidedReplace = {
  tour: PbTour;
  language: string;
  hours: number;
  current: SingleDaySelectedExperience;
};

export type DiscoverSelectPayload = {
  tour: PbTour;
  language: string;
  /** Wall-clock hours for the selected variant */
  durationHours: number;
};

/** Prefer Builder language, then tour catalog, then EN — so + can add without a sheet. */
function resolveAddLanguage(
  tour: PbTour,
  selectedLanguage: string,
  preferredTourLanguage: string
): string {
  const explicit = selectedLanguage.trim();
  if (explicit) return explicit;
  const choices = tourLanguageChoices(tour.languages);
  const preferred =
    languageToCode(preferredTourLanguage || "EN") || "EN";
  if (choices.some((c) => c.code === preferred)) return preferred;
  if (choices.length === 1) return choices[0].code;
  const en = choices.find((c) => c.code === "EN");
  if (en) return en.code;
  return choices[0]?.code || preferred || "EN";
}

/**
 * Full-screen Discover Reels overlay for Builder pick-experience CTAs.
 * Reuses TourDetailModal + DiscoverReelChrome (no third feed).
 */
export function DiscoverOverlay({
  open,
  onClose,
  tours,
  cityName = "",
  cityId = null,
  guests,
  onSelectExperience,
  closeOnAdd = true,
  backLabel = "Back to Builder",
  itineraryMode,
  defaultLanguage,
}: {
  open: boolean;
  onClose: () => void;
  tours: PbTour[];
  cityName?: string;
  /** Multi-day city id for scheduling chauffeur days */
  cityId?: string | null;
  guests: { adults: number; children: number };
  /**
   * Optional Builder callback. When omitted, adds into the active
   * itinerary store (single-day or multi-day) automatically.
   */
  onSelectExperience?: (payload: DiscoverSelectPayload) => void | boolean;
  /** Close overlay after a successful add (not remove). Default true. */
  closeOnAdd?: boolean;
  backLabel?: string;
  /**
   * Force single/multi write path. Builder S must pass `"single_day"` so
   * adds never depend on multi-day arrivalDate / tripMode drift.
   */
  itineraryMode?: "single_day" | "multi_day";
  /** Preferred language code (e.g. EN) for instant + add */
  defaultLanguage?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [pickingTour, setPickingTour] = useState<PbTour | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState("");
  const [pendingReplace, setPendingReplace] =
    useState<PendingGuidedReplace | null>(null);
  /** Bumps on close so TourDetailModal remounts fresh on next open. */
  const [sessionKey, setSessionKey] = useState(0);

  const tripMode = useBuilderStore((s) => s.tripMode);
  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const addCityTour = useBuilderStore((s) => s.addCityTour);
  const removeCityTour = useBuilderStore((s) => s.removeCityTour);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);

  const sdTourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const sdExperiences = useSingleDayBuilderStore((s) => s.selectedExperiences);
  const sdPreferredLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const addExperience = useSingleDayBuilderStore((s) => s.addExperience);
  const removeExperience = useSingleDayBuilderStore((s) => s.removeExperience);

  const preferredLang =
    defaultLanguage?.trim() ||
    languageToCode(sdPreferredLanguage || "EN") ||
    "EN";

  // Explicit prop wins; otherwise tripMode. Never let Builder S fall through
  // to multi-day gates when a single-day callback is wired.
  const isSingle =
    itineraryMode === "single_day" ||
    (itineraryMode !== "multi_day" &&
      (tripMode === "single_day" || Boolean(onSelectExperience)));
  const resolvedCityId =
    cityId ||
    tours.find((t) => t.city_id)?.city_id ||
    locations[0]?.cityId ||
    null;

  const selectedTours = resolvedCityId
    ? selectedToursMap[resolvedCityId] ?? []
    : [];

  const bookedTourIds = isSingle
    ? sdExperiences.map((e) => e.tourId)
    : selectedTours.map((t) => t.tourId);

  const dayOptions = useMemo(() => {
    if (!resolvedCityId) return [];
    if (isSingle) {
      if (!sdTourDate) return [];
      return [
        {
          date: sdTourDate,
          tripDay: 1,
          label: `Tour day · ${formatSingleDayDisplayDate(sdTourDate)}`,
        },
      ];
    }
    return chauffeurDaysForCity(arrivalDate, locations, resolvedCityId);
  }, [arrivalDate, isSingle, locations, resolvedCityId, sdTourDate]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Keep AppNavDock in sync (Discover active + z-[1000] above reels).
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<DiscoverOverlayStateDetail>(DISCOVER_OVERLAY_STATE_EVENT, {
        detail: { open },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent<DiscoverOverlayStateDetail>(
          DISCOVER_OVERLAY_STATE_EVENT,
          { detail: { open: false } }
        )
      );
    };
  }, [open]);

  // Dock Builder / 1-Day Pass → same as “Back to Builder”.
  useEffect(() => {
    if (!open) return;
    const onCloseFromDock = () => onClose();
    window.addEventListener(CLOSE_DISCOVER_EVENT, onCloseFromDock);
    return () =>
      window.removeEventListener(CLOSE_DISCOVER_EVENT, onCloseFromDock);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setPickingTour(null);
    setPendingLanguage("");
    setPendingReplace(null);
    setToast(null);
    setSessionKey((k) => k + 1);
  }, [open]);

  const commitSingleAdd = useCallback(
    (
      tour: PbTour,
      language: string,
      hours: number,
      opts?: { replaceGuided?: boolean }
    ): boolean => {
      const countsTowardGuide = isGuideBudgetCatalogItem(tour as CatalogItem);
      // Guided Tours are mutually exclusive — drop the previous guide stop(s).
      if (opts?.replaceGuided || countsTowardGuide) {
        for (const row of useSingleDayBuilderStore.getState()
          .selectedExperiences) {
          if (countsTowardGuideHours(row) && row.tourId !== tour.id) {
            removeExperience(row.tourId);
          }
        }
      }
      if (onSelectExperience) {
        const ok = onSelectExperience({
          tour,
          language,
          durationHours: hours,
        });
        if (ok === false) return false;
        setToast(
          opts?.replaceGuided
            ? `Replaced · ${tour.title}`
            : `Added · ${tour.title}`
        );
        return true;
      }
      addExperience({
        tourId: tour.id,
        title: tour.title,
        selectedLanguage: language,
        duration_hours: hours,
        price: tourPrice(tour, guests),
        access_type: String(tour.access_type || "").trim() || undefined,
        category: String(tour.category || "").trim() || undefined,
        entry_type: String(tour.entry_type || "").trim() || undefined,
        is_extra: !countsTowardGuide,
      });
      setToast(
        opts?.replaceGuided
          ? `Replaced · ${tour.title}`
          : `Added · ${tour.title}`
      );
      return true;
    },
    [addExperience, guests, onSelectExperience, removeExperience]
  );

  const tryAddSingle = useCallback(
    (tour: PbTour, selectedLanguage: string): boolean => {
      const language = resolveAddLanguage(
        tour,
        selectedLanguage,
        preferredLang
      );
      if (!language) {
        setToast("Select a preferred language before adding this experience.");
        return false;
      }
      if (!sdTourDate) {
        setToast("Set your tour date in Builder before adding experiences.");
        return false;
      }
      if (sdExperiences.some((e) => e.tourId === tour.id)) {
        removeExperience(tour.id);
        setToast("Removed from itinerary");
        return false;
      }
      const hours = tourDurationHours(tour);
      const countsTowardGuide = isGuideBudgetCatalogItem(tour as CatalogItem);
      const existingGuided = sdExperiences.find(
        (e) => countsTowardGuideHours(e) && e.tourId !== tour.id
      );

      // Different guided tour already selected → confirm before replace.
      if (countsTowardGuide && existingGuided) {
        setPendingReplace({
          tour,
          language,
          hours,
          current: existingGuided,
        });
        return false;
      }

      const cap = useSingleDayBuilderStore.getState().tourHours;
      const usedGuide = selectedGuideHoursTotal(sdExperiences);
      if (countsTowardGuide && usedGuide + hours > cap + 0.01) {
        setToast(TOUR_DAY_PACKED_MESSAGE);
        return false;
      }
      return commitSingleAdd(tour, language, hours);
    },
    [
      commitSingleAdd,
      preferredLang,
      removeExperience,
      sdExperiences,
      sdTourDate,
    ]
  );

  const replaceConfirmSides = useMemo((): {
    current: ReplaceGuidedTourSide;
    next: ReplaceGuidedTourSide;
  } | null => {
    if (!pendingReplace) return null;
    const { tour, language, hours, current } = pendingReplace;
    return {
      current: {
        title: current.title || "Current tour",
        durationLabel: formatDurationBadge(Number(current.duration_hours) || 0),
        languageLabel: String(current.selectedLanguage || "").trim(),
      },
      next: {
        title: tour.title || "New tour",
        durationLabel: formatDurationBadge(hours),
        languageLabel: language,
      },
    };
  }, [pendingReplace]);

  const tryAddMulti = useCallback(
    (
      tour: PbTour,
      scheduledDate: string,
      selectedLanguage: string
    ): boolean => {
      if (!resolvedCityId) {
        setToast("Add a city to your trip before scheduling experiences.");
        return false;
      }
      if (!selectedLanguage.trim()) {
        setToast("Select a preferred language before adding this experience.");
        return false;
      }
      if (isEliteConcierge) {
        setToast(
          "Elite Concierge is on. Individual tours are managed by your concierge."
        );
        return false;
      }
      const check = canAddTourOnDate({
        selectedRows: selectedTours,
        scheduledDate,
        newTourDurationHours: tourDurationHours(tour),
        tourId: tour.id,
      });
      if (!check.ok) {
        setToast(check.message ?? TOUR_DAY_PACKED_MESSAGE);
        return false;
      }
      if (onSelectExperience) {
        const ok = onSelectExperience({
          tour,
          language: selectedLanguage.trim(),
          durationHours: tourDurationHours(tour),
        });
        if (ok === false) return false;
        return true;
      }
      const ok = addCityTour(resolvedCityId, {
        tourId: tour.id,
        title: tour.title,
        duration_hours: tourDurationHours(tour),
        scheduledDate,
        selectedLanguage: selectedLanguage.trim(),
        price: tourPrice(tour, guests),
        access_type: String(tour.access_type || "").trim() || undefined,
        ...(tour.languages?.length ? { languages: tour.languages } : {}),
      });
      if (!ok) {
        setToast(TOUR_DAY_PACKED_MESSAGE);
        return false;
      }
      setToast(`Added · ${tour.title}`);
      return true;
    },
    [
      addCityTour,
      guests,
      isEliteConcierge,
      onSelectExperience,
      resolvedCityId,
      selectedTours,
    ]
  );

  const handleAdd = useCallback(
    (tour: PbTour, selectedLanguage: string) => {
      if (isSingle) {
        const booked = sdExperiences.some((e) => e.tourId === tour.id);
        if (booked) {
          removeExperience(tour.id);
          setToast("Removed from itinerary");
          return;
        }
        const added = tryAddSingle(tour, selectedLanguage);
        if (added && closeOnAdd) onClose();
        return;
      }

      const booked = selectedTours.find((t) => t.tourId === tour.id);
      if (booked) {
        if (resolvedCityId) removeCityTour(resolvedCityId, tour.id);
        setToast("Removed from itinerary");
        return;
      }
      const language = resolveAddLanguage(
        tour,
        selectedLanguage,
        preferredLang
      );
      if (!language) {
        setToast("Select a preferred language before adding this experience.");
        return;
      }
      if (!arrivalDate || dayOptions.length === 0) {
        setToast(
          "Add this city and set arrival dates in the Builder before scheduling."
        );
        return;
      }
      if (dayOptions.length === 1) {
        const day = dayOptions[0];
        const hours = tourDurationHours(tour);
        const available = getAvailableHours(selectedTours, day.date);
        if (hours > available) {
          setToast(TOUR_DAY_PACKED_MESSAGE);
          return;
        }
        const added = tryAddMulti(tour, day.date, language);
        if (added && closeOnAdd) onClose();
        return;
      }
      setPendingLanguage(language);
      setPickingTour(tour);
    },
    [
      arrivalDate,
      closeOnAdd,
      dayOptions,
      isSingle,
      onClose,
      preferredLang,
      removeCityTour,
      removeExperience,
      resolvedCityId,
      sdExperiences,
      selectedTours,
      tryAddMulti,
      tryAddSingle,
    ]
  );

  if (!open) return null;

  return (
    <>
      {toast ? (
        <div
          role="status"
          className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[1000] max-w-[90vw] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#FAF0E6] px-3.5 py-2.5 text-center text-sm text-[#632502] shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      <TourDetailModal
        key={sessionKey}
        open={open && tours.length > 0}
        tours={tours}
        guests={guests}
        cityName={cityName}
        hidePrice
        backLabel={backLabel}
        zIndexClass="z-[999]"
        defaultLanguage={preferredLang}
        quickAdd
        isTourSelected={(id) => bookedTourIds.includes(id)}
        scheduledLabelFor={(id) => {
          if (isSingle) {
            if (!sdExperiences.some((e) => e.tourId === id) || !sdTourDate) {
              return null;
            }
            return `Tour day · ${formatSingleDayDisplayDate(sdTourDate)}`;
          }
          const row = selectedTours.find((t) => t.tourId === id);
          if (!row?.scheduledDate) return null;
          return (
            dayOptions.find((d) => d.date === row.scheduledDate)?.label ??
            row.scheduledDate
          );
        }}
        bookedLanguageFor={(id) => {
          if (isSingle) {
            return (
              sdExperiences.find((e) => e.tourId === id)?.selectedLanguage ||
              null
            );
          }
          return (
            selectedTours.find((t) => t.tourId === id)?.selectedLanguage || null
          );
        }}
        onClose={onClose}
        onAdd={handleAdd}
      />

      {!isSingle ? (
        <ScheduleTourDaySheet
          open={!!pickingTour && !!pendingLanguage}
          tour={pickingTour}
          cityName={cityName}
          dayOptions={dayOptions}
          selectedTours={selectedTours}
          zIndexClass="z-[1100]"
          onClose={() => {
            setPickingTour(null);
            setPendingLanguage("");
          }}
          onSelectDay={(date) => {
            if (!pickingTour) return { ok: false };
            const added = tryAddMulti(pickingTour, date, pendingLanguage);
            if (added && closeOnAdd) {
              setPickingTour(null);
              setPendingLanguage("");
              onClose();
            }
            return { ok: added };
          }}
          onToast={setToast}
        />
      ) : null}

      {replaceConfirmSides && pendingReplace ? (
        <ReplaceGuidedTourModal
          open
          current={replaceConfirmSides.current}
          next={replaceConfirmSides.next}
          onConfirm={() => {
            const { tour, language, hours } = pendingReplace;
            setPendingReplace(null);
            const ok = commitSingleAdd(tour, language, hours, {
              replaceGuided: true,
            });
            if (ok && closeOnAdd) onClose();
          }}
          onCancel={() => {
            setPendingReplace(null);
            onClose();
          }}
        />
      ) : null}

      {open && tours.length === 0 ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 px-6 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0D1117] p-6 text-center">
            <p className="font-godiva text-lg uppercase tracking-wide text-white">
              No experiences yet
            </p>
            <p className="mt-2 text-sm text-white/60">
              {cityName
                ? `Nothing published for ${cityName} yet.`
                : "Pick a city in Builder first, then discover experiences."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-2xl bg-[#075473] py-3 text-sm font-bold text-white"
            >
              Back to Builder
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
