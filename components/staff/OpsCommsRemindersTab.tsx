"use client";

/**
 * Tab 7 entry — single-PNR Communications & Reminders only.
 * Global cross-PNR desk lives at /ops/concierge.
 */

import type PocketBase from "pocketbase";
import { SingleBookingCommsTab } from "@/components/ops/SingleBookingCommsTab";
import type { OpsHubRow } from "@/components/staff/opsHubClient";

export function OpsCommsRemindersTab({
  row,
  pb,
  onSent,
}: {
  row: OpsHubRow;
  pb: PocketBase;
  guestName?: string | null;
  onSent?: () => void;
}) {
  return <SingleBookingCommsTab row={row} pb={pb} onSent={onSent} />;
}
