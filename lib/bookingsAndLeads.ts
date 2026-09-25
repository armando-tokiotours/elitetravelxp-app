/**
 * Lightweight PocketBase `bookings_and_leads` sync layer.
 * Stores PNR + email + ID snapshots — never full catalog blobs.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import type { BuilderState } from "@/store/useBuilderStore";
import type { SingleDayBuilderState } from "@/store/useSingleDayBuilderStore";

export type BookingLeadType = "multi_day" | "single_day";

export type BookingLeadStatus =
  | "lead"
  | "in_progress"
  | "quoted"
  | "confirmed"
  | "cancelled";

export interface BookingLeadGuests {
  adults: number;
  kids: number;
}

/** Multi-day: foreign keys + prefs only */
export interface MultiDaySelections {
  locationCityIds: string[];
  hotelByCity: Record<string, string>;
  experienceIds: string[];
  experienceSchedule?: Array<{
    tourId: string;
    cityId: string;
    date?: string;
    language?: string;
  }>;
  transitByLeg?: Array<{
    fromCityId: string;
    toCityId: string;
    transitType: string;
  }>;
  pace?: string | null;
  arrivalTransferId?: string | null;
  departureTransferId?: string | null;
  durationDays?: number;
  experienceService?: string | null;
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
  selections: BookingLeadSelections;
  dossierPdfUrl?: string | null;
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
  selections: BookingLeadSelections;
  dossier_pdf_url?: string;
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
    | "durationDays"
    | "experienceService"
  >
): MultiDaySelections {
  const locationCityIds = (state.locations || [])
    .map((l) => l.cityId)
    .filter(Boolean);

  const hotelByCity: Record<string, string> = {};
  for (const [cityId, pref] of Object.entries(state.cityHotels || {})) {
    if (!pref?.needsHotel) continue;
    // Compact hotel preference key (no full accommodation blob)
    hotelByCity[cityId] = `${pref.starRating || "4-star"}`;
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
      });
    }
  }

  const uniqueExp = Array.from(new Set(experienceIds));
  if (uniqueExp.length === 0 && state.selectedTourIds?.length) {
    uniqueExp.push(...state.selectedTourIds);
  }

  const transitByLeg: MultiDaySelections["transitByLeg"] = [];
  const locs = state.locations || [];
  for (let i = 0; i < locs.length; i++) {
    const from = locs[i];
    const to = locs[i + 1];
    if (!from || !to) continue;
    if (from.transitType && from.transitType !== "unset") {
      transitByLeg.push({
        fromCityId: from.cityId,
        toCityId: to.cityId,
        transitType: from.transitType,
      });
    }
  }

  return {
    locationCityIds,
    hotelByCity,
    experienceIds: uniqueExp,
    experienceSchedule,
    transitByLeg,
    pace: state.travelPace ?? null,
    arrivalTransferId: state.arrivalTransferId ?? null,
    departureTransferId: state.departureTransferId ?? null,
    durationDays: state.durationDays || undefined,
    experienceService: state.experienceService ?? null,
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

  const fields: Record<string, unknown> = {
    booking_ref: bookingRef,
    email,
    type: input.type,
    status: requestedStatus,
    primary_city: String(input.primaryCity || "").trim() || "Tokyo",
    guests,
    duration_value:
      input.durationValue != null && Number.isFinite(input.durationValue)
        ? Number(input.durationValue)
        : 0,
    selections: selectionsPayload,
    dossier_pdf_url: String(input.dossierPdfUrl || "").trim(),
  };
  // Omit empty tour_date — PB date fields reject ""
  if (tourDateRaw) fields.tour_date = tourDateRaw;

  const STATUS_RANK: Record<string, number> = {
    lead: 1,
    in_progress: 2,
    quoted: 3,
    confirmed: 4,
    cancelled: 0,
  };

  try {
    const pb = await getAdminPocketBase();
    let existing: { id: string; email?: string; status?: string } | null =
      null;
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

      const updated = await pb.collection("bookings_and_leads").update(
        existing.id,
        {
          ...fields,
          email: email || existing.email,
          status: nextStatus,
        },
        { requestKey: null }
      );
      return { ok: true, id: updated.id, created: false };
    }

    const created = await pb
      .collection("bookings_and_leads")
      .create(fields, { requestKey: null });
    return { ok: true, id: created.id, created: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "bookings_and_leads upsert failed";
    console.warn("[bookings_and_leads]", message);
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

/**
 * Expand a lightweight multi-day snapshot into a partial BuilderState patch
 * suitable for `loadSavedItinerary` (IDs only — catalogs rehydrate from PB).
 */
export function expandMultiDaySelectionsToState(
  record: BookingsAndLeadsRecord
): Record<string, unknown> {
  const sel = (record.selections || {}) as MultiDaySelections;
  const guests = record.guests || { adults: 2, kids: 0 };
  const locations = (sel.locationCityIds || []).map((cityId, i) => ({
    key: `loc_${cityId}_${i}`,
    cityId,
    nights: i === 0 ? Math.max(0, (sel.durationDays || 1) - 1) : 0,
    visitType: "stay" as const,
    transitType: "unset" as const,
  }));

  const selectedTours: Record<
    string,
    Array<{
      tourId: string;
      title: string;
      duration_hours: number;
      scheduledDate: string;
      selectedLanguage: string;
      price: number;
    }>
  > = {};
  for (const row of sel.experienceSchedule || []) {
    if (!row.tourId || !row.cityId) continue;
    const list = selectedTours[row.cityId] || [];
    list.push({
      tourId: row.tourId,
      title: "",
      duration_hours: 0,
      scheduledDate: row.date || record.tour_date || "",
      selectedLanguage: row.language || "",
      price: 0,
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
