"use client";

import { useRouter } from "next/navigation";
import { InquiryIngestionConsole } from "@/components/ops/InquiryIngestionConsole";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { canAccessOpsBoard } from "@/lib/staffRoles";

/**
 * Standalone Agent Ingestion Console at /ops/ingestion.
 */
export function AgentIngestionDesk() {
  const router = useRouter();

  return (
    <StaffPortalShell
      title="Agent Ingestion Console"
      allow={canAccessOpsBoard}
      wide
    >
      <div className="space-y-3">
        <p className="text-xs text-zinc-500">
          Paste AI CSV or upload a file to create bookings into{" "}
          <code className="text-zinc-400">bookings_and_leads</code> +{" "}
          <code className="text-zinc-400">ops_hub</code>. After ingest, open the
          booking master or Ops inbox.
        </p>
        <InquiryIngestionConsole
          onBookingCreated={(pnr) => {
            router.push(`/ops/booking?pnr=${encodeURIComponent(pnr)}`);
          }}
        />
      </div>
    </StaffPortalShell>
  );
}
