import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
  parseItineraryData,
  type InterestId,
  type MotivationId,
  type PainPointId,
  type PreEliteItineraryData,
  type TravelStyleId,
} from "@/lib/preEliteBuilder";
import {
  createExperienceProfile,
  type ProfilerCrowdStyle,
  type ProfilerPace,
  type ProfilerVibe,
} from "@/lib/experienceProfiler";
import type { HotelStarRating } from "@/store/useBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useQuizStore } from "@/store/useQuizStore";
import { distributeStayNights } from "@/lib/transitHubs";

export type TravelStyleTierRules = {
  allowedHotelStars: HotelStarRating[];
  defaultHotelStar: HotelStarRating;
  hotelTier: "4-star" | "5-star";
  allowPrivateChauffeur: boolean;
  preferPrivateTransit: boolean;
  vipHighlight: boolean;
  label: string;
};

export function travelStyleTierRules(
  style: TravelStyleId | null | undefined
): TravelStyleTierRules {
  switch (style) {
    case "classic_explorer":
      return {
        allowedHotelStars: [3, 4],
        defaultHotelStar: 3,
        hotelTier: "4-star",
        allowPrivateChauffeur: false,
        preferPrivateTransit: false,
        vipHighlight: false,
        label: "Classic Explorer",
      };
    case "vip_bespoke":
      return {
        allowedHotelStars: [5],
        defaultHotelStar: 5,
        hotelTier: "5-star",
        allowPrivateChauffeur: true,
        preferPrivateTransit: true,
        vipHighlight: true,
        label: "VIP Bespoke",
      };
    case "premium_comfort":
    default:
      return {
        allowedHotelStars: [4, 5],
        defaultHotelStar: 4,
        hotelTier: "5-star",
        allowPrivateChauffeur: true,
        preferPrivateTransit: true,
        vipHighlight: false,
        label: style ? "Premium Comfort" : "Premium Comfort",
      };
  }
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Resolve total trip days from a pre-elite brief.
 * Prefers structured timing.totalDays; falls back to "(N Days)" in the label.
 */
export function resolveBriefDurationDays(
  data: PreEliteItineraryData
): number | null {
  const fromTiming = Math.round(Number(data.timing?.totalDays) || 0);
  if (fromTiming >= 1 && fromTiming <= 45) return fromTiming;

  const labeled = String(data.dates || data.timing?.formattedString || "").match(
    /\((\d+)\s*Days?\)/i
  );
  if (labeled) {
    const n = Number(labeled[1]);
    if (n >= 1 && n <= 45) return n;
  }
  return null;
}

/** Best-effort parse of free-text timing into YYYY-MM-DD. */
export function parseTravelDatesLabel(label: string): string | null {
  const raw = String(label || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const isoish = raw.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (isoish) {
    const y = isoish[1];
    const m = isoish[2].padStart(2, "0");
    const d = isoish[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const dayMonthYear = raw.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?\s+(\d{4})\b/i
  );
  if (dayMonthYear) {
    const day = dayMonthYear[1].padStart(2, "0");
    const month = MONTHS[dayMonthYear[2].toLowerCase().replace(/\.$/, "")];
    const year = dayMonthYear[3];
    if (month) return `${year}-${String(month).padStart(2, "0")}-${day}`;
  }

  const named = raw.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?\s+(\d{4})\b/i
  );
  if (named) {
    const month = MONTHS[named[1].toLowerCase().replace(/\.$/, "")];
    const year = named[2];
    if (month) return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

function interestToVibe(id: InterestId): ProfilerVibe {
  switch (id) {
    case "food_culinary":
      return "foodie";
    case "modern_pop":
      return "modern";
    case "nature_day_trips":
      return "nature";
    case "culture_heritage":
    default:
      return "culture";
  }
}

function motivationToPace(id: MotivationId | null): ProfilerPace {
  if (id === "romantic" || id === "family") return "relaxed";
  if (id === "solo") return "active";
  return "standard";
}

function painPointsToCrowd(points: PainPointId[]): ProfilerCrowdStyle {
  if (points.includes("tourist_traps") || points.includes("authentic_dining")) {
    return "hidden_gems";
  }
  if (points.includes("packed_itinerary")) return "balanced";
  return "classic";
}

export function experienceProfileFromBrief(data: PreEliteItineraryData) {
  const vibe = interestToVibe(data.interests[0] ?? "culture_heritage");
  const pace = motivationToPace(data.tripMotivation);
  const crowd = painPointsToCrowd(data.painPoints);
  return createExperienceProfile(vibe, pace, crowd);
}

export interface PreEliteHydrateInput {
  bookingRef: string;
  fullName?: string;
  email?: string;
  itineraryData: string | PreEliteItineraryData;
}

/**
 * Push a completed pre-elite brief into builder + itinerary stores,
 * then return the builder URL with `?ref=`.
 */
export function hydrateStoresFromPreEliteBrief(
  input: PreEliteHydrateInput
): { href: string; data: PreEliteItineraryData } | null {
  const data =
    typeof input.itineraryData === "string"
      ? parseItineraryData(input.itineraryData)
      : input.itineraryData;
  if (!data) return null;

  const bookingRef = String(input.bookingRef || "").trim().toUpperCase();
  if (!bookingRef) return null;

  const rules = travelStyleTierRules(data.travelStyle);
  const arrivalDate =
    data.timing?.startDate || parseTravelDatesLabel(data.dates);
  const briefDays = resolveBriefDurationDays(data);
  const adults = data.groupSize.adults;
  const children = data.groupSize.children;
  const totalGuests = Math.max(1, adults + children);
  const profile = experienceProfileFromBrief(data);
  const travelPace =
    profile.pace === "relaxed"
      ? ("relaxed" as const)
      : profile.pace === "active"
        ? ("fast" as const)
        : ("moderate" as const);

  const tripMode = data.tripType === "single_day" ? "single_day" : "multi_day";
  const durationDays =
    tripMode === "single_day" ? 1 : (briefDays ?? useBuilderStore.getState().durationDays);

  // Capture before overwrite — Match Quiz must not inherit Pre-Elite answers.
  const priorRef = useBuilderStore.getState().confirmedBookingRef;
  const quiz = useQuizStore.getState();
  const keepQuiz =
    quiz.isQuizCompleted &&
    Boolean(quiz.travelProfile) &&
    priorRef === bookingRef;
  if (!keepQuiz) {
    useQuizStore.getState().clearQuiz();
  }

  useBuilderStore.setState((s) => {
    const cityHotels = { ...s.cityHotels };
    for (const [cityId, pref] of Object.entries(cityHotels)) {
      const star = rules.allowedHotelStars.includes(pref.starRating)
        ? pref.starRating
        : rules.defaultHotelStar;
      cityHotels[cityId] = { ...pref, starRating: star };
    }

    const durationCustom =
      tripMode === "single_day" ? true : ![10, 14, 21].includes(durationDays);

    return {
      adults,
      children,
      hotelTier: rules.hotelTier,
      cityHotels,
      arrivalDate: arrivalDate ?? s.arrivalDate,
      durationDays,
      durationCustom,
      tripMode,
      // Optional add-ons start OFF for a fresh pre-elite lead sync
      airportPickup: false,
      airportDropoff: false,
      arrivalTransitType: rules.preferPrivateTransit ? "private" : "public",
      chauffeurSelections: {},
      chauffeurDays: {},
      needDriver: false,
      needHotels: tripMode === "multi_day" ? s.needHotels : false,
      locations:
        tripMode === "single_day"
          ? s.locations
          : distributeStayNights(s.locations, durationDays),
      // Never invent a Match Quiz profile from Pre-Elite
      experienceProfile: keepQuiz ? quiz.travelProfile : null,
      travelPace,
      preEliteTravelStyle: data.travelStyle,
      // Keep structured brief metadata; do not surface a conflicting secondary label.
      preEliteDatesLabel: null,
      preEliteInterests: data.interests,
      preEliteMotivation: data.tripMotivation,
      preElitePainPoints: data.painPoints,
      confirmedBookingRef: bookingRef,
      bookingStatus: "in_progress" as const,
      tempBookingRef: bookingRef.startsWith("TMP-")
        ? bookingRef
        : s.tempBookingRef || bookingRef,
      highestUnlockedStep: Math.max(1, s.highestUnlockedStep),
    };
  });

  useItineraryStore.setState((s) => {
    const stayCities = s.cityNights;
    let cityNights = stayCities;
    if (tripMode === "single_day") {
      cityNights = stayCities.map((c) => ({ ...c, nights: 0 }));
    } else if (stayCities.length > 0) {
      const base = Math.floor(durationDays / stayCities.length);
      const rem = durationDays % stayCities.length;
      cityNights = stayCities.map((c, i) => ({
        ...c,
        nights: base + (i === 0 ? rem : 0),
      }));
    } else {
      cityNights = [];
    }
    const kept = keepQuiz && quiz.travelProfile ? quiz.travelProfile : null;
    return {
      adults,
      children,
      totalGuests,
      durationDays,
      isCustomDuration:
        tripMode === "single_day"
          ? true
          : briefDays != null
            ? ![10, 14, 21].includes(briefDays)
            : s.isCustomDuration,
      pickupTransfer: false,
      dropoffTransfer: false,
      privateChauffeur: false,
      cityNights,
      clientName: String(input.fullName || "").trim(),
      clientEmail: String(input.email || "").trim().toLowerCase(),
      hotelTier: rules.hotelTier,
      transitMode: rules.preferPrivateTransit ? "private-car" : "shinkansen",
      userProfile: kept
        ? {
            vibe: kept.vibe,
            pace: kept.pace,
            crowdStyle: kept.crowdStyle,
            isCompleted: true,
          }
        : null,
      userProfileTag: kept ? kept.userProfileTag : null,
      confirmedBookingRef: bookingRef,
      bookingStatus: "in_progress",
      tempBookingRef: bookingRef,
    };
  });

  // Fire-and-forget: draft → in_progress on PocketBase bookings lead.
  if (typeof window !== "undefined") {
    void import("@/lib/bookingLifecycle").then(({ requestAdvanceBookingInProgress }) =>
      requestAdvanceBookingInProgress(bookingRef)
    );
  }

  const builderPath =
    tripMode === "single_day" ? "/builder-single" : "/builder";
  return {
    href: `${builderPath}?ref=${encodeURIComponent(bookingRef)}`,
    data,
  };
}

export function briefSummaryLabels(data: PreEliteItineraryData) {
  return {
    style: TRAVEL_STYLES.find((o) => o.id === data.travelStyle)?.title ?? data.travelStyle,
    interests: data.interests
      .map((id) => INTERESTS.find((o) => o.id === id)?.title ?? id)
      .join(", "),
    motivation:
      MOTIVATIONS.find((o) => o.id === data.tripMotivation)?.title ??
      data.tripMotivation,
    concerns: data.painPoints
      .map((id) => PAIN_POINTS.find((o) => o.id === id)?.title ?? id)
      .join(", "),
  };
}
