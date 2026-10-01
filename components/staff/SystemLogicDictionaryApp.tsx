"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { canAccessTeamAccess } from "@/lib/staffRoles";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";

const systemLogicDictionary = {
  Transport: [
    {
      ruleName: "Large Party Private Upgrade",
      description:
        "If party size > 4, the system automatically forces the 'Recommended' badge onto the Private Chauffeur option.",
      codeLocation: "DriversEditorModal.tsx",
    },
    {
      ruleName: "Mobility Requirement Override",
      description:
        "If the guest profile flags special mobility needs, Private Chauffeur is always recommended regardless of Travel Pace.",
      codeLocation: "DriversEditorModal.tsx",
    },
    {
      ruleName: "JR Pass Value Evaluation",
      description:
        "JR Pass viability is calculated based on the public_transit_cost_eur from inter_city_routes. Local city transit does not count toward JR Pass ROI.",
      codeLocation: "useBuilderStore.ts",
    },
  ],
  Routing: [
    {
      ruleName: "Consecutive City Deduplication",
      description:
        "Prevents nonsensical routing warnings (e.g., Tokyo → Tokyo). The optimizer strips consecutive identical city nodes before outputting the recommended route.",
      codeLocation: "lib/routeValidator.ts",
    },
    {
      ruleName: "Hub Anchoring",
      description:
        "The first city in the route optimization is strictly anchored to the Arrival Hub, and the last to the Departure Hub. Only middle cities are sorted.",
      codeLocation: "lib/routeValidator.ts",
    },
  ],
  Tours_and_Pace: [
    {
      ruleName: "Pace Capacity Limits",
      description:
        "Fast pace allows up to 2 major tours per day. Relaxed pace limits suggestions to 1 major tour per day.",
      codeLocation: "lib/builder-pricing.ts",
    },
  ],
  Customer_Journey_and_Dispatch: [
    {
      ruleName: "Lead Readiness & Journey Qualification",
      description:
        "Evaluates client stage: 1) Trip consideration, 2) Cost evaluation, 3) Flights booked, 4) Hotels booked, 5) Itinerary finalized.",
      codeLocation: "components/staff/OpsBookingInspector.tsx",
    },
    {
      ruleName: "Deposit Rule (> 3 Months Out)",
      description:
        "For bookings with arrival dates more than 90 days away, request only a 30% non-refundable deposit. Guide dispatch is deferred.",
      codeLocation: "components/staff/OpsBookingInspector.tsx",
    },
    {
      ruleName: "Guide Dispatch: Availability-First Check",
      description:
        "If travel is within 7 days, in peak season, or requires niche language/specialized expertise, staff MUST confirm guide availability BEFORE issuing a payment link.",
      codeLocation: "components/staff/OpsBookingInspector.tsx",
    },
    {
      ruleName: "Guide Dispatch: Payment-First Workflow",
      description:
        "For standard English tours, easy itineraries, or bookings made far in advance, collect full payment (or 30% deposit if > 3 months) before assigning a guide.",
      codeLocation: "components/staff/OpsBookingInspector.tsx",
    },
  ],
} as const;

type DictionaryTab = keyof typeof systemLogicDictionary;

const TAB_LABELS: Record<DictionaryTab, string> = {
  Transport: "Transport",
  Routing: "Routing",
  Tours_and_Pace: "Tours & Pace",
  Customer_Journey_and_Dispatch: "Customer Journey & Dispatch",
};

export function SystemLogicDictionaryApp() {
  return (
    <StaffPortalShell
      title="System Logic Dictionary"
      allow={canAccessTeamAccess}
    >
      <SystemLogicDictionaryInner />
    </StaffPortalShell>
  );
}

function SystemLogicDictionaryInner() {
  const tabs = useMemo(
    () => Object.keys(systemLogicDictionary) as DictionaryTab[],
    []
  );
  const [activeTab, setActiveTab] = useState<DictionaryTab>("Transport");
  const rules = systemLogicDictionary[activeTab];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="font-godiva text-2xl text-[#F6A724] sm:text-3xl">
            System Logic Dictionary
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Read-only reference of hardcoded builder rules (routing, transport,
            tours). This does not control live PocketBase toggles — those stay
            on Team Access → Rules of Logic.
          </p>
        </div>
        <Link
          href="/team-access"
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          ← Team Access
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Logic categories"
        className="flex flex-wrap gap-1 border-b border-zinc-800"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-[#F6A724] text-[#F6A724]"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      <div className="space-y-4" role="tabpanel">
        {rules.map((rule) => (
          <article
            key={rule.ruleName}
            className="rounded-xl border border-white/10 bg-[#0D1117]/70 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-[#075473]">
                {rule.ruleName}
              </h3>
              <span className="rounded bg-white/5 px-2 py-1 font-mono text-xs text-zinc-500">
                {rule.codeLocation}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {rule.description}
            </p>
          </article>
        ))}
      </div>

      <p className="inline-flex items-center gap-2 text-[11px] text-zinc-600">
        <BookOpen className="h-3.5 w-3.5" aria-hidden />
        Manual only — edit code to change these rules.
      </p>
    </div>
  );
}
