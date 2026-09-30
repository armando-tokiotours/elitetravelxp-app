"use client";

import { Suspense } from "react";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
} from "@/components/navigation/AppSidebar";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { GuestCommPage } from "@/components/dossier/GuestCommPage";

export default function BuilderSingleCommRoutePage() {
  return (
    <div className="min-h-screen bg-[#04080C] text-white">
      <AppSidebar brandEyebrow="TOKIOTOURS" brandTitle="Messages" expandOnHover />
      <div className={`${APP_SIDEBAR_RAIL_PAD}`}>
        <MobileTopChrome
          brandTitle="Messages"
          ctaHref="/builder-single/itinerary"
          ctaLabel="Dossier"
        />
        <Suspense
          fallback={
            <p className="px-4 py-10 text-sm text-zinc-500">Loading…</p>
          }
        >
          <GuestCommPage backHref="/builder-single/itinerary" />
        </Suspense>
      </div>
    </div>
  );
}
