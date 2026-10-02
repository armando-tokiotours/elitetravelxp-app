/**
 * Specialist direct-chat flags + guest-facing display helpers.
 */

import type { BookingMessageSenderRole } from "@/lib/bookingMessages";
import type { StaffRole } from "@/lib/staffRoles";

export type SpecialistRole = "TICKETER" | "DRIVER";

export function specialistField(
  role: SpecialistRole
): "ticketer_direct_chat_enabled" | "driver_direct_chat_enabled" {
  return role === "TICKETER"
    ? "ticketer_direct_chat_enabled"
    : "driver_direct_chat_enabled";
}

/** Guest-facing title — never exposes internal staff names for specialists. */
export function guestFacingStaffLabel(
  senderRole: string | null | undefined,
  fallbackName?: string | null
): string {
  const r = String(senderRole || "")
    .trim()
    .toUpperCase();
  if (r === "TICKETS") return "TokioTours Ticketing Specialist";
  if (r === "DRIVER") return "TokioTours Driver Specialist";
  if (r === "GUIDE") return "TokioTours Guide Desk";
  return (
    String(fallbackName || "").trim() || "TokioTours Concierge"
  );
}

export function opsDirectBadge(
  senderRole: string | null | undefined,
  isDirect?: boolean
): {
  label: string;
  className: string;
  bubbleClass: string;
} | null {
  const r = String(senderRole || "")
    .trim()
    .toUpperCase();
  if (r === "TICKETS" && isDirect !== false) {
    return {
      label: "TICKETER DIRECT",
      className:
        "border-purple-500/40 bg-purple-500/20 text-purple-300",
      bubbleClass:
        "border border-purple-500/30 bg-purple-950/40 text-purple-100",
    };
  }
  if (r === "DRIVER" && isDirect !== false) {
    return {
      label: "DRIVER DIRECT",
      className: "border-cyan-500/40 bg-cyan-500/20 text-cyan-300",
      bubbleClass:
        "border border-cyan-500/30 bg-cyan-950/40 text-cyan-100",
    };
  }
  if (
    r === "CONCIERGE" ||
    r === "OPS" ||
    r === "SUPER_USER" ||
    r === "OPS_COORDINATOR"
  ) {
    return {
      label: "CONCIERGE",
      className: "border-[#075473] bg-[#075473]/30 text-cyan-200",
      bubbleClass: "bg-[#075473] text-white",
    };
  }
  return null;
}

export function staffRoleToSpecialist(
  role: StaffRole | null | undefined
): SpecialistRole | null {
  if (role === "ticketer") return "TICKETER";
  if (role === "driver") return "DRIVER";
  return null;
}

export function canToggleSpecialistDirect(
  role: StaffRole | null | undefined
): boolean {
  return role === "owner" || role === "ops" || role === "agent";
}

export type DirectChatFlags = {
  ticketerDirect: boolean;
  driverDirect: boolean;
};

/** Extend CUST access when specialist direct flag is on. */
export function specialistCanPostToCustomer(
  role: StaffRole | null | undefined,
  flags: DirectChatFlags
): boolean {
  if (role === "ticketer") return flags.ticketerDirect;
  if (role === "driver") return flags.driverDirect;
  return false;
}

export function specialistGuestDisplayName(
  senderRole: BookingMessageSenderRole | string
): string {
  return guestFacingStaffLabel(senderRole);
}
