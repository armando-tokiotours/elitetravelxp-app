/**
 * Tokenized vendor dispatch portals (guide / driver / ticketer).
 * Never include financials, margins, or unrelated vendor data.
 */

import { randomBytes } from "crypto";
import type PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  loadOpsGuestRequirements,
  type OpsGuestRequirements,
} from "@/lib/opsGuestRequirements";
import {
  normalizeGuideConfirmStatus,
  guideConfirmStaffLabel,
} from "@/lib/guideConfirmStatus";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import type { OpsTicketsRow } from "@/lib/opsTickets";

export type VendorRole = "guide" | "driver" | "ticketer" | "concierge";

export type VendorDispatchToken = {
  id: string;
  token: string;
  pnr: string;
  ops_hub_id?: string;
  vendor_role: VendorRole | string;
  created_by?: string;
  expires_at?: string;
  revoked?: boolean;
};

export function newVendorDispatchToken(): string {
  return randomBytes(24).toString("hex");
}

export async function createVendorDispatchToken(
  pb: PocketBase,
  input: {
    pnr: string;
    opsHubId: string;
    vendorRole: VendorRole;
    createdBy?: string | null;
    /** Days until expiry (default 30). */
    ttlDays?: number;
  }
): Promise<{ token: string; urlPath: string; record: VendorDispatchToken }> {
  const pnr = String(input.pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
  if (!pnr) throw new Error("PNR required");
  const token = newVendorDispatchToken();
  const ttl = Math.max(1, Number(input.ttlDays) || 30);
  const expires = new Date();
  expires.setDate(expires.getDate() + ttl);
  const expiresAt = expires.toISOString().slice(0, 10);

  const record = (await pb.collection("vendor_dispatch_tokens").create(
    {
      token,
      pnr,
      ops_hub_id: input.opsHubId,
      vendor_role: input.vendorRole,
      created_by: String(input.createdBy || "").trim(),
      expires_at: expiresAt,
      revoked: false,
    },
    { requestKey: null }
  )) as unknown as VendorDispatchToken;

  const urlPath = `/portal/${
    input.vendorRole === "ticketer"
      ? "tickets"
      : input.vendorRole === "concierge"
        ? "concierge"
        : input.vendorRole
  }/${token}`;
  return { token, urlPath, record };
}

function isTokenValid(row: VendorDispatchToken): boolean {
  if (row.revoked) return false;
  const exp = String(row.expires_at || "").slice(0, 10);
  if (!exp) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${exp}T12:00:00`);
  return !Number.isNaN(end.getTime()) && end.getTime() >= today.getTime();
}

export type GuideVendorView = {
  role: "guide";
  pnr: string;
  date: string;
  guestNames: string;
  partySize: string;
  language: string;
  dayItinerary: string[];
  meetingPoint: string;
  emergencyPhone: string;
  mobilityNotes: string;
  guideStatus: string;
};

export type DriverVendorView = {
  role: "driver";
  pnr: string;
  date: string;
  pickupTime: string;
  flightRef: string;
  hotelName: string;
  hotelAddress: string;
  passengerCount: string;
  luggageHint: string;
  vehicleType: string;
};

export type TicketerVendorView = {
  role: "ticketer";
  pnr: string;
  ticketLines: Array<{
    title: string;
    accessType: string;
    dateHint: string;
  }>;
  paxCount: string;
  passportNamesNeeded: boolean;
  notes: string;
};

export type ConciergeVendorView = {
  role: "concierge";
  pnr: string;
  city: string;
  partySize: string;
  startDate: string;
  endDate: string;
  pickupDetails: string;
  guestName: string;
  mobilityNotes: string;
  language: string;
  dayItinerary: string[];
  meetingPoint: string;
  jrPass: boolean | null;
  suicaCount: number | null;
  ticketDetails: string;
  totalPrice: string;
  paymentStatus: string;
  assignmentStatus: string;
};

export type VendorViewPayload =
  | GuideVendorView
  | DriverVendorView
  | TicketerVendorView
  | ConciergeVendorView;

export async function loadVendorViewByToken(
  tokenRaw: string
): Promise<
  | { ok: true; view: VendorViewPayload }
  | { ok: false; error: string; status: number }
> {
  const token = String(tokenRaw || "").trim();
  if (!token || token.length < 16) {
    return { ok: false, error: "Invalid token", status: 400 };
  }

  const pb = await getAdminPocketBase();
  let row: VendorDispatchToken;
  try {
    row = await pb
      .collection("vendor_dispatch_tokens")
      .getFirstListItem<VendorDispatchToken>(`token="${token.replace(/"/g, "")}"`, {
        requestKey: null,
      });
  } catch {
    return { ok: false, error: "Dispatch link not found", status: 404 };
  }

  if (!isTokenValid(row)) {
    return { ok: false, error: "Dispatch link expired or revoked", status: 410 };
  }

  const pnr = String(row.pnr || "")
    .trim()
    .toUpperCase();
  const role = String(row.vendor_role || "").toLowerCase() as VendorRole;

  let hub: OpsHubRow;
  try {
    hub = await pb.collection("ops_hub").getFirstListItem<OpsHubRow>(
      `pnr="${pnr}"`,
      { requestKey: null }
    );
  } catch {
    return { ok: false, error: "Booking not found", status: 404 };
  }

  let dispatch: OpsDispatchRow | undefined;
  try {
    dispatch = await pb
      .collection("ops_dispatch")
      .getFirstListItem<OpsDispatchRow>(`pnr="${pnr}"`, { requestKey: null });
  } catch {
    dispatch = undefined;
  }

  let tickets: OpsTicketsRow | undefined;
  try {
    tickets = await pb
      .collection("ops_tickets")
      .getFirstListItem<OpsTicketsRow>(`pnr="${pnr}"`, { requestKey: null });
  } catch {
    tickets = undefined;
  }

  let reqs: OpsGuestRequirements | null = null;
  try {
    reqs = await loadOpsGuestRequirements(pb, hub);
  } catch {
    reqs = null;
  }

  const date =
    String(hub.tour_date || "").slice(0, 10) ||
    reqs?.arrivalDateLabel ||
    "—";
  const party = hub.guest_summary ||
    (reqs
      ? `${reqs.adults} adults${reqs.children ? `, ${reqs.children} children` : ""}`
      : "—");

  if (role === "guide") {
    const guideStatus = normalizeGuideConfirmStatus(dispatch?.guide_mode, {
      boardVisible: Boolean(dispatch?.guide_board_visible),
      assignedGuideId: dispatch?.assigned_guide_id,
      guideResponse: dispatch?.guide_response,
    });
    const itinerary: string[] = [];
    if (reqs?.tourTitle && reqs.tourTitle !== "—") {
      itinerary.push(
        `${reqs.tourTitle}${reqs.startTime && reqs.startTime !== "—" ? ` · ${reqs.startTime}` : ""}`
      );
    }
    for (const stop of reqs?.itineraryStops || []) {
      itinerary.push(
        `${stop.cityName}${stop.dateLabel ? ` · ${stop.dateLabel}` : ""}${
          stop.nights ? ` · ${stop.nights}n` : ""
        }`
      );
    }
    if (!itinerary.length) itinerary.push("Itinerary details pending");

    const meeting =
      [reqs?.meetingPointName, reqs?.meetingPointAddress]
        .filter(Boolean)
        .join(" — ") || "Confirm meeting point with Ops";

    return {
      ok: true,
      view: {
        role: "guide",
        pnr,
        date,
        guestNames: reqs?.guestName || "Guest party",
        partySize: party,
        language: reqs?.tourLanguage || "—",
        dayItinerary: itinerary,
        meetingPoint: meeting,
        emergencyPhone: "+81 (Ops will confirm on assignment)",
        mobilityNotes: reqs?.specialMobility || reqs?.specialNotes || "None noted",
        guideStatus: guideConfirmStaffLabel(guideStatus),
      },
    };
  }

  if (role === "driver") {
    const firstStay = reqs?.itineraryStops?.[0];
    return {
      ok: true,
      view: {
        role: "driver",
        pnr,
        date,
        pickupTime: reqs?.startTime && reqs.startTime !== "—" ? reqs.startTime : "TBD",
        flightRef: "See Ops / guest flight details when provided",
        hotelName: firstStay?.hotelLabel || firstStay?.cityName || "TBD",
        hotelAddress:
          firstStay?.incomingBullets?.join(" · ") ||
          reqs?.routeTimeline?.arrivalHubLabel ||
          "Address TBD",
        passengerCount: party,
        luggageHint: "Confirm luggage with Ops if oversized",
        vehicleType: "Assigned vehicle — see chauffeur dispatch",
      },
    };
  }

  if (role === "ticketer") {
    const lines = (reqs?.accessLines || []).map((l) => ({
      title: l.title,
      accessType: l.label || l.accessType,
      dateHint: date,
    }));
    return {
      ok: true,
      view: {
        role: "ticketer",
        pnr,
        ticketLines: lines.length
          ? lines
          : [
              {
                title: "No catalog ticket lines yet",
                accessType: "—",
                dateHint: date,
              },
            ],
        paxCount: party,
        passportNamesNeeded: lines.some((l) =>
          /rail|shinkansen|passport/i.test(`${l.title} ${l.accessType}`)
        ),
        notes: String(tickets?.ticket_notes || "").trim() || "—",
      },
    };
  }

  if (role === "concierge") {
    const itinerary: string[] = [];
    if (reqs?.tourTitle && reqs.tourTitle !== "—") {
      itinerary.push(reqs.tourTitle);
    }
    for (const stop of reqs?.itineraryStops || []) {
      itinerary.push(
        `${stop.cityName}${stop.dateLabel ? ` · ${stop.dateLabel}` : ""}`
      );
    }
    const endDate =
      String(hub.end_date || "").slice(0, 10) ||
      reqs?.itineraryStops?.at(-1)?.endDate ||
      date;
    const ticketDetails =
      (reqs?.accessLines || [])
        .map((l) => `${l.title} (${l.label || l.accessType})`)
        .join(" · ") || "Standard metro";

    return {
      ok: true,
      view: {
        role: "concierge",
        pnr,
        city: hub.primary_city || reqs?.itineraryStops?.[0]?.cityName || "Japan",
        partySize: party,
        startDate: date,
        endDate,
        pickupDetails:
          reqs?.routeTimeline?.arrivalHubLabel ||
          reqs?.startTime ||
          "Not set",
        guestName: reqs?.guestName || "Guest party",
        mobilityNotes:
          reqs?.specialMobility || reqs?.specialNotes || "None",
        language: reqs?.tourLanguage || "English",
        dayItinerary: itinerary.length ? itinerary : ["Itinerary pending"],
        meetingPoint:
          [reqs?.meetingPointName, reqs?.meetingPointAddress]
            .filter(Boolean)
            .join(" — ") || "—",
        jrPass: reqs?.guestHasJRPass ?? null,
        suicaCount:
          reqs?.guestHasICCard === true
            ? 0
            : reqs?.guestHasICCard === false
              ? Math.max(1, Number(reqs?.adults || 0) + Number(reqs?.children || 0))
              : null,
        ticketDetails,
        // Concierge-only financial snapshot (no margin / net cost)
        totalPrice: "See Bookings & Leads / invoice record",
        paymentStatus: hub.payment_confirmed ? "Confirmed" : "Pending",
        assignmentStatus: String(hub.status || "incoming"),
      },
    };
  }

  return { ok: false, error: "Unknown vendor role", status: 400 };
}

/** When all ops checklist items are true → promote to in_ops. */
export async function maybePromoteToInOps(
  pb: PocketBase,
  hub: Pick<
    OpsHubRow,
    "id" | "status" | "payment_confirmed" | "client_briefing_sent"
  > & { ticketStatus?: string; guideAccepted?: boolean }
): Promise<string | null> {
  const payment = Boolean(hub.payment_confirmed);
  const guide = Boolean(hub.guideAccepted);
  const tickets =
    hub.ticketStatus === "done" || hub.ticketStatus === "ordered";
  const briefing = Boolean(hub.client_briefing_sent);
  if (!(payment && guide && tickets && briefing)) return null;
  const status = String(hub.status || "").toLowerCase();
  if (status === "in_ops" || status === "done" || status === "cancelled") {
    return null;
  }
  await pb.collection("ops_hub").update(
    hub.id,
    { status: "in_ops" },
    { requestKey: null }
  );
  return "in_ops";
}
