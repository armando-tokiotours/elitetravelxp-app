"use client";

/**
 * Guide / Driver contractor app entry points.
 * Guide → GuidePortalApp; Driver → DriverPortalApp (same ContractorPortalShell UX).
 */

import { DriverPortalApp } from "@/components/staff/DriverPortalApp";
import { GuidePortalApp } from "@/components/staff/GuidePortalApp";

/** Guide contractor portal — drawer nav, dashboard / calendar / invoices / jobs / board / profile. */
export function GuideApp() {
  return <GuidePortalApp />;
}

/** Driver contractor portal — same shell as Guide, wired to dispatch / payouts / rate sheet. */
export function DriverApp() {
  return <DriverPortalApp />;
}
