/**
 * Lightweight PocketBase `bookings_and_leads` sync layer.
 * Stores PNR + email + ID snapshots — never full catalog blobs.
 */

import {
  formatCitiesList,
  formatDurationLabel,
} from "@/lib/bookingLeadAudit";
import { chauffeurDaysFromSelections, migrateLegacyChauffeurDays } from "@/lib/chauffeurSelections";
import {
  guestReqsFromLegacySpecialNeeds,
  guestSpecialRequirementsChoicesComplete,
  normalizeGuestSpecialRequirements,
  serializeGuestSpecialRequirements,
  type GuestSpecialRequirements,
} from "@/lib/guestSpecialRequirements";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import type { BuilderState } from "@/store/useBuilderStore";
import type { SingleDayBuilderState } from "@/store/useSingleDayBuilderStore";
import { calculateCityDateRanges } from "@/lib/dateCascade";
import { totalHotelRooms } from "@/lib/hotelCalculator";

export type BookingLeadType = "multi_day" | "single_day" | "experience_only";

export type BookingLeadStatus =
  | "draft"
  | "lead"
  | "in_progress"
  | "incoming"
  | "quoted"
  | "confirmed"
  | "in_ops"
  | "done"
  | "cancelled";

export interface BookingLeadGuests {
  adults: number;
  kids: number;
}

/** Multi-day: foreign keys + prefs only */
export interface MultiDaySelections {
  locationCityIds: string[];
  hotelByCity: Record<string, string>;
  /**
   * Stay stops in route order (duplicates allowed — e.g. Tokyo → Kyoto → Tokyo).
   * Includes dates + incoming transit for Ops timeline.
   */
  locationStops?: Array<{
    cityId: string;
    cityName?: string;
    nights: number;
    startDate?: string;
    endDate?: string;
    hotelArrangement: "self" | "tokiotours" | "unset";
    hotelStar?: string;
    hotelName?: string;
    hotelUrl?: string;
    roomsReserved?: number;
    /** How guest arrives into this stay (from previous hub/city). */
    incomingTransitType?: string;
    needsTicket?: boolean;
    ticketType?: string;
    ticketPricePerPax?: number;
  }>;
  experienceIds: string[];
  experienceSchedule?: Array<{
    tourId: string;
    cityId: string;
    date?: string;
    language?: string;
    /** Snapshot title for Ops (avoids raw id display). */
    title?: string;
    durationHours?: number;
    accessType?: string;
  }>;
  transitByLeg?: Array<{
    fromCityId: string;
    toCityId: string;
    transitType: string;
  }>;
  pace?: string | null;
  arrivalTransferId?: string | null;
  departureTransferId?: string | null;
  /** Human labels for Ops timeline (no hub catalog fetch needed). */
  arrivalHubLabel?: string | null;
  departureHubLabel?: string | null;
  airportPickup?: boolean;
  airportDropoff?: boolean;
  arrivalTransitType?: string | null;
  durationDays?: number;
  experienceService?: string | null;
  /** Special mobility / party needs for ops staff */
  specialNeeds?: string[];
  /** Structured dietary / mobility / extras / notes (also top-level PB JSON) */
  guestSpecialRequirements?: GuestSpecialRequirements;
  /** City-level preferred guided language */
  preferredTourLanguage?: string;
  meetingPointName?: string;
  meetingPointAddress?: string;
  meetingPointLat?: number | null;
  meetingPointLng?: number | null;
  meetingPointPlaceId?: string;
  /** Public transit pass questionnaire — Tours step + Ticketer */
  guestHasJRPass?: boolean | null;
  guestHasICCard?: boolean | null;
  guestNeedsTransitHelp?: boolean | null;
  /** Pre-quiz travel style id (vip_bespoke / premium_comfort / classic_explorer) */
  preEliteTravelStyle?: string | null;
  /** Pre-quiz interest ids */
  preEliteInterests?: string[];
  /** Pre-quiz motivation id */
  preEliteMotivation?: string | null;
  /** Pre-quiz concern / preference ids */
  preElitePainPoints?: string[];
  /** In-city transport mode per stay city */
  localTransitByCity?: Array<{
    cityId: string;
    localTransitType: string;
  }>;
  /** cityId → chauffeur dates (YYYY-MM-DD) for day CAR badges */
  chauffeurDaysByCity?: Record<string, string[]>;
  /** Catalog transport products (Suica, Kamakura rail, Shinkansen…) */
  transportTickets?: Array<{
    productId: string;
    name: string;
    transportType: string;
    pricePerPerson?: number;
    quantity?: number;
    cityId?: string;
  }>;
}

/** Single-day: IDs + hour-by-hour prefs */
export interface SingleDaySelections {
  cityId?: string;
  cityFocus?: string;
  startHour?: string;
  pace?: string | null;
  guidePreference?: string;
  selectedExperienceIds: string[];
  /** Full experience rows (timing intent + ticket date for Ticketer) */
  selectedExperiencesDetail?: Array<{
    tourId: string;
    title?: string;
    selectedLanguage?: string;
    duration_hours?: number;
    price?: number;
    access_type?: string;
    category?: string;
    entry_type?: string;
    is_extra?: boolean;
    timingIntent?: string;
    ticketDate?: string | null;
    opsTimingNote?: string;
  }>;
  transitOption?: string;
  /** subway Suica prepare + preload € / guest */
  suicaNeeded?: boolean;
  suicaValueEur?: number;
  /** Public transit pass questionnaire (JR / IC / assistance) */
  guestHasJRPass?: boolean | null;
  guestHasICCard?: boolean | null;
  guestNeedsTransitHelp?: boolean | null;
  tourHours?: number;
  meetingPointName?: string;
  meetingPointAddress?: string;
  meetingPointLat?: number | null;
  meetingPointLng?: number | null;
  meetingPointPlaceId?: string;
  preferredTourLanguage?: string;
  /** Pre-quiz travel style id (vip_bespoke / premium_comfort / classic_explorer) */
  preEliteTravelStyle?: string | null;
  preEliteInterests?: string[];
  preEliteMotivation?: string | null;
  preElitePainPoints?: string[];
  /** Special mobility / party needs (legacy ids) */
  specialNeeds?: string[];
  /** Structured dietary / mobility / extras / notes */
  guestSpecialRequirements?: GuestSpecialRequirements;
}

/** Builder E micro-service payload (DRIVER / EXPERIENCE / TRANSIT). */
export type ExperienceOnlySelections = Record<string, unknown> & {
  _v?: number;
  source?: string;
  booking_type?: string;
  category?: string | null;
};

export type BookingLeadSelections =
  | MultiDaySelections
  | SingleDaySelections
  | ExperienceOnlySelections;

