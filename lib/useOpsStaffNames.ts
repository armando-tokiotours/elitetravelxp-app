"use client";

import { useEffect, useState } from "react";
import type { GuideConfirmStatus } from "@/lib/guideConfirmStatus";
import { guideConfirmClientLabel } from "@/lib/guideConfirmStatus";
import type { PassStatusLabel } from "@/lib/bookingStatus";
import type { CanonicalBookingStatus } from "@/lib/bookingStatus";
import type { DayGuideAssignment } from "@/lib/guideJobs";

export type OpsBookingSnapshot = {
  status: CanonicalBookingStatus | null;
  passStatus: PassStatusLabel | null;
  paymentConfirmed: boolean;
  contactsUnlocked: boolean;
  assignedAgent: string | null;
  /** Payment/privacy-gated display name for Day Services */
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
  guidePhotoUrl: string | null;
  guideEmail: string | null;
  guidePhone: string | null;
  guideWhatsapp: string | null;
  guideUnlockMessage: string | null;
  driverPhotoUrl: string | null;
  driverEmail: string | null;
  driverPhone: string | null;
  driverUnlockMessage: string | null;
  /** Per-day accepted guides (privacy-masked) */
  dayGuides: DayGuideAssignment[];
  loading: boolean;
};

const EMPTY: Omit<OpsBookingSnapshot, "loading"> = {
  status: null,
  passStatus: null,
  paymentConfirmed: false,
  contactsUnlocked: false,
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
  guidePhotoUrl: null,
  guideEmail: null,
  guidePhone: null,
  guideWhatsapp: null,
  guideUnlockMessage: null,
  driverPhotoUrl: null,
  driverEmail: null,
  driverPhone: null,
  driverUnlockMessage: null,
  dayGuides: [],
};

/**
 * Live Ops snapshot by PNR — collections only.
 * Contacts unlock when booking confirmed + fully paid (see guidePrivacy).
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
          contactsUnlocked: Boolean(data.contactsUnlocked),
          assignedAgent: String(data.assignedAgent || "").trim() || null,
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
          guidePhotoUrl: data.guidePhotoUrl
            ? String(data.guidePhotoUrl)
            : null,
          guideEmail: data.guideEmail ? String(data.guideEmail) : null,
          guidePhone: data.guidePhone ? String(data.guidePhone) : null,
          guideWhatsapp: data.guideWhatsapp
            ? String(data.guideWhatsapp)
            : null,
          guideUnlockMessage: data.guideUnlockMessage
            ? String(data.guideUnlockMessage)
            : null,
          driverPhotoUrl: data.driverPhotoUrl
            ? String(data.driverPhotoUrl)
            : null,
          driverEmail: data.driverEmail ? String(data.driverEmail) : null,
          driverPhone: data.driverPhone ? String(data.driverPhone) : null,
          driverUnlockMessage: data.driverUnlockMessage
            ? String(data.driverUnlockMessage)
            : null,
          dayGuides: Array.isArray(
            (data as { dayGuides?: DayGuideAssignment[] }).dayGuides
          )
            ? ((data as { dayGuides: DayGuideAssignment[] }).dayGuides || [])
            : [],
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
    contactsUnlocked: snap.contactsUnlocked,
  };
}
