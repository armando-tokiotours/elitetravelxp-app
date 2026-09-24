import { generateConfirmedPNR } from "@/utils/pnr";

/** Official lead reference for a pre-elite qualification. */
export function generatePNR(): string {
  return generateConfirmedPNR();
}

export const TRAVEL_STYLES = [
  {
    id: "classic_explorer",
    title: "Classic Explorer",
    eyebrow: "Best value",
    description:
      "Private guide with local public transport and walking. Authentic immersion.",
  },
  {
    id: "premium_comfort",
    title: "Premium Comfort",
    eyebrow: "Most popular",
    description:
      "Private guide with a dedicated luxury vehicle. Seamless comfort.",
  },
  {
    id: "vip_bespoke",
    title: "VIP Bespoke",
    eyebrow: "Exclusive",
    description:
      "Complete VIP access, luxury chauffeur, high-end private dining, and exclusive entry.",
  },
] as const;

export const INTERESTS = [
  {
    id: "culture_heritage",
    title: "Culture & Heritage",
    description:
      "Shrines, tea ceremonies, historic districts, and sumo culture.",
  },
  {
    id: "food_culinary",
    title: "Food & Culinary",
    description:
      "Hidden izakayas, street food, Michelin-star dining, and sake tasting.",
  },
  {
    id: "modern_pop",
    title: "Modern & Pop Culture",
    description:
      "Anime, tech, shopping, nightlife, and vibrant street photography.",
  },
  {
    id: "nature_day_trips",
    title: "Nature & Day Trips",
    description: "Mt. Fuji, Hakone, Kamakura, and hidden coastal villages.",
  },
] as const;

export const MOTIVATIONS = [
  {
    id: "family",
    title: "Family Vacation",
    description: "Creating lifelong shared memories.",
  },
  {
    id: "romantic",
    title: "Romantic Getaway / Honeymoon",
    description: "Exclusive, intimate, luxury experiences.",
  },
  {
    id: "solo",
    title: "Solo Explorer",
    description: "Seeking deep, authentic local culture.",
  },
  {
    id: "first_time",
    title: "First-Time Japan Visitor",
    description: "Wanting a completely smooth, stress-free experience.",
  },
] as const;

export const PAIN_POINTS = [
  {
    id: "language_transit",
    title: "Language & transit",
    description: "Language barriers and navigating complex transit.",
  },
  {
    id: "tourist_traps",
    title: "Tourist traps",
    description: "Falling into crowded, over-hyped tourist traps.",
  },
  {
    id: "authentic_dining",
    title: "Authentic dining",
    description: "Finding authentic, non-touristy dining spots.",
  },
  {
    id: "packed_itinerary",
    title: "No time to breathe",
    description: "An overly packed itinerary with zero time for relaxation.",
  },
] as const;

export type TravelStyleId = (typeof TRAVEL_STYLES)[number]["id"];
export type InterestId = (typeof INTERESTS)[number]["id"];
export type MotivationId = (typeof MOTIVATIONS)[number]["id"];
export type PainPointId = (typeof PAIN_POINTS)[number]["id"];

/** Multi-day journey vs single-day tour / day-trip. */
export type TripType = "multi_day" | "single_day";

export const TRIP_TYPES = [
  {
    id: "multi_day" as const,
    title: "Multi-Day Journey",
    description:
      "Overnight stays across cities — hotels, inter-city transit, and a full itinerary.",
  },
  {
    id: "single_day" as const,
    title: "Single-Day Tour / Day-Trip",
    description:
      "A focused 6–8 hour day with hour-by-hour activities and intra-city movement only.",
  },
] as const;

export interface PreEliteTiming {
  startDate: string | null;
  totalDays: number;
  targetMonth: string | null;
  formattedString: string;
}

export interface PreEliteDraft {
  travelStyle: TravelStyleId | null;
  interests: InterestId[];
  tripMotivation: MotivationId | null;
  painPoints: PainPointId[];
  tripType: TripType | null;
  fullName: string;
  email: string;
  whatsapp: string;
  timing: PreEliteTiming;
  adults: number;
  children: number;
}

export interface PreEliteItineraryData {
  travelStyle: TravelStyleId;
  interests: InterestId[];
  tripMotivation: MotivationId;
  painPoints: PainPointId[];
  tripType: TripType;
  /** Human-readable timing label (legacy + display). */
  dates: string;
  timing: PreEliteTiming;
  whatsapp: string;
  groupSize: { adults: number; children: number };
}

