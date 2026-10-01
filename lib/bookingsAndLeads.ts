/**
 * Lightweight PocketBase `bookings_and_leads` sync layer.
 * Stores PNR + email + ID snapshots — never full catalog blobs.
 */

import {
  formatCitiesList,
  formatDurationLabel,
} from "@/lib/bookingLeadAudit";
import { chauffeurDaysFromSelections, migrateLegacyChauffeurDays } from "@/lib/chauffeurSelections";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import type { BuilderState } from "@/store/useBuilderStore";
import type { SingleDayBuilderState } from "@/store/useSingleDayBuilderStore";
import { calculateCityDateRanges } from "@/lib/dateCascade";

export type BookingLeadType = "multi_day" | "single_day";

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
  /** Public transit pass questionnaire — Tours step + Ticketer */
  guestHasJRPass?: boolean | null;
  guestHasICCard?: boolean | null;
  guestNeedsTransitHelp?: boolean | null;
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
  transitOption?: string;
  tourHours?: number;
  meetingPointName?: string;
  meetingPointAddress?: string;
  meetingPointLat?: number | null;
  meetingPointLng?: number | null;
  meetingPointPlaceId?: string;
  preferredTourLanguage?: string;
}

export type BookingLeadSelections =
  | MultiDaySelections
  | SingleDaySelections;

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
}): void {
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
    | "guestHasJRPass"
    | "guestHasICCard"
    | "guestNeedsTransitHelp"
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

    locationStops.push({
      cityId: loc.cityId,
      cityName: cityNames[loc.cityId] || undefined,
      nights: Math.max(0, Number(loc.nights) || 0),
      startDate: range?.startDate,
      endDate: range?.endDate,
      hotelArrangement,
      hotelStar,
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
    guestHasJRPass: state.guestHasJRPass ?? null,
    guestHasICCard: state.guestHasICCard ?? null,
    guestNeedsTransitHelp: state.guestNeedsTransitHelp ?? null,
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
    transitOption:
      state.transitOption ||
      state.preferredMovement ||
      state.guidePreference,
    tourHours: state.tourHours,
    meetingPointName:
      state.meetingPointName || state.meetingPoint || undefined,
    meetingPointAddress: state.meetingPoint || undefined,
    meetingPointLat: state.meetingPointLat ?? null,
    meetingPointLng: state.meetingPointLng ?? null,
    meetingPointPlaceId: state.meetingPointPlaceId || undefined,
    preferredTourLanguage: state.preferredTourLanguage || undefined,
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
  const selectionsPayload =
    input.selections &&
    typeof input.selections === "object" &&
    Object.keys(input.selections as object).length > 0
      ? input.selections
      : { _v: 1 };

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
      void syncOpsHubFromBal({
        pnr: bookingRef,
        detailId: updated.id,
        status: String(nextStatus),
        primaryCity,
        tourDate: tourDateRaw || null,
        durationDays: durationNum || null,
        guests,
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
    void syncOpsHubFromBal({
      pnr: bookingRef,
      detailId: created.id,
      status: requestedStatus,
      primaryCity,
      tourDate: tourDateRaw || null,
      durationDays: durationNum || null,
      guests,
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
  const localByCity = new Map(
    (sel.localTransitByCity || []).map((r) => [
      r.cityId,
      r.localTransitType,
    ])
  );
  const transitByFrom = new Map(
    (sel.transitByLeg || []).map((r) => [r.fromCityId, r.transitType])
  );

  const locations = (sel.locationCityIds || []).map((cityId, i, arr) => {
    const nextId = arr[i + 1];
    const transitRaw = nextId ? transitByFrom.get(cityId) : undefined;
    const localRaw = localByCity.get(cityId);
    return {
      key: `loc_${cityId}_${i}`,
      cityId,
      nights: i === 0 ? Math.max(0, (sel.durationDays || 1) - 1) : 0,
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
      scheduledDate: row.date || record.tour_date || "",
      selectedLanguage: row.language || "",
      price: 0,
      access_type: row.accessType,
    });
    selectedTours[row.cityId] = list;
  }

  return {
    tripMode: "multi_day",
    adults: guests.adults,
    children: guests.kids,
    arrivalDate: record.tour_date || null,
    durationDays: sel.durationDays || record.duration_value || 1,
    locations,
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
  return {
    tourDate: record.tour_date || null,
    adults: guests.adults,
    children: guests.kids,
    cityFocus: sel.cityFocus || record.primary_city || "",
    startTime: sel.startHour || "09:00",
    tourHours: sel.tourHours || record.duration_value || 6,
    travelPace: sel.pace ?? null,
    guidePreference: sel.guidePreference || "private_guide",
    selectedExperiences: (sel.selectedExperienceIds || []).map((tourId) => ({
      tourId,
      title: "",
      selectedLanguage: "",
      duration_hours: 0,
    })),
  };
}