export interface BookingsAndLeadsUpsertInput {
  bookingRef: string;
  email: string;
  type: BookingLeadType;
  status?: BookingLeadStatus;
  primaryCity?: string;
  tourDate?: string | null;
  guests: BookingLeadGuests;
  durationValue?: number;
  /** Explicit display label; auto-derived when omitted. */
  durationLabel?: string;
  /** "Tokyo, Kyoto, Hakone" — derived from cities when omitted. */
  citiesList?: string;
  cityNames?: string[];
  selections: BookingLeadSelections;
  dossierPdfUrl?: string | null;
  /** When true, also bumps email_sent_count + email timestamps. */
  recordEmailSent?: boolean;
  meetingPointName?: string;
  meetingPointAddress?: string;
  meetingPointLat?: number | null;
  meetingPointLng?: number | null;
  meetingPointPlaceId?: string;
  /** Top-level PB field on bookings + bookings_and_leads */
  guestSpecialRequirements?: GuestSpecialRequirements | null;
  /** Guest contact (Pre-Elite) — embedded into selections; mirrored to bookings */
  guestName?: string;
  whatsapp?: string;
}

export interface BookingsAndLeadsRecord {
  id: string;
  booking_ref: string;
  email: string;
  type: BookingLeadType;
  status: BookingLeadStatus;
  primary_city?: string;
  tour_date?: string;
  guests: BookingLeadGuests;
  duration_value?: number;
  duration_label?: string;
  cities_list?: string;
  selections: BookingLeadSelections;
  guest_special_requirements?: GuestSpecialRequirements;
  dossier_pdf_url?: string;
  first_email_sent_at?: string;
  last_email_sent_at?: string;
  email_sent_count?: number;
  save_version?: number;
  last_saved_at?: string;
  created?: string;
  updated?: string;
}

