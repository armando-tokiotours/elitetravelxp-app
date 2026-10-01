import { NextResponse } from "next/server";
import {
  isTempBookingRef,
  isValidBookingPNR,
  normalizeBookingPNR,
} from "@/utils/pnr";
import {
  upsertBookingsAndLeads,
  type BookingLeadStatus,
  type BookingLeadType,
  type BookingLeadSelections,
} from "@/lib/bookingsAndLeads";

/**
 * POST /api/bookings-and-leads/upsert
 * Lightweight PNR + email snapshot sync (Builder M / Builder S).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const bookingRef = normalizeBookingPNR(
      String(body?.bookingRef || body?.booking_ref || body?.pnr || "")
    );
    const email = String(body?.email || body?.contactEmail || "")
      .trim()
      .toLowerCase();
    const type = String(body?.type || "") as BookingLeadType;
    const status = (body?.status as BookingLeadStatus | undefined) || "lead";
    const primaryCity = String(body?.primaryCity || body?.primary_city || "").trim();
    const tourDate = body?.tourDate ?? body?.tour_date ?? null;
    const durationValue = Number(body?.durationValue ?? body?.duration_value);
    const durationLabel = String(
      body?.durationLabel || body?.duration_label || ""
    ).trim();
    const citiesList = String(
      body?.citiesList || body?.cities_list || ""
    ).trim();
    const cityNames = Array.isArray(body?.cityNames)
      ? body.cityNames.map((c: unknown) => String(c || "").trim()).filter(Boolean)
      : undefined;
    const guestsRaw = (body?.guests || {}) as Record<string, unknown>;
    const selections = (body?.selections || {}) as BookingLeadSelections;
    const dossierPdfUrl =
      body?.dossierPdfUrl ?? body?.dossier_pdf_url ?? null;
    const recordEmailSent = Boolean(body?.recordEmailSent);

    // Accept official JPN- (and legacy TMP-/TK- on normalize).
    if (!isValidBookingPNR(bookingRef) && !isTempBookingRef(bookingRef)) {
      return NextResponse.json(
        { error: "A valid booking_ref (PNR) is required." },
        { status: 400 }
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }
    if (type !== "multi_day" && type !== "single_day") {
      return NextResponse.json(
        { error: "type must be multi_day or single_day." },
        { status: 400 }
      );
    }

    const result = await upsertBookingsAndLeads({
      bookingRef,
      email,
      type,
      status,
      primaryCity,
      tourDate: tourDate ? String(tourDate).slice(0, 10) : null,
      guests: {
        adults: Number(guestsRaw.adults) || 0,
        kids: Number(guestsRaw.kids ?? guestsRaw.children) || 0,
      },
      durationValue: Number.isFinite(durationValue) ? durationValue : undefined,
      durationLabel: durationLabel || undefined,
      citiesList: citiesList || undefined,
      cityNames,
      selections,
      dossierPdfUrl: dossierPdfUrl ? String(dossierPdfUrl) : null,
      recordEmailSent,
      meetingPointName: String(
        body?.meetingPointName || body?.meeting_point_name || ""
      ).trim(),
      meetingPointAddress: String(
        body?.meetingPointAddress || body?.meeting_point_address || ""
      ).trim(),
      meetingPointLat:
        body?.meetingPointLat != null
          ? Number(body.meetingPointLat)
          : body?.meeting_point_lat != null
            ? Number(body.meeting_point_lat)
            : null,
      meetingPointLng:
        body?.meetingPointLng != null
          ? Number(body.meetingPointLng)
          : body?.meeting_point_lng != null
            ? Number(body.meeting_point_lng)
            : null,
      meetingPointPlaceId: String(
        body?.meetingPointPlaceId || body?.meeting_point_place_id || ""
      ).trim(),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Upsert failed." },
        { status: 500 }
      );
    }

    const demand = body?.demand as
      | {
          ticketsNeeded?: boolean;
          driverNeeded?: boolean;
          guideNeeded?: boolean;
          ticketLines?: unknown[];
        }
      | undefined;
    if (demand) {
      void (async () => {
        try {
          const { getAdminPocketBase } = await import("@/lib/pocketbase/admin");
          const {
            applyOpsDemandForPnr,
            enrichDemandFromTourCatalog,
            tourIdsFromSelections,
          } = await import("@/lib/opsDemand");
          const pb = await getAdminPocketBase();
          const tourIds = tourIdsFromSelections(selections);
          const base = {
            ticketsNeeded: Boolean(demand.ticketsNeeded),
            driverNeeded: Boolean(demand.driverNeeded),
            guideNeeded: demand.guideNeeded !== false,
            ticketLines: Array.isArray(demand.ticketLines)
              ? (demand.ticketLines as never[])
              : [],
          };
          const enriched = await enrichDemandFromTourCatalog(
            pb,
            base,
            tourIds
          );
          await applyOpsDemandForPnr(pb, bookingRef, enriched);
        } catch (err) {
          console.warn(
            "[bookings-and-leads/upsert] demand",
            err instanceof Error ? err.message : err
          );
        }
      })();
    } else {
      // Still heal tickets from selections even if client omitted demand.
      void (async () => {
        try {
          const { getAdminPocketBase } = await import("@/lib/pocketbase/admin");
          const {
            applyOpsDemandForPnr,
            enrichDemandFromTourCatalog,
            tourIdsFromSelections,
          } = await import("@/lib/opsDemand");
          const pb = await getAdminPocketBase();
          const tourIds = tourIdsFromSelections(selections);
          if (tourIds.length === 0) return;
          const enriched = await enrichDemandFromTourCatalog(
            pb,
            {
              ticketsNeeded: false,
              driverNeeded: false,
              guideNeeded: true,
              ticketLines: [],
            },
            tourIds
          );
          if (enriched.ticketsNeeded) {
            await applyOpsDemandForPnr(pb, bookingRef, enriched);
          }
        } catch {
          /* ignore */
        }
      })();
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      bookingRef,
    });
  } catch (err) {
    console.error("[bookings-and-leads/upsert]", err);
    const msg =
      err instanceof Error ? err.message : "Unable to save booking lead.";
    const status = msg.includes("PB_ADMIN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
