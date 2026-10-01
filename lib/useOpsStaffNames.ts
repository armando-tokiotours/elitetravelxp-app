"use client";

import { useEffect, useState } from "react";
import type { GuideConfirmStatus } from "@/lib/guideConfirmStatus";
import { guideConfirmClientLabel } from "@/lib/guideConfirmStatus";
import type { PassStatusLabel } from "@/lib/bookingStatus";
import type { CanonicalBookingStatus } from "@/lib/bookingStatus";

export type OpsBookingSnapshot = {
  status: CanonicalBookingStatus | null;
  passStatus: PassStatusLabel | null;
  paymentConfirmed: boolean;
  assignedAgent: string | null;
  /** Payment-gated display name for Day Services */
  guideName: string | null;
  driverName: string | null;
  guideStatus: GuideConfirmStatus;
  guideLabel: string;
  driverLabel: string;
  guideConfirmed: boolean;
  guideNeeded: boolean;
  driverNeeded: boolean;
  ticketsNeeded: boolean;
  ticketStatus: string;
  ticketsPurchaseAllowed: boolean;
  ticketGuestLabel: string | null;
  loading: boolean;
};

const EMPTY: Omit<OpsBookingSnapshot, "loading"> = {
  status: null,
  passStatus: null,
  paymentConfirmed: false,
  assignedAgent: null,
  guideName: null,
  driverName: null,
  guideStatus: "unassigned",
  guideLabel: guideConfirmClientLabel("unassigned"),
  driverLabel: "No driver assigned yet",
  guideConfirmed: false,
  guideNeeded: true,
  driverNeeded: false,
  ticketsNeeded: false,
  ticketStatus: "none",
  ticketsPurchaseAllowed: false,
  ticketGuestLabel: null,
};

/**
 * Live Ops snapshot by PNR — collections only.
 * Golden rule: confirmed guide/driver/tickets only when payment_confirmed.
 */
export function useOpsBookingSnapshot(
  pnr: string | null | undefined
): OpsBookingSnapshot {
  const [snap, setSnap] = useState<OpsBookingSnapshot>({
    ...EMPTY,
    loading: true,
  });

  useEffect(() => {
    const ref = String(pnr || "").trim().toUpperCase();
    if (!ref || ref === "—") {
      setSnap({ ...EMPTY, loading: false });
      return;
    }
    let cancelled = false;
    setSnap((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const res = await fetch(
          `/api/bookings/ops-staff?pnr=${encodeURIComponent(ref)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          if (!cancelled) setSnap({ ...EMPTY, loading: false });
          return;
        }
        const data = (await res.json()) as Partial<OpsBookingSnapshot> & {
          guide?: string | null;
          driver?: string | null;
        };
        if (cancelled) return;
        const guideStatus =
          (data.guideStatus as GuideConfirmStatus) || "unassigned";
        setSnap({
          status: data.status || null,
          passStatus: data.passStatus || null,
          paymentConfirmed: Boolean(data.paymentConfirmed),
          assignedAgent: String(data.assignedAgent || "").trim() || null,
          // Guest Day Services: only payment-gated display names (never raw Ops IDs)
          guideName: String(data.guide || "").trim() || null,
          driverName: String(data.driver || "").trim() || null,
          guideStatus,
          guideLabel:
            String(data.guideLabel || "").trim() ||
            guideConfirmClientLabel(guideStatus),
          driverLabel:
            String(data.driverLabel || "").trim() || "No driver assigned yet",
          guideConfirmed: Boolean(data.guideConfirmed),
          guideNeeded: data.guideNeeded !== false,
          driverNeeded: Boolean(data.driverNeeded),
          ticketsNeeded: Boolean(data.ticketsNeeded),
          ticketStatus: String(data.ticketStatus || "none"),
          ticketsPurchaseAllowed: Boolean(data.ticketsPurchaseAllowed),
          ticketGuestLabel: data.ticketGuestLabel
            ? String(data.ticketGuestLabel)
            : null,
          loading: false,
        });
      } catch {
        if (!cancelled) setSnap({ ...EMPTY, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pnr]);

  return snap;
}

export function useOpsStaffNames(pnr: string | null | undefined) {
  const snap = useOpsBookingSnapshot(pnr);
  return {
    guideName: snap.guideName,
    driverName: snap.driverName,
    guideStatus: snap.guideStatus,
    guideLabel: snap.guideLabel,
    guideConfirmed: snap.guideConfirmed,
    paymentConfirmed: snap.paymentConfirmed,
  };
}