function safeRef(ref: string): string {
  return String(ref || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

function safeEmail(email: string): string {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/"/g, "");
}

/** Non-blocking ops_hub register after a successful BAL write. */
function syncOpsHubFromBal(opts: {
  pnr: string;
  detailId: string;
  status?: string | null;
  primaryCity?: string | null;
  tourDate?: string | null;
  durationDays?: number | null;
  guests?: BookingLeadGuests | null;
  estimatedTotalEur?: number | null;
  selections?: BookingLeadSelections | null;
}): void {
  const fromSel =
    opts.selections && typeof opts.selections === "object"
      ? (() => {
          const s = opts.selections as Record<string, unknown>;
          const quote =
            s.quote && typeof s.quote === "object"
              ? (s.quote as Record<string, unknown>)
              : null;
          const n = Number(
            s.quote_max ??
              s.quoteMax ??
              s.estimated_total ??
              s.estimatedTotal ??
              quote?.max ??
              quote?.totalEur ??
              0
          );
          return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
        })()
      : 0;
  const estimated =
    Math.max(0, Math.round(Number(opts.estimatedTotalEur) || 0)) || fromSel;

  void import("@/lib/opsHub")
    .then(({ upsertOpsHubFromDirect, formatGuestSummary }) =>
      upsertOpsHubFromDirect({
        pnr: opts.pnr,
        detailId: opts.detailId,
        status: opts.status,
        primaryCity: opts.primaryCity,
        tourDate: opts.tourDate,
        durationDays: opts.durationDays,
        guestSummary: formatGuestSummary(opts.guests),
        estimatedTotalEur: estimated > 0 ? estimated : null,
        markUnread: true,
      })
    )
    .catch((err) => {
      console.warn(
        "[ops_hub] skipped:",
        err instanceof Error ? err.message : err
      );
    });
}

/** Build lightweight multi-day selections from Builder M state. */
export function buildMultiDaySelections(
  state: Pick<
    BuilderState,
    | "locations"
    | "cityHotels"
    | "selectedTours"
    | "selectedTourIds"
    | "travelPace"
    | "arrivalTransferId"
    | "departureTransferId"
    | "arrivalDate"
    | "airportPickup"
    | "airportDropoff"
    | "arrivalTransitType"
    | "durationDays"
    | "experienceService"
    | "specialNeeds"
    | "guestSpecialRequirements"
    | "preferredTourLanguage"
    | "meetingPoint"
    | "meetingPointName"
    | "meetingPointLat"
    | "meetingPointLng"
    | "meetingPointPlaceId"
    | "guestHasJRPass"
    | "guestHasICCard"
    | "guestNeedsTransitHelp"
    | "preEliteTravelStyle"
    | "preEliteInterests"
    | "preEliteMotivation"
    | "preElitePainPoints"
    | "chauffeurSelections"
    | "selectedTransportProducts"
  >,
  opts?: {
    cityNames?: Record<string, string>;
    hubNames?: Record<string, string>;
  }
): MultiDaySelections {
  const cityNames = opts?.cityNames || {};
  const hubNames = opts?.hubNames || {};

  const stayLocs = (state.locations || []).filter(
    (l) =>
      (!l.visitType || l.visitType === "stay") &&
      !l.isTransitHub &&
      l.cityId
  );
  const locationCityIds = stayLocs.map((l) => l.cityId);

  const hotelByCity: Record<string, string> = {};
  for (const [cityId, pref] of Object.entries(state.cityHotels || {})) {
    if (!pref?.needsHotel) continue;
    hotelByCity[cityId] = `${pref.starRating || "4-star"}`;
  }

  const ranges = calculateCityDateRanges(state.arrivalDate, stayLocs);
  const allLocs = state.locations || [];

  const locationStops: NonNullable<MultiDaySelections["locationStops"]> = [];
  for (let i = 0; i < stayLocs.length; i++) {
    const loc = stayLocs[i];
    const range = ranges[i];
    const pref = state.cityHotels?.[loc.cityId];
    let hotelArrangement: "self" | "tokiotours" | "unset" = "unset";
    let hotelStar: string | undefined;
    if (pref) {
      if (pref.needsHotel) {
        hotelArrangement = "tokiotours";
        hotelStar = String(pref.starRating || "4");
      } else {
        hotelArrangement = "self";
      }
    } else if (hotelByCity[loc.cityId]) {
      hotelArrangement = "tokiotours";
      hotelStar = hotelByCity[loc.cityId];
    }

    // Previous stop in full route (hub or prior stay) owns transit into this city
    const fullIdx = allLocs.findIndex((l) => l.key === loc.key);
    const prev =
      fullIdx > 0
        ? allLocs[fullIdx - 1]
        : i > 0
          ? stayLocs[i - 1]
          : allLocs.find((l) => l.visitType === "arrival" || l.isTransitHub) ||
            null;
    const incoming = prev ? String(prev.transitType || "unset") : "unset";

    const roomsReserved = pref?.needsHotel
      ? totalHotelRooms(pref.rooms)
      : 0;
    const hotelName = String(pref?.hotelName || "").trim();
    const hotelUrl = String(pref?.hotelUrl || "").trim();

    locationStops.push({
      cityId: loc.cityId,
      cityName: cityNames[loc.cityId] || undefined,
      nights: Math.max(0, Number(loc.nights) || 0),
      startDate: range?.startDate,
      endDate: range?.endDate,
      hotelArrangement,
      hotelStar,
      ...(hotelName ? { hotelName } : {}),
      ...(hotelUrl ? { hotelUrl } : {}),
      ...(roomsReserved && roomsReserved > 0 ? { roomsReserved } : {}),
      incomingTransitType: incoming === "unset" ? undefined : incoming,
      needsTicket: Boolean(prev?.needsTicket),
      ticketType: prev?.ticketType,
      ticketPricePerPax: prev?.ticketPricePerPax,
    });
  }

  const experienceSchedule: MultiDaySelections["experienceSchedule"] = [];
  const experienceIds: string[] = [];
  for (const [cityId, rows] of Object.entries(state.selectedTours || {})) {
    for (const row of rows || []) {
      if (!row?.tourId) continue;
      experienceIds.push(row.tourId);
      experienceSchedule.push({
        tourId: row.tourId,
        cityId,
        date: row.scheduledDate || undefined,
        language: row.selectedLanguage || undefined,
        title: String(row.title || "").trim() || undefined,
        durationHours:
          Number(row.duration_hours) > 0
            ? Number(row.duration_hours)
            : undefined,
        accessType: String(row.access_type || "").trim() || undefined,
      });
    }
  }

  const uniqueExp = Array.from(new Set(experienceIds));
  if (uniqueExp.length === 0 && state.selectedTourIds?.length) {
    uniqueExp.push(...state.selectedTourIds);
  }

  const transitByLeg: MultiDaySelections["transitByLeg"] = [];
  const localTransitByCity: MultiDaySelections["localTransitByCity"] = [];
  for (let i = 0; i < allLocs.length; i++) {
    const from = allLocs[i];
    const to = allLocs[i + 1];
    if (!from) continue;
    if (
      from.localTransitType &&
      from.localTransitType !== "unset" &&
      from.cityId &&
      !from.isTransitHub
    ) {
      localTransitByCity.push({
        cityId: from.cityId,
        localTransitType: from.localTransitType,
      });
    }
    if (!to) continue;
    if (from.transitType && from.transitType !== "unset") {
      transitByLeg.push({
        fromCityId: from.cityId,
        toCityId: to.cityId,
        transitType: from.transitType,
      });
    }
  }

  const arrivalHub = allLocs.find(
    (l) =>
      l.key === "__transit_arrival__" ||
      l.visitType === "arrival" ||
      (l.isTransitHub && l.visitType !== "departure")
  );
  const departureHub = allLocs.find(
    (l) =>
      l.key === "__transit_departure__" || l.visitType === "departure"
  );
  const arrivalHubId =
    arrivalHub?.hubId || state.arrivalTransferId || arrivalHub?.cityId || null;
  const departureHubId =
    departureHub?.hubId ||
    state.departureTransferId ||
    departureHub?.cityId ||
    null;

  const chauffeurDaysByCity = chauffeurDaysFromSelections(
    state.chauffeurSelections
  );
  const transportTickets: NonNullable<MultiDaySelections["transportTickets"]> =
    (state.selectedTransportProducts || []).map((p) => ({
      productId: p.productId,
      name: p.name,
      transportType: p.transportType,
      pricePerPerson: p.pricePerPerson,
      quantity: p.quantity,
      cityId: p.cityId,
    }));

  return {
    locationCityIds,
    hotelByCity,
    locationStops,
    experienceIds: uniqueExp,
    experienceSchedule,
    transitByLeg,
    localTransitByCity,
    chauffeurDaysByCity,
    transportTickets,
    pace: state.travelPace ?? null,
    arrivalTransferId: state.arrivalTransferId ?? null,
    departureTransferId: state.departureTransferId ?? null,
    arrivalHubLabel:
      (arrivalHubId && hubNames[arrivalHubId]) ||
      (arrivalHub?.cityId && cityNames[arrivalHub.cityId]) ||
      null,
    departureHubLabel:
      (departureHubId && hubNames[departureHubId]) ||
      (departureHub?.cityId && cityNames[departureHub.cityId]) ||
      null,
    airportPickup: Boolean(state.airportPickup),
    airportDropoff: Boolean(state.airportDropoff),
    arrivalTransitType: state.arrivalTransitType || null,
    durationDays: state.durationDays || undefined,
    experienceService: state.experienceService ?? null,
    specialNeeds: Array.isArray(state.specialNeeds)
      ? [...state.specialNeeds]
      : [],
    guestSpecialRequirements: serializeGuestSpecialRequirements(
      state.guestSpecialRequirements
    ),
    preferredTourLanguage: state.preferredTourLanguage || undefined,
    meetingPointName:
      state.meetingPointName || state.meetingPoint || undefined,
    meetingPointAddress: state.meetingPoint || undefined,
    meetingPointLat: state.meetingPointLat ?? null,
    meetingPointLng: state.meetingPointLng ?? null,
    meetingPointPlaceId: state.meetingPointPlaceId || undefined,
    guestHasJRPass: state.guestHasJRPass ?? null,
    guestHasICCard: state.guestHasICCard ?? null,
    guestNeedsTransitHelp: state.guestNeedsTransitHelp ?? null,
    preEliteTravelStyle: state.preEliteTravelStyle ?? null,
    preEliteInterests: Array.isArray(state.preEliteInterests)
      ? [...state.preEliteInterests]
      : [],
    preEliteMotivation: state.preEliteMotivation ?? null,
    preElitePainPoints: Array.isArray(state.preElitePainPoints)
      ? [...state.preElitePainPoints]
      : [],
  };
}

/** Build lightweight single-day selections from Builder S store. */
export function buildSingleDaySelections(
  state: Pick<
    SingleDayBuilderState,
    | "cityFocus"
    | "startTime"
    | "travelPace"
    | "guidePreference"
    | "selectedExperiences"
    | "tourHours"
    | "suicaNeeded"
    | "suicaValueEur"
    | "guestSpecialRequirements"
    | "guestHasJRPass"
    | "guestHasICCard"
    | "guestNeedsTransitHelp"
  > & {
    cityId?: string;
    transitOption?: string;
    preferredMovement?: string | null;
    meetingPoint?: string;
    meetingPointName?: string;
    meetingPointLat?: number | null;
    meetingPointLng?: number | null;
    meetingPointPlaceId?: string;
    preferredTourLanguage?: string;
    preEliteTravelStyle?: string | null;
    preEliteInterests?: string[];
    preEliteMotivation?: string | null;
    preElitePainPoints?: string[];
    specialNeeds?: string[];
  }
): SingleDaySelections {
  return {
    cityId: state.cityId,
    cityFocus: state.cityFocus || undefined,
    startHour: state.startTime || undefined,
    pace: state.travelPace ?? null,
    guidePreference: state.guidePreference,
    selectedExperienceIds: (state.selectedExperiences || []).map(
      (e) => e.tourId
    ),
    selectedExperiencesDetail: (state.selectedExperiences || []).map((e) => ({
      tourId: e.tourId,
      title: e.title,
      selectedLanguage: e.selectedLanguage,
      duration_hours: e.duration_hours,
      price: e.price,
      access_type: e.access_type,
      category: e.category,
      entry_type: e.entry_type,
      is_extra: e.is_extra,
      timingIntent: e.timingIntent,
      ticketDate: e.ticketDate ?? null,
      opsTimingNote: e.opsTimingNote,
    })),
    transitOption:
      state.transitOption ||
      state.preferredMovement ||
      state.guidePreference,
    suicaNeeded: Boolean(state.suicaNeeded),
    suicaValueEur: Math.max(0, Number(state.suicaValueEur) || 0),
    guestHasJRPass:
      state.guestHasJRPass === true || state.guestHasJRPass === false
        ? state.guestHasJRPass
        : null,
    guestHasICCard:
      state.guestHasICCard === true || state.guestHasICCard === false
        ? state.guestHasICCard
        : null,
    guestNeedsTransitHelp:
      state.guestNeedsTransitHelp === true ||
      state.guestNeedsTransitHelp === false
        ? state.guestNeedsTransitHelp
        : null,
    tourHours: state.tourHours,
    meetingPointName:
      state.meetingPointName || state.meetingPoint || undefined,
    meetingPointAddress: state.meetingPoint || undefined,
    meetingPointLat: state.meetingPointLat ?? null,
    meetingPointLng: state.meetingPointLng ?? null,
    meetingPointPlaceId: state.meetingPointPlaceId || undefined,
    preferredTourLanguage: state.preferredTourLanguage || undefined,
    preEliteTravelStyle: state.preEliteTravelStyle ?? null,
    preEliteInterests: Array.isArray(state.preEliteInterests)
      ? [...state.preEliteInterests]
      : [],
    preEliteMotivation: state.preEliteMotivation ?? null,
    preElitePainPoints: Array.isArray(state.preElitePainPoints)
      ? [...state.preElitePainPoints]
      : [],
    specialNeeds: Array.isArray(state.specialNeeds)
      ? [...state.specialNeeds]
      : undefined,
    guestSpecialRequirements: serializeGuestSpecialRequirements(
      state.guestSpecialRequirements
    ),
  };
}

export function primaryCityFromMultiDay(
  state: Pick<BuilderState, "locations">,
  cityNames?: Record<string, string>
): string {
  const first = state.locations?.find(
    (l) => !l.visitType || l.visitType === "stay"
  );
  if (!first) return "";
  return cityNames?.[first.cityId] || first.cityId || "";
}

const GUEST_CONTACT_SEL_KEYS = [
  "guestName",
  "fullName",
  "contactName",
  "whatsapp",
  "guestPhone",
  "contactPhone",
  "phone",
] as const;

function embedGuestContactInSelections(
  selections: Record<string, unknown>,
  guestName?: string | null,
  whatsapp?: string | null
): Record<string, unknown> {
  const name = String(guestName || "").trim();
  const phone = String(whatsapp || "").trim();
  if (name) {
    selections.guestName = name;
    selections.fullName = name;
    selections.contactName = name;
  }
  if (phone) {
    selections.whatsapp = phone;
    selections.guestPhone = phone;
    selections.contactPhone = phone;
  }
  return selections;
}

function preserveGuestContactKeys(
  next: Record<string, unknown>,
  prev: Record<string, unknown> | null | undefined
): void {
  if (!prev) return;
  for (const key of GUEST_CONTACT_SEL_KEYS) {
    const cur = String(next[key] || "").trim();
    const old = String(prev[key] || "").trim();
    if (!cur && old) next[key] = old;
  }
}

/**
 * Mirror guest fields onto `bookings` by booking_ref when a row exists.
 * Does not create a bookings row (Pre-Elite / draft paths own creation).
 */
async function syncGuestFieldsToBookings(
  pb: Awaited<ReturnType<typeof getAdminPocketBase>>,
  bookingRef: string,
  opts: {
    requirements?: GuestSpecialRequirements | null;
    fullName?: string | null;
    whatsapp?: string | null;
  }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (opts.requirements) {
    patch.guest_special_requirements = opts.requirements;
  }
  const fullName = String(opts.fullName || "").trim();
  const whatsapp = String(opts.whatsapp || "").trim();
  if (fullName) patch.full_name = fullName;
  if (whatsapp) patch.whatsapp = whatsapp;
  if (Object.keys(patch).length === 0) return;
  try {
    const row = await pb
      .collection("bookings")
      .getFirstListItem<{ id: string }>(`booking_ref="${bookingRef}"`, {
        requestKey: null,
      });
    await pb.collection("bookings").update(row.id, patch, { requestKey: null });
  } catch {
    /* no bookings row yet — BAL holds the source until Pre-Elite/create */
  }
}

/**
 * Upsert a lightweight lead/booking row by unique booking_ref.
 * First write creates with status "lead" (unless a higher status is passed).
 * Later writes PATCH the same row and never demote confirmed.
 */
export async function upsertBookingsAndLeads(
  input: BookingsAndLeadsUpsertInput
): Promise<{ ok: boolean; id?: string; created?: boolean; error?: string }> {
  const bookingRef = safeRef(input.bookingRef);
  const email = safeEmail(input.email);
  if (!bookingRef || !email) {
    return { ok: false, error: "booking_ref and email are required." };
  }

  const guests: BookingLeadGuests = {
    adults: Math.max(0, Number(input.guests?.adults) || 0),
    kids: Math.max(0, Number(input.guests?.kids) || 0),
  };

  // PocketBase treats `{}` as blank for required JSON — always send a real object.
  const selectionsPayload: Record<string, unknown> =
    input.selections &&
    typeof input.selections === "object" &&
    Object.keys(input.selections as object).length > 0
      ? { ...(input.selections as Record<string, unknown>) }
      : { _v: 1 };
  embedGuestContactInSelections(
    selectionsPayload,
    input.guestName,
    input.whatsapp
  );

  const tourDateRaw = input.tourDate ? String(input.tourDate).slice(0, 10) : "";
  const requestedStatus: BookingLeadStatus = input.status || "lead";
  const nowIso = new Date().toISOString();
  const durationNum =
    input.durationValue != null && Number.isFinite(input.durationValue)
      ? Number(input.durationValue)
      : 0;
  const primaryCity =
    String(input.primaryCity || "").trim() || "Tokyo";
  const citiesList =
    String(input.citiesList || "").trim() ||
    formatCitiesList(primaryCity, input.cityNames);
  const durationLabel =
    String(input.durationLabel || "").trim() ||
    formatDurationLabel(input.type, durationNum);

  const fields: Record<string, unknown> = {
    booking_ref: bookingRef,
    email,
    type: input.type,
    status: requestedStatus,
    source: "direct",
    primary_city: primaryCity,
    guests,
    duration_value: durationNum,
    duration_label: durationLabel,
    cities_list: citiesList,
    selections: selectionsPayload,
    dossier_pdf_url: String(input.dossierPdfUrl || "").trim(),
    last_saved_at: nowIso,
  };
  // Omit empty tour_date — PB date fields reject ""
  if (tourDateRaw) fields.tour_date = tourDateRaw;

  const mpName = String(input.meetingPointName || "").trim();
  const mpAddress = String(input.meetingPointAddress || "").trim();
  const mpPlaceId = String(input.meetingPointPlaceId || "").trim();
  if (mpName) fields.meeting_point_name = mpName;
  if (mpAddress) fields.meeting_point_address = mpAddress;
  if (mpPlaceId) fields.meeting_point_place_id = mpPlaceId;
  if (
    input.meetingPointLat != null &&
    Number.isFinite(Number(input.meetingPointLat))
  ) {
    fields.meeting_point_lat = Number(input.meetingPointLat);
  }
  if (
    input.meetingPointLng != null &&
    Number.isFinite(Number(input.meetingPointLng))
  ) {
    fields.meeting_point_lng = Number(input.meetingPointLng);
  }

  // Guest transit pass answers (also inside selections JSON)
  const selObj =
    selectionsPayload && typeof selectionsPayload === "object"
      ? (selectionsPayload as Record<string, unknown>)
      : {};
  if (selObj.guestHasJRPass === true || selObj.guestHasJRPass === false) {
    fields.guest_has_jr_pass = selObj.guestHasJRPass;
  }
  if (selObj.guestHasICCard === true || selObj.guestHasICCard === false) {
    fields.guest_has_ic_card = selObj.guestHasICCard;
  }
  if (
    selObj.guestNeedsTransitHelp === true ||
    selObj.guestNeedsTransitHelp === false
  ) {
    fields.guest_needs_transit_help = selObj.guestNeedsTransitHelp;
  }

  const guestSpecialRequirements = serializeGuestSpecialRequirements(
    input.guestSpecialRequirements ??
      selObj.guestSpecialRequirements ??
      selObj.guest_special_requirements
  );
  fields.guest_special_requirements = guestSpecialRequirements;
  // Keep a copy inside selections for older readers / local cache.
  selectionsPayload.guestSpecialRequirements = guestSpecialRequirements;
  fields.selections = selectionsPayload;

  const guestNameFromSel = String(
    input.guestName ||
      selObj.guestName ||
      selObj.fullName ||
      selObj.contactName ||
      ""
  ).trim();
  const whatsappFromSel = String(
    input.whatsapp ||
      selObj.whatsapp ||
      selObj.guestPhone ||
      selObj.contactPhone ||
      selObj.phone ||
      ""
  ).trim();

  const STATUS_RANK: Record<string, number> = {
    draft: 1,
    lead: 1,
    in_progress: 2,
    incoming: 2,
    quoted: 3,
    confirmed: 4,
    in_ops: 5,
    done: 6,
    cancelled: 0,
  };

  try {
    const pb = await getAdminPocketBase();
    let existing: {
      id: string;
      email?: string;
      status?: string;
      save_version?: number;
      email_sent_count?: number;
      first_email_sent_at?: string;
      selections?: unknown;
    } | null = null;
    try {
      // Prefer exact PNR + email; fall back to PNR-only (unique index).
      existing = await pb
        .collection("bookings_and_leads")
        .getFirstListItem(
          `booking_ref="${bookingRef}" && email="${email}"`,
          { requestKey: null }
        );
    } catch {
      try {
        existing = await pb
          .collection("bookings_and_leads")
          .getFirstListItem(`booking_ref="${bookingRef}"`, {
            requestKey: null,
          });
      } catch {
        existing = null;
      }
    }

    if (existing) {
      const existingRank = STATUS_RANK[String(existing.status || "lead")] ?? 1;
      const requestedRank = STATUS_RANK[requestedStatus] ?? 1;
      let nextStatus: string = requestedStatus;
      if (existing.status === "confirmed" && requestedStatus !== "cancelled") {
        nextStatus = "confirmed";
      } else if (requestedRank < existingRank && existing.status !== "cancelled") {
        // Don't demote (e.g. quoted → lead on a later save)
        nextStatus = String(existing.status);
      }

      // Don't wipe guest name/phone when a later autosave omits them.
      const prevSel =
        existing.selections && typeof existing.selections === "object"
          ? (existing.selections as Record<string, unknown>)
          : null;
      preserveGuestContactKeys(selectionsPayload, prevSel);
      fields.selections = selectionsPayload;

      const prevVersion = Number(existing.save_version) || 0;
      const patch: Record<string, unknown> = {
        ...fields,
        email: email || existing.email,
        status: nextStatus,
        save_version: prevVersion + 1,
      };

      if (input.recordEmailSent) {
        const prevCount = Number(existing.email_sent_count) || 0;
        patch.email_sent_count = prevCount + 1;
        patch.last_email_sent_at = nowIso;
        if (!existing.first_email_sent_at) {
          patch.first_email_sent_at = nowIso;
        }
      }

      const updated = await pb.collection("bookings_and_leads").update(
        existing.id,
        patch,
        { requestKey: null }
      );
      void syncGuestFieldsToBookings(pb, bookingRef, {
        requirements: guestSpecialRequirements,
        fullName:
          guestNameFromSel ||
          String(selectionsPayload.guestName || selectionsPayload.fullName || ""),
        whatsapp:
          whatsappFromSel ||
          String(
            selectionsPayload.whatsapp || selectionsPayload.guestPhone || ""
          ),
      });
      void syncOpsHubFromBal({
        pnr: bookingRef,
        detailId: updated.id,
        status: String(nextStatus),
        primaryCity,
        tourDate: tourDateRaw || null,
        durationDays: durationNum || null,
        guests,
        selections: selectionsPayload as BookingLeadSelections,
      });
      return { ok: true, id: updated.id, created: false };
    }

    const createFields: Record<string, unknown> = {
      ...fields,
      save_version: 1,
      email_sent_count: input.recordEmailSent ? 1 : 0,
    };
    if (input.recordEmailSent) {
      createFields.first_email_sent_at = nowIso;
      createFields.last_email_sent_at = nowIso;
    }

    const created = await pb
      .collection("bookings_and_leads")
      .create(createFields, { requestKey: null });
    void syncGuestFieldsToBookings(pb, bookingRef, {
      requirements: guestSpecialRequirements,
      fullName: guestNameFromSel,
      whatsapp: whatsappFromSel,
    });
    void syncOpsHubFromBal({
      pnr: bookingRef,
      detailId: created.id,
      status: requestedStatus,
      primaryCity,
      tourDate: tourDateRaw || null,
      durationDays: durationNum || null,
      guests,
      selections: selectionsPayload as BookingLeadSelections,
    });
    return { ok: true, id: created.id, created: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "bookings_and_leads upsert failed";
    console.warn("[bookings_and_leads]", message);
    return { ok: false, error: message };
  }
}

/**
 * Bump email audit counters for an existing PNR (Save & Email / resend).
 * Creates a minimal lead row if the builder snapshot does not exist yet.
 */
export async function recordBookingLeadEmailSent(opts: {
  bookingRef: string;
  email: string;
  type?: BookingLeadType;
  fullName?: string;
  itinerarySnippet?: Record<string, unknown>;
}): Promise<{ ok: boolean; emailSentCount?: number; error?: string }> {
  const bookingRef = safeRef(opts.bookingRef);
  const email = safeEmail(opts.email);
  if (!bookingRef || !email) {
    return { ok: false, error: "booking_ref and email are required." };
  }

  const type: BookingLeadType =
    opts.type === "single_day" ? "single_day" : "multi_day";
  const nowIso = new Date().toISOString();

  try {
    const pb = await getAdminPocketBase();
    let existing: {
      id: string;
      email_sent_count?: number;
      first_email_sent_at?: string;
      type?: string;
    } | null = null;
    try {
      existing = await pb
        .collection("bookings_and_leads")
        .getFirstListItem(`booking_ref="${bookingRef}"`, {
          requestKey: null,
        });
    } catch {
      existing = null;
    }

    if (existing) {
      const nextCount = (Number(existing.email_sent_count) || 0) + 1;
      const patch: Record<string, unknown> = {
        email_sent_count: nextCount,
        last_email_sent_at: nowIso,
        // Save & Email promotes draft → incoming (BAL stores in_progress)
        status: "in_progress",
      };
      if (!existing.first_email_sent_at) {
        patch.first_email_sent_at = nowIso;
      }
      await pb
        .collection("bookings_and_leads")
        .update(existing.id, patch, { requestKey: null });
      void syncOpsHubFromBal({
        pnr: bookingRef,
        detailId: existing.id,
        status: "incoming",
        primaryCity: "Tokyo",
      });
      try {
        const booking = await pb
          .collection("bookings")
          .getFirstListItem(`booking_ref="${bookingRef}"`, {
            requestKey: null,
          });
        await pb
          .collection("bookings")
          .update(booking.id, { status: "in_progress" }, { requestKey: null });
      } catch {
        /* pre-elite bookings row optional */
      }
      return { ok: true, emailSentCount: nextCount };
    }

    const created = await pb.collection("bookings_and_leads").create(
      {
        booking_ref: bookingRef,
        email,
        type,
        status: "in_progress",
        source: "direct",
        primary_city: "Tokyo",
        guests: { adults: 2, kids: 0 },
        duration_value: type === "single_day" ? 6 : 1,
        duration_label: formatDurationLabel(
          type,
          type === "single_day" ? 6 : 1
        ),
        cities_list: "Tokyo",
        selections: opts.itinerarySnippet || { _v: 1, source: "pre_elite" },
        save_version: 1,
        email_sent_count: 1,
        first_email_sent_at: nowIso,
        last_email_sent_at: nowIso,
        last_saved_at: nowIso,
      },
      { requestKey: null }
    );
    if (created?.id) {
      void syncOpsHubFromBal({
        pnr: bookingRef,
        detailId: created.id,
        status: "incoming",
        primaryCity: "Tokyo",
        guests: { adults: 2, kids: 0 },
      });
    }
    try {
      const booking = await pb
        .collection("bookings")
        .getFirstListItem(`booking_ref="${bookingRef}"`, {
          requestKey: null,
        });
      await pb
        .collection("bookings")
        .update(booking.id, { status: "in_progress" }, { requestKey: null });
    } catch {
      /* optional */
    }
    return {
      ok: true,
      emailSentCount: 1,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "email audit update failed";
    console.warn("[recordBookingLeadEmailSent]", message);
    return { ok: false, error: message };
  }
}

/** Lookup by PNR + email (Manage Booking credential). Case-normalized. */
export async function findBookingsAndLeads(
  bookingRef: string,
  email: string
): Promise<BookingsAndLeadsRecord | null> {
  const ref = safeRef(bookingRef);
  const mail = safeEmail(email);
  if (!ref || !mail) return null;

  try {
    const pb = await getAdminPocketBase();
    try {
      const record = await pb
        .collection("bookings_and_leads")
        .getFirstListItem(`booking_ref="${ref}" && email="${mail}"`, {
          requestKey: null,
        });
      return record as unknown as BookingsAndLeadsRecord;
    } catch {
      // PNR unique — match email case-insensitively in memory
      const byRef = await pb
        .collection("bookings_and_leads")
        .getFirstListItem(`booking_ref="${ref}"`, { requestKey: null });
      const rowEmail = String(byRef.email || "")
        .trim()
        .toLowerCase();
      if (rowEmail === mail) {
        return byRef as unknown as BookingsAndLeadsRecord;
      }
      return null;
    }
  } catch {
    return null;
  }
}

/** Lookup contact on a lead by booking ref only (Send / Print prefill). */
export async function findBookingsAndLeadsByRef(
  bookingRef: string
): Promise<BookingsAndLeadsRecord | null> {
  const ref = safeRef(bookingRef);
  if (!ref) return null;
  try {
    const pb = await getAdminPocketBase();
    const byRef = await pb
      .collection("bookings_and_leads")
      .getFirstListItem(`booking_ref="${ref}"`, { requestKey: null });
    return byRef as unknown as BookingsAndLeadsRecord;
  } catch {
    return null;
  }
}

/**
 * Expand a lightweight multi-day snapshot into a partial BuilderState patch
 * suitable for `loadSavedItinerary` (IDs only — catalogs rehydrate from PB).
 */
export function expandMultiDaySelectionsToState(
  record: BookingsAndLeadsRecord
): Record<string, unknown> {
  const sel = (record.selections || {}) as MultiDaySelections;
  const guests = record.guests || { adults: 2, kids: 0 };
  // PB date fields may return "2026-11-02 00:00:00.000Z" — the builder
  // store/calendar only accepts a bare YYYY-MM-DD (same slice+validate
  // expandSingleDaySelectionsToState applies to tour_date below).
  const tourDateRaw = String(record.tour_date || "").slice(0, 10);
  const tourDate = /^\d{4}-\d{2}-\d{2}$/.test(tourDateRaw)
    ? tourDateRaw
    : null;
  const localByCity = new Map(
    (sel.localTransitByCity || []).map((r) => [
      r.cityId,
      r.localTransitType,
    ])
  );
  const transitByFrom = new Map(
    (sel.transitByLeg || []).map((r) => [r.fromCityId, r.transitType])
  );

  // locationStops (written by buildMultiDaySelections) is authoritative
  // for per-city nights. The legacy locationCityIds-only fallback cannot
  // recover them, so it keeps the old first-city approximation.
  const savedStops = (sel.locationStops || []).filter((s) => s?.cityId);
  const locations = (
    savedStops.length > 0
      ? savedStops.map((s) => ({ cityId: s.cityId, nights: s.nights }))
      : (sel.locationCityIds || []).map((cityId, i) => ({
          cityId,
          nights:
            i === 0
              ? Math.max(0, (sel.durationDays || record.duration_value || 1) - 1)
              : 0,
        }))
  ).map(({ cityId, nights }, i, arr) => {
    const nextId = arr[i + 1]?.cityId;
    const transitRaw = nextId ? transitByFrom.get(cityId) : undefined;
    const localRaw = localByCity.get(cityId);
    return {
      key: `loc_${cityId}_${i}`,
      cityId,
      nights: Math.max(0, Math.round(Number(nights) || 0)),
      visitType: "stay" as const,
      transitType:
        transitRaw === "self" ||
        transitRaw === "public" ||
        transitRaw === "private"
          ? transitRaw
          : ("unset" as const),
      localTransitType:
        localRaw === "self" ||
        localRaw === "public" ||
        localRaw === "private"
          ? localRaw
          : ("unset" as const),
    };
  });

  const selectedTours: Record<
    string,
    Array<{
      tourId: string;
      title: string;
      duration_hours: number;
      scheduledDate: string;
      selectedLanguage: string;
      price: number;
      access_type?: string;
    }>
  > = {};
  for (const row of sel.experienceSchedule || []) {
    if (!row.tourId || !row.cityId) continue;
    const list = selectedTours[row.cityId] || [];
    list.push({
      tourId: row.tourId,
      title: String(row.title || "").trim() || row.tourId,
      duration_hours: Number(row.durationHours) || 0,
      scheduledDate: row.date || tourDate || "",
      selectedLanguage: row.language || "",
      price: 0,
      access_type: row.accessType,
    });
    selectedTours[row.cityId] = list;
  }

  // Hotel prefs live on locationStops — restore them so a retrieved
  // booking does not fall back to "no hotel preference" per city.
  const cityHotels: Record<string, unknown> = {};
  for (const stop of savedStops) {
    if (stop.hotelArrangement !== "self" && stop.hotelArrangement !== "tokiotours") {
      continue;
    }
    const star = Number(stop.hotelStar);
    cityHotels[stop.cityId] = {
      cityId: stop.cityId,
      needsHotel: stop.hotelArrangement === "tokiotours",
      starRating: star === 3 || star === 5 ? star : 4,
      rooms: {
        standard: Math.max(0, Math.round(Number(stop.roomsReserved) || 0)),
        twin: 0,
        superior: 0,
      },
      standardOccupancy: 2,
      breakfast: true,
      ...(stop.hotelName ? { hotelName: stop.hotelName } : {}),
      ...(stop.hotelUrl ? { hotelUrl: stop.hotelUrl } : {}),
    };
  }

  return {
    tripMode: "multi_day",
    adults: Math.max(1, Number(guests.adults) || 1),
    children: Math.max(0, Number(guests.kids) || 0),
    arrivalDate: tourDate,
    durationDays: sel.durationDays || record.duration_value || 1,
    locations,
    ...(Object.keys(cityHotels).length > 0 ? { cityHotels } : {}),
    ...(typeof sel.airportPickup === "boolean"
      ? { airportPickup: sel.airportPickup }
      : {}),
    ...(typeof sel.airportDropoff === "boolean"
      ? { airportDropoff: sel.airportDropoff }
      : {}),
    ...(sel.arrivalTransitType
      ? { arrivalTransitType: sel.arrivalTransitType }
      : {}),
    selectedTours,
    selectedTourIds: sel.experienceIds || [],
    travelPace: sel.pace ?? null,
    arrivalTransferId: sel.arrivalTransferId ?? null,
    departureTransferId: sel.departureTransferId ?? null,
    experienceService: sel.experienceService ?? "tailored",
    chauffeurSelections: migrateLegacyChauffeurDays(sel.chauffeurDaysByCity),
    selectedTransportProducts: (sel.transportTickets || []).map((t) => ({
      productId: t.productId,
      name: t.name,
      transportType: t.transportType,
      pricePerPerson: Number(t.pricePerPerson) || 0,
      quantity: Number(t.quantity) || 1,
      cityId: t.cityId,
    })),
    guestHasJRPass:
      sel.guestHasJRPass === true || sel.guestHasJRPass === false
        ? sel.guestHasJRPass
        : null,
    guestHasICCard:
      sel.guestHasICCard === true || sel.guestHasICCard === false
        ? sel.guestHasICCard
        : null,
    guestNeedsTransitHelp:
      sel.guestNeedsTransitHelp === true ||
      sel.guestNeedsTransitHelp === false
        ? sel.guestNeedsTransitHelp
        : null,
    // Travel Brief fields — only when the saved lead carries them, so a
    // brief saved in the dossier survives a fresh Retrieve/hydrate and an
    // older lead never clobbers a locally persisted brief.
    ...(sel.preEliteTravelStyle
      ? { preEliteTravelStyle: sel.preEliteTravelStyle }
      : {}),
    ...(Array.isArray(sel.preEliteInterests) && sel.preEliteInterests.length
      ? { preEliteInterests: [...sel.preEliteInterests] }
      : {}),
    ...(sel.preEliteMotivation
      ? { preEliteMotivation: sel.preEliteMotivation }
      : {}),
    ...(Array.isArray(sel.preElitePainPoints) && sel.preElitePainPoints.length
      ? { preElitePainPoints: [...sel.preElitePainPoints] }
      : {}),
    ...(sel.preferredTourLanguage
      ? { preferredTourLanguage: sel.preferredTourLanguage }
      : {}),
    // Dietary/mobility may live in BAL top-level column, selections, or
    // legacy specialNeeds — check all (bookings column is mirrored to BAL
    // top-level on upsert). Server-saved serialized No/No is an explicit
    // answer, so carry acked=true or mergePersistedBuilderState's
    // migrateUnset would erase it back to null ("None specified").
    ...(() => {
      const raw =
        record.guest_special_requirements ?? sel.guestSpecialRequirements;
      if (raw != null) {
        const reqs = normalizeGuestSpecialRequirements(raw);
        return {
          guestSpecialRequirements: reqs,
          guestSpecialRequirementsAcked:
            guestSpecialRequirementsChoicesComplete(reqs),
        };
      }
      if (Array.isArray(sel.specialNeeds) && sel.specialNeeds.length > 0) {
        const reqs = guestReqsFromLegacySpecialNeeds(sel.specialNeeds);
        return {
          guestSpecialRequirements: reqs,
          guestSpecialRequirementsAcked:
            guestSpecialRequirementsChoicesComplete(reqs),
        };
      }
      return {};
    })(),
    confirmedBookingRef: record.booking_ref,
    bookingStatus:
      record.status === "confirmed"
        ? "confirmed"
        : record.status === "lead"
          ? "draft"
          : "in_progress",
  };
}

/** Expand single-day lead into a patch for `useSingleDayBuilderStore`. */
export function expandSingleDaySelectionsToState(
  record: BookingsAndLeadsRecord
): Record<string, unknown> {
  const sel = (record.selections || {}) as SingleDaySelections;
  const guests = record.guests || { adults: 2, kids: 0 };
  // PB date fields may return "2026-11-01 00:00:00.000Z" — the builder
  // calendar (`TripRangeMiniCalendar`, DatePickerField) only accepts a
  // bare YYYY-MM-DD, so always slice to the date part.
  const tourDateRaw = String(record.tour_date || "").slice(0, 10);
  const tourDate = /^\d{4}-\d{2}-\d{2}$/.test(tourDateRaw)
    ? tourDateRaw
    : null;
  const tourHoursRaw = Math.round(
    Number(sel.tourHours) || Number(record.duration_value) || 6
  );
  const tourHours = Math.max(5, Math.min(10, tourHoursRaw));
  const startRaw = String(sel.startHour || "09:00").slice(0, 5);
  const row = record as unknown as Record<string, unknown>;
  const meetingPointName =
    sel.meetingPointName ||
    (typeof row.meeting_point_name === "string"
      ? row.meeting_point_name
      : undefined);
  const meetingPointAddress =
    sel.meetingPointAddress ||
    (typeof row.meeting_point_address === "string"
      ? row.meeting_point_address
      : undefined);
  // Dietary/mobility sources (in priority order): BAL top-level column
  // (mirror of bookings.guest_special_requirements on upsert), then
  // selections, then legacy specialNeeds ids. A present serialized
  // No/No object is an explicit answer — acked must travel with it or
  // downstream migrateUnset (persist merge / single-day hydrate) erases
  // it to null and the dossier reads "None specified".
  const guestReqsRaw =
    record.guest_special_requirements ?? sel.guestSpecialRequirements;
  const guestReqs =
    guestReqsRaw != null
      ? normalizeGuestSpecialRequirements(guestReqsRaw)
      : Array.isArray(sel.specialNeeds) && sel.specialNeeds.length > 0
        ? guestReqsFromLegacySpecialNeeds(sel.specialNeeds)
        : normalizeGuestSpecialRequirements(guestReqsRaw);
  const guestReqsAcked =
    guestSpecialRequirementsChoicesComplete(guestReqs);
  return {
    tourDate,
    adults: Math.max(1, Number(guests.adults) || 1),
    children: Math.max(0, Number(guests.kids) || 0),
    cityFocus: sel.cityFocus || record.primary_city || "",
    startTime: /^\d{2}:\d{2}$/.test(startRaw) ? startRaw : "09:00",
    tourHours,
    tourHoursCustom: !(tourHours === 6 || tourHours === 8),
    needsAgentConfirmation: tourHours >= 9,
    travelPace: sel.pace ?? null,
    guidePreference: sel.guidePreference || "private_guide",
    preferredMovement:
      sel.transitOption === "walk" ||
      sel.transitOption === "subway" ||
      sel.transitOption === "private_driver" ||
      sel.transitOption === "mix"
        ? sel.transitOption
        : null,
    suicaNeeded: Boolean(sel.suicaNeeded),
    suicaValueEur:
      typeof sel.suicaValueEur === "number" && sel.suicaValueEur > 0
        ? sel.suicaValueEur
        : 15,
    guestHasJRPass:
      sel.guestHasJRPass === true || sel.guestHasJRPass === false
        ? sel.guestHasJRPass
        : null,
    guestHasICCard:
      sel.guestHasICCard === true || sel.guestHasICCard === false
        ? sel.guestHasICCard
        : sel.suicaNeeded === true
          ? false
          : null,
    guestNeedsTransitHelp:
      sel.guestNeedsTransitHelp === true ||
      sel.guestNeedsTransitHelp === false
        ? sel.guestNeedsTransitHelp
        : sel.suicaNeeded === true
          ? true
          : null,
    selectedExperiences: (() => {
      const detail = Array.isArray(sel.selectedExperiencesDetail)
        ? sel.selectedExperiencesDetail
        : [];
      if (detail.length > 0) {
        return detail.map((e) => ({
          tourId: e.tourId,
          title: e.title || "",
          selectedLanguage: e.selectedLanguage || "",
          duration_hours: Number(e.duration_hours) || 0,
          price: e.price,
          access_type: e.access_type,
          category: e.category,
          entry_type: e.entry_type,
          is_extra: e.is_extra,
          timingIntent: e.timingIntent as
            | "during_tour"
            | "after_tour"
            | "other_day"
            | undefined,
          ticketDate: e.ticketDate ?? null,
          opsTimingNote: e.opsTimingNote,
        }));
      }
      return (sel.selectedExperienceIds || []).map((tourId) => ({
        tourId,
        title: "",
        selectedLanguage: "",
        duration_hours: 0,
      }));
    })(),
    // Meeting / language / guest-reqs live in selections (mirrored by
    // buildSingleDaySelections) — without these the restored builder
    // leaves the Meeting + Guests & Pace steps permanently incomplete.
    meetingPoint: meetingPointAddress || meetingPointName || "",
    meetingPointName: meetingPointName || meetingPointAddress || "",
    meetingPointLat:
      typeof sel.meetingPointLat === "number"
        ? sel.meetingPointLat
        : typeof row.meeting_point_lat === "number"
          ? row.meeting_point_lat
          : null,
    meetingPointLng:
      typeof sel.meetingPointLng === "number"
        ? sel.meetingPointLng
        : typeof row.meeting_point_lng === "number"
          ? row.meeting_point_lng
          : null,
    meetingPointPlaceId:
      sel.meetingPointPlaceId ||
      (typeof row.meeting_point_place_id === "string"
        ? row.meeting_point_place_id
        : ""),
    meetingLogisticsConfirmed: Boolean(
      meetingPointName || meetingPointAddress
    ),
    preferredTourLanguage: sel.preferredTourLanguage || "EN",
    guestSpecialRequirements: guestReqs,
    guestSpecialRequirementsAcked: guestReqsAcked,
    // Travel Brief (Pre-Elite) fields — only when the saved lead actually
    // carries them, so an older lead without a brief never clobbers a
    // locally persisted one on restore/hydrate.
    ...(sel.preEliteTravelStyle
      ? { preEliteTravelStyle: sel.preEliteTravelStyle }
      : {}),
    ...(Array.isArray(sel.preEliteInterests) && sel.preEliteInterests.length
      ? { preEliteInterests: [...sel.preEliteInterests] }
      : {}),
    ...(sel.preEliteMotivation
      ? { preEliteMotivation: sel.preEliteMotivation }
      : {}),
    ...(Array.isArray(sel.preElitePainPoints) && sel.preElitePainPoints.length
      ? { preElitePainPoints: [...sel.preElitePainPoints] }
      : {}),
    experiencesStepDone:
      (Array.isArray(sel.selectedExperiencesDetail) &&
        sel.selectedExperiencesDetail.length > 0) ||
      (Array.isArray(sel.selectedExperienceIds) &&
        sel.selectedExperienceIds.length > 0),
  };
}
