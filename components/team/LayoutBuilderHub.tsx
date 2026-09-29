"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandCharactersCatalog } from "@/components/team/BrandCharactersCatalog";
import { GuestPartyLayoutBuilder } from "@/components/team/GuestPartyLayoutBuilder";

type HubTab = "characters" | "guest_party" | "heroes";

const TABS: { id: HubTab; label: string }[] = [
  { id: "characters", label: "Characters" },
  { id: "guest_party", label: "Guest party" },
  { id: "heroes", label: "Heroes" },
];

/**
 * Team Access layout hub — characters (weight + replace), guest party positions, heroes.
 */
export function LayoutBuilderHub({
  initialTab = "characters",
}: {
  initialTab?: HubTab;
}) {
  const [tab, setTab] = useState<HubTab>(initialTab);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/team-access"
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1C1C1E] px-3.5 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-[#075473] hover:text-white"
        >
          <span aria-hidden>←</span>
          <span>Back to Team Admin</span>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-2xl text-white sm:text-3xl">
          Layout &amp; characters
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Manage brand characters and heroes: see current vs optimal file
          weight, replace assets, and edit guest-party positions.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "rounded-full border border-[#075473] bg-[#075473]/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7dd3fc]"
                : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "characters" ? <BrandCharactersCatalog /> : null}
      {tab === "heroes" ? <BrandCharactersCatalog categoryFilter="hero" /> : null}
      {tab === "guest_party" ? (
        <GuestPartyLayoutBuilder embedded />
      ) : null}
    </div>
  );
}
