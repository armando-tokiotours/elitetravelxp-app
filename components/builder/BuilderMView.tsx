"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BuilderConfig,
  PbAccommodation,
} from "@/lib/pocketbase/client";
import { cityPhoto, fetchAccommodations, pbFileUrl, tourPhoto } from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import { countBillableChauffeurDays } from "@/lib/chauffeurSelections";
import { calculateCityDateRanges } from "@/lib/dateCascade";
import { buildCityMap, getCityName } from "@/lib/cityLabels";
import { validateCityRoute } from "@/lib/routeValidator";
import { matchSeasonalHighlights } from "@/lib/seasonalMatcher";
import { resolveSeasonInsight } from "@/lib/seasonality";
import { travelPaceLabel } from "@/lib/travelPace";
import {
  BUILDER_ALL_STEPS_COMPLETE,
  canOpenBuilderStep,
  isBuilderStepComplete,
  type BuilderStepSnapshot,
} from "@/lib/builderSteps";
import { overnightNightsTotal, isTransitHubStop } from "@/lib/transitHubs";
import {
  calculateRoomRequirements,
  getHotelAllocationStatus,
} from "@/lib/hotelCalculator";
import {
  coerceTransitType,
  formatDisplayDate,
  normalizeCityHotelPref,
  useBuilderStore,
  type HubTravelMode,
  type LocationStop,
} from "@/store/useBuilderStore";
import {
  BuilderEditModalProvider,
  type BuilderEditModalId,
} from "./BuilderEditModalContext";
import { BuilderMWidgetGrid } from "./BuilderMWidgetGrid";
import {
  hotelArrangeImageUrls,
  transportArrangeImageUrls,
  type HotelArrangeKind,
  type TransportArrangeKind,
} from "./DynamicWidgetBackground";
import { ProgressBar } from "./ProgressBar";
import { useLazyModalMount } from "./modals/useLazyModalMount";
import { getSystemMessage } from "@/lib/systemMessages";
import { showSystemMessage } from "@/store/useSystemMessageStore";

const DaysDateEditorModal = dynamic(
  () =>
    import("./modals/DaysDateEditorModal").then((m) => ({
      default: m.DaysDateEditorModal,
    })),
  { ssr: false }
);
const DurationEditorModal = dynamic(
  () =>
    import("./modals/DurationEditorModal").then((m) => ({
      default: m.DurationEditorModal,
    })),
  { ssr: false }
);
const HubConfigModal = dynamic(
  () =>
    import("./modals/HubConfigModal").then((m) => ({
      default: m.HubConfigModal,
    })),
  { ssr: false }
);
const LocationsEditorModal = dynamic(
  () =>
    import("./modals/LocationsEditorModal").then((m) => ({
      default: m.LocationsEditorModal,
    })),
  { ssr: false }
);
const HotelsEditorModal = dynamic(
  () =>
    import("./modals/HotelsEditorModal").then((m) => ({
      default: m.HotelsEditorModal,
    })),
  { ssr: false }
);
const TailoredExperiencesModal = dynamic(
  () =>
    import("./modals/TailoredExperiencesModal").then((m) => ({
      default: m.TailoredExperiencesModal,
    })),
  { ssr: false }
);
const ConciergeEditorModal = dynamic(
  () =>
    import("./modals/ConciergeEditorModal").then((m) => ({
      default: m.ConciergeEditorModal,
    })),
  { ssr: false }
);
const DriversEditorModal = dynamic(
  () =>
    import("./modals/DriversEditorModal").then((m) => ({
      default: m.DriversEditorModal,
    })),
  { ssr: false }
);

function hubTypeForMode(mode: HubTravelMode) {
  return mode === "cruise" ? ("Cruise Terminal" as const) : ("Airport" as const);
}

function hubShort(hubs: BuilderConfig["hubs"], id: string | null) {
  const name = hubs.find((h) => h.id === id)?.name;
  if (!name) return null;
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;
}

function modalToStep(
  id: Exclude<BuilderEditModalId, null>
): number | null {
  switch (id) {
    case "duration":
    case "guests":
      return 1;
    case "transit":
      return 2;
    case "locations":
      return 3;
    case "hotels_transport":
      return 4;
    case "drivers":
      // Unlock with Tours after hotels — Transport cards before/alongside tours
      return 5;
    case "tours":
      return 5;
    default:
      return null;
  }
}