export interface PreEliteBookingPayload {
  bookingRef: string;
  fullName: string;
  email: string;
  status: "draft";
  itineraryData: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function includesId<T extends string>(
  options: readonly { id: T }[],
  value: string
): value is T {
  return options.some((option) => option.id === value);
}

export function labelFor<T extends string>(
  options: readonly { id: T; title: string }[],
  id: T
): string {
  return options.find((option) => option.id === id)?.title ?? id;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_NAMES = [
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
] as const;

export function emptyTiming(): PreEliteTiming {
  return {
    startDate: null,
    totalDays: 10,
    targetMonth: null,
    formattedString: "",
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatShortDay(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatMonthName(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Build the timing object saved on the lead brief. */
export function buildTimingPayload(input: {
  startDate?: Date | null;
  targetMonth?: string | null;
  totalDays?: number;
}): PreEliteTiming {
  const totalDays = Math.min(
    45,
    Math.max(1, Math.round(Number(input.totalDays) || 10))
  );
  const start = input.startDate ?? null;
  if (start) {
    return {
      startDate: toIsoDate(start),
      totalDays,
      targetMonth: formatMonthName(start),
      formattedString: `${formatShortDay(start)} (${totalDays} ${
        totalDays === 1 ? "Day" : "Days"
      })`,
    };
  }
  const month = String(input.targetMonth || "").trim() || null;
  if (month) {
    return {
      startDate: null,
      totalDays,
      targetMonth: month,
      formattedString: `${month} (${totalDays} ${
        totalDays === 1 ? "Day" : "Days"
      })`,
    };
  }
  return {
    ...emptyTiming(),
    totalDays,
  };
}

export function normalizeTiming(raw: unknown): PreEliteTiming {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) {
      return {
        ...emptyTiming(),
        formattedString: raw.trim().slice(0, 120),
        targetMonth: raw.trim().slice(0, 40),
      };
    }
    return emptyTiming();
  }
  const data = raw as Partial<PreEliteTiming>;
  const totalDays = Math.min(
    45,
    Math.max(1, Math.round(Number(data.totalDays) || 10))
  );
  const startDate =
    typeof data.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.startDate)
      ? data.startDate
      : null;
  const targetMonth =
    typeof data.targetMonth === "string" && data.targetMonth.trim()
      ? data.targetMonth.trim().slice(0, 40)
      : null;
  const formattedString =
    typeof data.formattedString === "string" && data.formattedString.trim()
      ? data.formattedString.trim().slice(0, 120)
      : "";

  if (startDate) {
    const [y, m, d] = startDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return buildTimingPayload({ startDate: date, totalDays });
  }
  if (targetMonth) {
    return buildTimingPayload({ targetMonth, totalDays });
  }
  return {
    startDate: null,
    totalDays,
    targetMonth: null,
    formattedString,
  };
}

export function isTripType(value: unknown): value is TripType {
  return value === "multi_day" || value === "single_day";
}

export function emptyDraft(): PreEliteDraft {
  return {
    travelStyle: null,
    interests: [],
    tripMotivation: null,
    painPoints: [],
    tripType: null,
    fullName: "",
    email: "",
    whatsapp: "",
    timing: emptyTiming(),
    adults: 2,
    children: 0,
  };
}

export function stepError(step: number, draft: PreEliteDraft): string | null {
  if (step === 1 && !draft.travelStyle) {
    return "Choose the comfort tier that fits this trip.";
  }
  if (step === 2 && draft.interests.length === 0) {
    return "Select at least one interest.";
  }
  if (step === 3 && !draft.tripMotivation) {
    return "Tell us what this trip is really for.";
  }
  if (step === 4 && draft.painPoints.length === 0) {
    return "Select at least one concern we should design around.";
  }
  if (step === 5) return contactError(draft);
  return null;
}

export function contactError(draft: PreEliteDraft): string | null {
  if (!draft.tripType) {
    return "Choose Multi-Day Journey or Single-Day Tour.";
  }
  if (!draft.fullName.trim()) return "Enter your full name.";
  if (!EMAIL_RE.test(draft.email.trim())) {
    return "Enter a valid email address.";
  }
  if (!draft.timing.formattedString.trim()) {
    return "Share your arrival date or a target month.";
  }
  const maxDays = draft.tripType === "single_day" ? 1 : 45;
  if (
    !Number.isInteger(draft.timing.totalDays) ||
    draft.timing.totalDays < 1 ||
    draft.timing.totalDays > maxDays
  ) {
    return draft.tripType === "single_day"
      ? "Single-day tours are one day only."
      : "Trip length must be between 1 and 45 days.";
  }
  if (!Number.isInteger(draft.adults) || draft.adults < 1 || draft.adults > 20) {
    return "Adults must be between 1 and 20.";
  }
  if (
    !Number.isInteger(draft.children) ||
    draft.children < 0 ||
    draft.children > 20
  ) {
    return "Children must be between 0 and 20.";
  }
  const phone = draft.whatsapp.trim();
  if (phone && !/\d/.test(phone)) {
    return "WhatsApp number should include digits.";
  }
  return null;
}

export function toItineraryData(draft: PreEliteDraft): PreEliteItineraryData | null {
  if (
    !draft.travelStyle ||
    !draft.tripMotivation ||
    draft.interests.length === 0 ||
    draft.painPoints.length === 0 ||
    contactError(draft)
  ) {
    return null;
  }
  const tripType = draft.tripType!;
  const timing =
    tripType === "single_day"
      ? normalizeTiming({ ...draft.timing, totalDays: 1 })
      : normalizeTiming(draft.timing);
  return {
    travelStyle: draft.travelStyle,
    interests: draft.interests,
    tripMotivation: draft.tripMotivation,
    painPoints: draft.painPoints,
    tripType,
    dates: timing.formattedString.trim() || draft.timing.formattedString.trim(),
    timing,
    whatsapp: draft.whatsapp.trim(),
    groupSize: { adults: draft.adults, children: draft.children },
  };
}

export function buildBookingPayload(
  draft: PreEliteDraft,
  bookingRef = generatePNR()
): PreEliteBookingPayload | null {
  const itinerary = toItineraryData(draft);
  if (!itinerary) return null;
  return {
    bookingRef,
    fullName: draft.fullName.trim(),
    email: draft.email.trim().toLowerCase(),
    status: "draft",
    itineraryData: JSON.stringify(itinerary),
  };
}

export function parseItineraryData(raw: unknown): PreEliteItineraryData | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<PreEliteItineraryData> & {
    groupSize?: { adults?: number; children?: number };
  };
  if (
    typeof data.travelStyle !== "string" ||
    !includesId(TRAVEL_STYLES, data.travelStyle)
  ) {
    return null;
  }
  if (
    typeof data.tripMotivation !== "string" ||
    !includesId(MOTIVATIONS, data.tripMotivation)
  ) {
    return null;
  }
  if (!Array.isArray(data.interests) || data.interests.length === 0) return null;
  if (!data.interests.every((id) => typeof id === "string" && includesId(INTERESTS, id))) {
    return null;
  }
  if (!Array.isArray(data.painPoints) || data.painPoints.length === 0) return null;
  if (
    !data.painPoints.every((id) => typeof id === "string" && includesId(PAIN_POINTS, id))
  ) {
    return null;
  }
  const tripType: TripType = isTripType(
    (data as { tripType?: unknown }).tripType
  )
    ? ((data as { tripType: TripType }).tripType)
    : "multi_day";
  const timingRaw = normalizeTiming(
    (data as { timing?: unknown }).timing ?? data.dates
  );
  const timing =
    tripType === "single_day"
      ? normalizeTiming({ ...timingRaw, totalDays: 1 })
      : timingRaw;
  const dates = timing.formattedString || String(data.dates || "").trim();
  if (!dates || dates.length > 120) return null;
  const adults = Number(data.groupSize?.adults);
  const children = Number(data.groupSize?.children);
  if (!Number.isInteger(adults) || adults < 1 || adults > 20) return null;
  if (!Number.isInteger(children) || children < 0 || children > 20) return null;
  return {
    travelStyle: data.travelStyle,
    interests: data.interests as InterestId[],
    tripMotivation: data.tripMotivation,
    painPoints: data.painPoints as PainPointId[],
    tripType,
    dates,
    timing,
    whatsapp: String(data.whatsapp || "").trim().slice(0, 40),
    groupSize: { adults, children },
  };
}
