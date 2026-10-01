/**
 * Map tokenized vendor API payloads → VendorInspectorLayout booking snapshot.
 */

import type {
  VendorInspectorBooking,
  VendorInspectorRole,
} from "@/components/staff/VendorInspectorLayout";
import type { VendorViewPayload } from "@/lib/vendorDispatch";

export function inspectorRoleFromVendorView(
  view: VendorViewPayload
): VendorInspectorRole {
  switch (view.role) {
    case "concierge":
      return "CONCIERGE";
    case "ticketer":
      return "TICKET_SUPPLIER";
    case "driver":
      return "DRIVER";
    case "guide":
    default:
      return "GUIDE";
  }
}

export function bookingFromVendorView(
  view: VendorViewPayload
): VendorInspectorBooking {
  if (view.role === "guide") {
    return {
      pnr: view.pnr,
      city: view.dayItinerary[0]?.split(" · ")[0] || "Japan",
      paxCount: view.partySize,
      startDate: view.date,
      endDate: view.date,
      guestName: view.guestNames,
      mobilityNotes: view.mobilityNotes,
      language: view.language,
      dayItinerary: view.dayItinerary,
      meetingPoint: view.meetingPoint,
      emergencyPhone: view.emergencyPhone,
      assignmentStatus: view.guideStatus,
    };
  }

  if (view.role === "driver") {
    return {
      pnr: view.pnr,
      city: view.hotelName || "Transfer",
      paxCount: view.passengerCount,
      startDate: view.date,
      endDate: view.date,
      pickupDetails: `${view.pickupTime} · ${view.flightRef} · ${view.vehicleType}`,
      meetingPoint: `${view.hotelName} — ${view.hotelAddress}`,
      assignmentStatus: view.luggageHint,
    };
  }

  if (view.role === "ticketer") {
    const details = view.ticketLines
      .map((l) => `${l.title} (${l.accessType})`)
      .join(" · ");
    return {
      pnr: view.pnr,
      city: "Tickets",
      paxCount: view.paxCount,
      startDate: view.ticketLines[0]?.dateHint || "—",
      endDate: view.ticketLines[0]?.dateHint || "—",
      ticketDetails: details || view.notes,
      jrPass: /jr\s*pass/i.test(`${details} ${view.notes}`),
      suicaCount: /suica|ic\s*card/i.test(view.notes || "") ? 1 : null,
      assignmentStatus: view.passportNamesNeeded
        ? "Passport names may be required"
        : undefined,
    };
  }

  // concierge
  return {
    pnr: view.pnr,
    city: view.city,
    paxCount: view.partySize,
    startDate: view.startDate,
    endDate: view.endDate,
    pickupDetails: view.pickupDetails,
    guestName: view.guestName,
    mobilityNotes: view.mobilityNotes,
    language: view.language,
    dayItinerary: view.dayItinerary,
    meetingPoint: view.meetingPoint,
    jrPass: view.jrPass,
    suicaCount: view.suicaCount,
    ticketDetails: view.ticketDetails,
    totalPrice: view.totalPrice,
    paymentStatus: view.paymentStatus,
    assignmentStatus: view.assignmentStatus,
  };
}