/**
 * Builder M — iOS widget grid (no accordion sections).
 * Widgets open editor modals via `activeEditModal`.
 */
export function BuilderMView({
  config,
  onAccommodationsLoaded,
}: {
  config: BuilderConfig;
  onAccommodationsLoaded?: (rows: PbAccommodation[]) => void;
}) {
  const [activeEditModal, setActiveEditModal] =
    useState<BuilderEditModalId>(null);

  const durationMounted = useLazyModalMount(activeEditModal === "duration");
  const guestsMounted = useLazyModalMount(activeEditModal === "guests");
  const transitMounted = useLazyModalMount(activeEditModal === "transit");
  const locationsMounted = useLazyModalMount(activeEditModal === "locations");
  const hotelsMounted = useLazyModalMount(
    activeEditModal === "hotels_transport"
  );
  const toursMounted = useLazyModalMount(activeEditModal === "tours");
  const driversMounted = useLazyModalMount(activeEditModal === "drivers");

  const durationDays = useBuilderStore((s) => s.durationDays);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const travelPace = useBuilderStore((s) => s.travelPace);
  const arrivalTransferId = useBuilderStore((s) => s.arrivalTransferId);
  const departureTransferId = useBuilderStore((s) => s.departureTransferId);
  const arrivalMode = useBuilderStore((s) => s.arrivalMode);
  const departureMode = useBuilderStore((s) => s.departureMode);
  const airportPickup = useBuilderStore((s) => s.airportPickup);
  const airportDropoff = useBuilderStore((s) => s.airportDropoff);
  const locations = useBuilderStore((s) => s.locations);
  const cityHotels = useBuilderStore((s) => s.cityHotels);
  const hotelTier = useBuilderStore((s) => s.hotelTier);
  void hotelTier;
  const transitModeId = useBuilderStore((s) => s.transitModeId);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const selectedTourIds = useBuilderStore((s) => s.selectedTourIds);
  const chauffeurSelections = useBuilderStore((s) => s.chauffeurSelections);
  const needDriver = useBuilderStore((s) => s.needDriver);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const activeSeasonTier = useBuilderStore((s) => s.activeSeasonTier);
  const highestUnlockedStep = useBuilderStore((s) => s.highestUnlockedStep);

  const setArrivalTransferId = useBuilderStore((s) => s.setArrivalTransferId);
  const setDepartureTransferId = useBuilderStore(
    (s) => s.setDepartureTransferId
  );
  const setArrivalMode = useBuilderStore((s) => s.setArrivalMode);
  const setDepartureMode = useBuilderStore((s) => s.setDepartureMode);
  const setAirportPickup = useBuilderStore((s) => s.setAirportPickup);
  const setAirportDropoff = useBuilderStore((s) => s.setAirportDropoff);
  const setActiveSeason = useBuilderStore((s) => s.setActiveSeason);
  const addLocation = useBuilderStore((s) => s.addLocation);
  const removeLocation = useBuilderStore((s) => s.removeLocation);
  const setLocationNights = useBuilderStore((s) => s.setLocationNights);
  const setLocationVisitType = useBuilderStore((s) => s.setLocationVisitType);
  const reorderLocations = useBuilderStore((s) => s.reorderLocations);
  const toggleTour = useBuilderStore((s) => s.toggleTour);
  const syncRouteTransitHubs = useBuilderStore((s) => s.syncRouteTransitHubs);
  const setCityHotel = useBuilderStore((s) => s.setCityHotel);
  const ensureCityHotels = useBuilderStore((s) => s.ensureCityHotels);
  const unlockBuilderStep = useBuilderStore((s) => s.unlockBuilderStep);
  const setExperienceService = useBuilderStore((s) => s.setExperienceService);

  const [accommodations, setAccommodations] = useState<PbAccommodation[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [routeToast, setRouteToast] = useState<string | null>(null);

  const hubs = config.hubs;
  const cities = config.cities;
  const cityNames = useMemo(() => {
    const map = buildCityMap(cities);
    const out: Record<string, string> = {};
    for (const c of cities) out[c.id] = getCityName(c.id, map);
    return out;
  }, [cities]);

  useEffect(() => {
    const insight = resolveSeasonInsight(config.seasonTiers, arrivalDate);
    if (!insight) {
      setActiveSeason(null, null);
      return;
    }
    setActiveSeason(insight.tier, {
      crowds: insight.crowd_level,
      note: insight.concierge_note,
    });
  }, [arrivalDate, config.seasonTiers, setActiveSeason]);

  useEffect(() => {
    if (!hubs.length) return;
    syncRouteTransitHubs(hubs, cities);
  }, [
    hubs,
    cities,
    arrivalTransferId,
    departureTransferId,
    syncRouteTransitHubs,
  ]);

  useEffect(() => {
    if (highestUnlockedStep < 4) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchAccommodations();
        if (cancelled) return;
        setAccommodations(rows);
        onAccommodationsLoaded?.(rows);
      } catch {
        if (!cancelled) setAccommodations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [highestUnlockedStep, onAccommodationsLoaded]);

  useEffect(() => {
    if (!routeToast) return;
    const t = window.setTimeout(() => setRouteToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [routeToast]);

  const snapshot = useMemo<BuilderStepSnapshot>(
    () => ({
      arrivalDate,
      durationDays,
      adults,
      children,
      arrivalTransferId,
      departureTransferId,
      locations,
      cityHotels,
    }),
    [
      arrivalDate,
      durationDays,
      adults,
      children,
      arrivalTransferId,
      departureTransferId,
      locations,
      cityHotels,
    ]
  );

  const openEditModal = useCallback(
    (id: Exclude<BuilderEditModalId, null>) => {
      const step = modalToStep(id);
      if (step != null && !canOpenBuilderStep(step, highestUnlockedStep)) {
        showSystemMessage({
          text: getSystemMessage("builder_lock"),
          tone: "error",
        });
        return;
      }
      if (id === "tours") {
        const svc = useBuilderStore.getState().experienceService;
        if (!svc && !useBuilderStore.getState().isEliteConcierge) {
          setExperienceService("tailored");
        }
      }
      if (id === "hotels_transport") {
        ensureCityHotels(
          locations
            .filter((l) => !isTransitHubStop(l) && (l.nights || 0) > 0)
            .map((l) => l.cityId)
        );
      }
      setActiveEditModal(id);
    },
    [ensureCityHotels, highestUnlockedStep, locations, setExperienceService]
  );

  const closeAndAdvance = useCallback(
    (closed: Exclude<BuilderEditModalId, null>) => {
      setActiveEditModal(null);
      const step = modalToStep(closed);
      if (step == null) return;
      const state = useBuilderStore.getState();
      if (isBuilderStepComplete(step, state)) {
        // Transport Done must unlock past step 6 → complete (7), otherwise
        // itinerary fox keeps saying "Still need: Transport".
        if (closed === "drivers") {
          unlockBuilderStep(BUILDER_ALL_STEPS_COMPLETE);
        } else {
          unlockBuilderStep(step + 1);
        }
      }
      // Stay on the widget grid — pulsar rings the next card; user taps to open.
    },
    [unlockBuilderStep]
  );

  const locked = useMemo(() => {
    const L: Partial<Record<Exclude<BuilderEditModalId, null>, boolean>> = {};
    for (const id of [
      "duration",
      "guests",
      "transit",
      "locations",
      "hotels_transport",
      "tours",
      "drivers",
    ] as const) {
      const step = modalToStep(id);
      if (step != null && !canOpenBuilderStep(step, highestUnlockedStep)) {
        L[id] = true;
      }
    }
    return L;
  }, [highestUnlockedStep]);

  // —— Summary strings ——
  const startDateText = arrivalDate ? formatDisplayDate(arrivalDate) : null;
  const guestCount = adults + children;
  const paceLabel = travelPaceLabel(travelPace);
  const arrivalAirport = hubShort(hubs, arrivalTransferId);
  const departureAirport = hubShort(hubs, departureTransferId);

  const cityMap = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.id, c])),
    [cities]
  );
  const cityLabelMap = useMemo(() => buildCityMap(cities), [cities]);
  const hubById = useMemo(
    () => Object.fromEntries(hubs.map((h) => [h.id, h])),
    [hubs]
  );

  const stopLabel = (l: LocationStop) => {
    if (l.hubId && hubById[l.hubId]) {
      return hubById[l.hubId].name.replace(/\s*\([^)]*\)\s*$/, "").trim();
    }
    return getCityName(l.cityId, cityLabelMap);
  };

  const citiesList = useMemo(() => {
    const stays = locations.filter(
      (l) => !isTransitHubStop(l) && (l.nights || 0) > 0
    );
    if (stays.length === 0) return null;
    return stays.map((l) => `${stopLabel(l)} (${l.nights}N)`).join(" · ");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stopLabel stable via maps
  }, [locations, hubById, cityLabelMap]);
  void citiesList;

  const cityBands = useMemo(() => {
    return locations
      .filter((l) => !isTransitHubStop(l) && (l.nights || 0) > 0)
      .map((l) => {
        const city = cityMap[l.cityId];
        const filename = city ? cityPhoto(city) : "";
        const photoUrl =
          filename && city?.collectionId
            ? pbFileUrl(city.collectionId, city.id, filename, {
                thumb: PB_THUMBS.card,
                format: "webp",
              })
            : null;
        return {
          key: l.key,
          name: stopLabel(l),
          nights: l.nights,
          photoUrl,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, cityMap, hubById, cityLabelMap]);

  const hotelArrangeLabel = useMemo(() => {
    const stayIds = [
      ...new Set(
        locations
          .filter((l) => !isTransitHubStop(l) && (l.nights || 0) > 0)
          .map((l) => l.cityId)
      ),
    ];
    if (stayIds.length === 0) return "Add cities first";
    let arranged = 0;
    let self = 0;
    for (const id of stayIds) {
      const pref = cityHotels[id];
      if (pref?.needsHotel) arranged += 1;
      else self += 1;
    }
    if (arranged === 0) return "Self-arranged";
    if (self === 0) return "All-arranged";
    return "Mix-arranged";
  }, [cityHotels, locations]);

  const hotelBgImages = useMemo(() => {
    const stayIds = [
      ...new Set(
        locations
          .filter((l) => !isTransitHubStop(l) && (l.nights || 0) > 0)
          .map((l) => l.cityId)
      ),
    ];
    const kinds = new Set<HotelArrangeKind>();
    for (const id of stayIds) {
      const pref = cityHotels[id];
      if (pref == null) continue;
      kinds.add(pref.needsHotel ? "tokiotours" : "self");
    }
    return hotelArrangeImageUrls(kinds);
  }, [cityHotels, locations]);

  const hotelCityChecks = useMemo(() => {
    return locations
      .filter((l) => !isTransitHubStop(l) && (l.nights || 0) > 0)
      .map((l) => {
        const pref = cityHotels[l.cityId];
        const done = pref?.needsHotel
          ? Boolean(pref.starRating)
          : pref != null && pref.needsHotel === false;
        return {
          name: cityLabelMap[l.cityId] || l.cityId,
          done,
        };
      });
  }, [cityHotels, cityLabelMap, locations]);

  /** Stay cities in route order (unique), matching DriversEditorModal stop list. */
  const stayTransportStops = useMemo(() => {
    const stayLocs = locations.filter(
      (l) => !isTransitHubStop(l) && (l.nights || 0) > 0
    );
    const unique: typeof stayLocs = [];
    const seen = new Set<string>();
    for (const loc of stayLocs) {
      if (seen.has(loc.cityId)) continue;
      seen.add(loc.cityId);
      unique.push(loc);
    }
    return unique.map((loc, i) => ({
      loc,
      hasNext: Boolean(unique[i + 1]),
      transitType: coerceTransitType(loc.transitType),
      localTransitType: coerceTransitType(loc.localTransitType),
    }));
  }, [locations]);

  const transportArrangeLabel = useMemo(() => {
    if (stayTransportStops.length === 0) return "Add cities first";
    // Required picks: in-city for every stay + inter-city only when a next stay exists
    const modes = stayTransportStops.flatMap((s) => {
      const list = [s.localTransitType];
      if (s.hasNext) list.push(s.transitType);
      return list;
    });
    const unset = modes.filter((m) => m === "unset").length;
    if (unset === modes.length) return "Set Self / Public / Pick-up";
    const self = modes.filter((m) => m === "self").length;
    const pub = modes.filter((m) => m === "public").length;
    const priv = modes.filter((m) => m === "private").length;
    if (needDriver || countBillableChauffeurDays(chauffeurSelections) > 0) {
      return "Private drivers";
    }
    if (priv === modes.length) return "Private pick-up";
    if (pub === modes.length) return "Public tickets";
    if (self === modes.length) return "Self / walk";
    if (unset > 0) return "Mix — set remaining";
    return "Mix-arranged";
  }, [chauffeurSelections, needDriver, stayTransportStops]);

  const transportBgImages = useMemo(() => {
    const kinds = new Set<TransportArrangeKind>();
    for (const stop of stayTransportStops) {
      for (const mode of [
        stop.localTransitType,
        ...(stop.hasNext ? [stop.transitType] : []),
      ]) {
        if (mode === "self" || mode === "public" || mode === "private") {
          kinds.add(mode);
        }
      }
    }
    if (
      needDriver ||
      countBillableChauffeurDays(chauffeurSelections) > 0
    ) {
      kinds.add("private");
    }
    return transportArrangeImageUrls(kinds);
  }, [chauffeurSelections, needDriver, stayTransportStops]);

  const transportIncomplete = useMemo(() => {
    if (stayTransportStops.length === 0) return true;
    // Last city has no inter-city hop — only local + hops with a next stay count
    return stayTransportStops.some(
      (s) =>
        s.localTransitType === "unset" ||
        (s.hasNext && s.transitType === "unset")
    );
  }, [stayTransportStops]);

  const experienceBands = useMemo(() => {
    if (isEliteConcierge || experienceService === "concierge") {
      return [
        {
          key: "concierge",
          title: "Elite Concierge Package",
          photoUrl: null as string | null,
        },
      ];
    }
    const toursById = Object.fromEntries(config.tours.map((t) => [t.id, t]));
    const bands: {
      key: string;
      title: string;
      photoUrl: string | null;
    }[] = [];
    for (const [cityId, rows] of Object.entries(selectedToursMap || {})) {
      for (const row of rows || []) {
        const tour = toursById[row.tourId];
        if (!tour) {
          bands.push({
            key: `${cityId}-${row.tourId}`,
            title: row.tourId,
            photoUrl: null,
          });
          continue;
        }
        const filename = tourPhoto(tour);
        const photoUrl =
          filename && tour.collectionId
            ? pbFileUrl(tour.collectionId, tour.id, filename, {
                thumb: PB_THUMBS.card,
                format: "webp",
              })
            : null;
        bands.push({
          key: `${cityId}-${row.tourId}`,
          title: tour.title || "Experience",
          photoUrl,
        });
      }
    }
    return bands;
  }, [
    config.tours,
    experienceService,
    isEliteConcierge,
    selectedToursMap,
  ]);

  // —— Locations modal helpers ——
  const arrivalHubs = useMemo(
    () => hubs.filter((h) => h.type === hubTypeForMode(arrivalMode)),
    [hubs, arrivalMode]
  );
  const departureHubs = useMemo(
    () => hubs.filter((h) => h.type === hubTypeForMode(departureMode)),
    [hubs, departureMode]
  );

  useEffect(() => {
    if (
      arrivalTransferId &&
      !arrivalHubs.some((h) => h.id === arrivalTransferId)
    ) {
      setArrivalTransferId(null);
    }
  }, [arrivalHubs, arrivalTransferId, setArrivalTransferId]);

  useEffect(() => {
    if (
      departureTransferId &&
      !departureHubs.some((h) => h.id === departureTransferId)
    ) {
      setDepartureTransferId(null);
    }
  }, [departureHubs, departureTransferId, setDepartureTransferId]);

  const dateRanges = useMemo(
    () => calculateCityDateRanges(arrivalDate, locations),
    [arrivalDate, locations]
  );
  const dateByKey = useMemo(
    () => Object.fromEntries(dateRanges.map((r) => [r.key ?? r.cityId, r])),
    [dateRanges]
  );
  const arrivalHub = hubs.find((h) => h.id === arrivalTransferId) ?? null;
  const departureHub = hubs.find((h) => h.id === departureTransferId) ?? null;
  const routeWarnings = useMemo(
    () =>
      validateCityRoute(
        arrivalHub,
        departureHub,
        locations,
        cities,
        config.cityMovements
      ),
    [arrivalHub, departureHub, locations, cities, config.cityMovements]
  );
  const seasonalMatches = useMemo(
    () =>
      matchSeasonalHighlights(
        config.seasonalHighlights,
        arrivalDate,
        locations.map((l) => ({ cityId: l.cityId, nights: l.nights }))
      ),
    [config.seasonalHighlights, arrivalDate, locations]
  );
  const totalNights = overnightNightsTotal(locations);
  const matches = totalNights === durationDays;
  const lastCityId =
    [...locations].reverse().find((l) => !isTransitHubStop(l))?.cityId ?? null;

  const hubShortName = (hub: (typeof hubs)[0] | null) => {
    if (!hub) return "Arrival";
    return hub.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || hub.name;
  };

  // —— Hotels helpers ——
  const orderedCityIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const loc of locations) {
      if (isTransitHubStop(loc)) continue;
      if ((loc.nights || 0) <= 0) continue;
      if (seen.has(loc.cityId)) continue;
      seen.add(loc.cityId);
      ids.push(loc.cityId);
    }
    return ids;
  }, [locations]);

  const totalGuests = adults + children;
  const roomReq = useMemo(
    () => calculateRoomRequirements(adults, children),
    [adults, children]
  );

  const overallAllocation = useMemo(() => {
    let worstRemaining = 0;
    let allCovered = true;
    for (const id of orderedCityIds) {
      const pref = normalizeCityHotelPref(
        cityHotels[id] || { cityId: id },
        id
      );
      if (!pref.needsHotel) continue;
      const status = getHotelAllocationStatus(
        pref.rooms,
        totalGuests,
        pref.standardOccupancy
      );
      if (status.remainingGuests > worstRemaining) {
        worstRemaining = status.remainingGuests;
      }
      if (status.remainingGuests > 0 || status.tone !== "ok") {
        allCovered = false;
      }
    }
    return {
      remaining: worstRemaining,
      covered: allCovered && totalGuests > 0,
      label: allCovered
        ? `All ${totalGuests} guests accommodated`
        : `${worstRemaining} of ${totalGuests} guests unassigned`,
    };
  }, [cityHotels, orderedCityIds, totalGuests]);

  const hotelsComplete = isBuilderStepComplete(4, snapshot);
  const monthName = (() => {
    if (!arrivalDate) return null;
    const parts = arrivalDate.split("-").map(Number);
    const month = parts[1];
    if (!month || month < 1 || month > 12) return null;
    return [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ][month - 1];
  })();

  const editCtx = useMemo(
    () => ({
      activeEditModal,
      openEditModal,
      closeEditModal: () => setActiveEditModal(null),
    }),
    [activeEditModal, openEditModal]
  );

  const toursIsConcierge =
    isEliteConcierge || experienceService === "concierge";

  return (
    <BuilderEditModalProvider value={editCtx}>
      <ProgressBar />
      <BuilderMWidgetGrid
        onOpen={openEditModal}
        tripDays={durationDays}
        arrivalDate={arrivalDate}
        startDateText={startDateText}
        guestCount={guestCount}
        paceLabel={paceLabel ? `${paceLabel} Pace` : null}
        arrivalAirport={arrivalAirport}
        departureAirport={departureAirport}
        arrivalMode={arrivalMode}
        departureMode={departureMode}
        airportPickup={airportPickup}
        airportDropoff={airportDropoff}
        cityBands={cityBands}
        hotelArrangeLabel={hotelArrangeLabel}
        hotelBgImages={hotelBgImages}
        transportArrangeLabel={transportArrangeLabel}
        transportBgImages={transportBgImages}
        experienceBands={experienceBands}
        hotelCityChecks={hotelCityChecks}
        transportIncomplete={transportIncomplete}
        highestUnlockedStep={highestUnlockedStep}
        locked={locked}
      />

      {/* Itinerary CTA when all steps unlocked */}
      {highestUnlockedStep >= 6 ? (
        <div className="mx-auto w-full max-w-2xl px-4 pb-8">
          <a
            href="/builder/itinerary"
            className="flex w-full items-center justify-center rounded-full bg-[#054F70] py-3.5 text-sm font-semibold text-white transition hover:bg-[#043d57]"
          >
            Save &amp; View Itinerary
          </a>
        </div>
      ) : null}

      {durationMounted ? (
        <DaysDateEditorModal
          open={activeEditModal === "duration"}
          onClose={() => closeAndAdvance("duration")}
          seasonTiers={config.seasonTiers}
        />
      ) : null}

      {guestsMounted ? (
        <DurationEditorModal
          open={activeEditModal === "guests"}
          onClose={() => closeAndAdvance("guests")}
        />
      ) : null}

      {transitMounted ? (
        <HubConfigModal
          open={activeEditModal === "transit"}
          onClose={() => closeAndAdvance("transit")}
          arrival={{
            mode: arrivalMode,
            onModeChange: setArrivalMode,
            hubId: arrivalTransferId,
            onHubChange: setArrivalTransferId,
            hubs: arrivalHubs,
            vipEnabled: airportPickup,
            onVipChange: setAirportPickup,
          }}
          departure={{
            mode: departureMode,
            onModeChange: setDepartureMode,
            hubId: departureTransferId,
            onHubChange: setDepartureTransferId,
            hubs: departureHubs,
            vipEnabled: airportDropoff,
            onVipChange: setAirportDropoff,
          }}
          allHubs={hubs}
          vehicles={config.vehicles}
          airportTransfers={config.airportTransfers}
        />
      ) : null}

      {locationsMounted ? (
        <LocationsEditorModal
          open={activeEditModal === "locations"}
          onClose={() => closeAndAdvance("locations")}
          locations={locations}
          cities={cities}
          cityMap={cityMap}
          dateByKey={dateByKey}
          arrivalHub={arrivalHub}
          departureHub={departureHub}
          hubById={hubById}
          hubShortName={hubShortName}
          expandedKey={expandedKey}
          setExpandedKey={setExpandedKey}
          seasonalMatches={seasonalMatches}
          selectedTourIds={selectedTourIds}
          routeWarnings={routeWarnings}
          routeToast={routeToast}
          totalNights={totalNights}
          durationDays={durationDays}
          matches={matches}
          lastCityId={lastCityId}
          pickerOpen={pickerOpen}
          setPickerOpen={setPickerOpen}
          onReorder={(next) => {
            if (!reorderLocations(next)) {
              setRouteToast("Consecutive identical cities are not allowed.");
            }
          }}
          onNights={(key, n) => setLocationNights(key, n)}
          onVisitType={(key, t) => setLocationVisitType(key, t)}
          onRemove={(key) => removeLocation(key)}
          onAddTour={(id) => {
            if (!selectedTourIds.includes(id)) toggleTour(id);
          }}
          onAddCity={(cityId) => {
            if (!addLocation(cityId)) {
              setRouteToast("Consecutive identical cities are not allowed.");
              return false;
            }
            return true;
          }}
        />
      ) : null}

      {hotelsMounted ? (
        <HotelsEditorModal
          open={activeEditModal === "hotels_transport"}
          onClose={() => closeAndAdvance("hotels_transport")}
          orderedCityIds={orderedCityIds}
          cityById={(id) => cityMap[id]}
          cityName={(id) => cityNames[id] ?? getCityName(id, cityLabelMap)}
          cityHotels={cityHotels}
          accommodations={accommodations}
          monthName={monthName}
          seasonTier={activeSeasonTier}
          totalGuests={totalGuests}
          adults={adults}
          children={children}
          roomReq={roomReq}
          hotelsComplete={hotelsComplete}
          overallAllocation={overallAllocation}
          onChange={(cityId, patch) => setCityHotel(cityId, patch)}
        />
      ) : null}

      {toursMounted && toursIsConcierge ? (
        <ConciergeEditorModal
          open={activeEditModal === "tours"}
          onClose={() => closeAndAdvance("tours")}
        />
      ) : null}

      {toursMounted && !toursIsConcierge ? (
        <TailoredExperiencesModal
          open={activeEditModal === "tours"}
          onClose={() => closeAndAdvance("tours")}
          tours={config.tours}
          cities={cities}
          cityNames={cityNames}
          allowToursOnTravelDays={false}
          seasonalHighlights={config.seasonalHighlights}
          hideTransport
        />
      ) : null}

      {driversMounted ? (
        <DriversEditorModal
          open={activeEditModal === "drivers"}
          onClose={() => closeAndAdvance("drivers")}
          onTransportComplete={() =>
            unlockBuilderStep(BUILDER_ALL_STEPS_COMPLETE)
          }
          cities={cities}
          cityNames={cityNames}
          cityMovements={config.cityMovements}
          vehicles={config.vehicles}
          chauffeurRates={config.chauffeurRates}
        />
      ) : null}

      {/* silence unused overnightStopCount if tree-shaken — keep import used */}
    </BuilderEditModalProvider>
  );
}
