"use client";

import type PocketBase from "pocketbase";
import { useState } from "react";
import { SeasonalityPanel } from "@/components/team/SeasonalityPanel";
import { SeasonalParticlesPanel } from "@/components/team/SeasonalParticlesPanel";
import { SeasonalCharactersPanel } from "@/components/team/SeasonalCharactersPanel";

type PbClient = PocketBase;
type SubTab = "tiers" | "particles" | "characters";

/**
 * Seasonality hub — hotel tiers, particle FX windows, climate card mascots.
 */
export function SeasonalityHub({ getClient }: { getClient: () => PbClient }) {
  const [sub, setSub] = useState<SubTab>("tiers");

  const tabClass = (id: SubTab) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      sub === id
        ? "bg-[#075473] text-white"
        : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSub("tiers")} className={tabClass("tiers")}>
          Tiers
        </button>
        <button
          type="button"
          onClick={() => setSub("particles")}
          className={tabClass("particles")}
        >
          Particles
        </button>
        <button
          type="button"
          onClick={() => setSub("characters")}
          className={tabClass("characters")}
        >
          Characters
        </button>
      </div>

      {sub === "tiers" ? (
        <SeasonalityPanel getClient={getClient} />
      ) : sub === "particles" ? (
        <SeasonalParticlesPanel getClient={getClient} />
      ) : (
        <SeasonalCharactersPanel getClient={getClient} />
      )}
    </div>
  );
}
