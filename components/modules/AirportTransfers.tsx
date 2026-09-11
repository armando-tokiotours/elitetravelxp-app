"use client";

import { useItineraryStore } from "@/store/useItineraryStore";
import { ModuleShell, ToggleYesNo } from "./ModuleShell";

export function AirportTransfers() {
  const pickupTransfer = useItineraryStore((s) => s.pickupTransfer);
  const dropoffTransfer = useItineraryStore((s) => s.dropoffTransfer);
  const setPickupTransfer = useItineraryStore((s) => s.setPickupTransfer);
  const setDropoffTransfer = useItineraryStore((s) => s.setDropoffTransfer);

  return (
    <ModuleShell
      step={5}
      title="Airport / Port Transfers"
      description="Private vehicle meet-and-greet at arrival and seamless drop-off at departure."
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-12">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
            Pickup Service
          </p>
          <ToggleYesNo value={pickupTransfer} onChange={setPickupTransfer} />
        </div>
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
            Drop-off Service
          </p>
          <ToggleYesNo value={dropoffTransfer} onChange={setDropoffTransfer} />
        </div>
      </div>
    </ModuleShell>
  );
}
