"use client";

import { BrandCharactersCatalog } from "@/components/team/BrandCharactersCatalog";
import { GuestPartyLayoutBuilder } from "@/components/team/GuestPartyLayoutBuilder";
import { FoxMessagesEditor } from "@/components/team/FoxMessagesEditor";
import { HiBubbleEditor } from "@/components/team/HiBubbleEditor";
import { TimelineMascotLayoutEditor } from "@/components/team/TimelineMascotLayoutEditor";
import { TokioClockLoader } from "@/components/common/TokioClockLoader";
import { ChargingScreen } from "@/components/branding/HomeAssetWarmGate";
import { BRAND_LOGO_ICON } from "@/lib/brand";
import { useState } from "react";
import Link from "next/link";

type HubTab =
  | "characters"
  | "guest_party"
  | "heroes"
  | "clock_loader"
  | "fox_messages"
  | "hi_bubble"
  | "timeline_mascot";

const TABS: { id: HubTab; label: string }[] = [
  { id: "characters", label: "Characters" },
  { id: "guest_party", label: "Guest party" },
  { id: "heroes", label: "Heroes" },
  { id: "timeline_mascot", label: "Timeline mascot" },
  { id: "clock_loader", label: "Bar loader" },
  { id: "fox_messages", label: "Fox messages" },
  { id: "hi_bubble", label: "HI bubble" },
];
/**
 * Team Access layout hub — characters, guest party, timeline mascot (M/S),
 * heroes, loaders, fox messages, and HI bubble.
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
          weight, replace assets, edit guest-party positions, and preview loaders
          / fox messages.
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
      {tab === "clock_loader" ? <ClockLoaderPreview /> : null}
      {tab === "fox_messages" ? <FoxMessagesEditor /> : null}
      {tab === "hi_bubble" ? <HiBubbleEditor /> : null}
      {tab === "timeline_mascot" ? <TimelineMascotLayoutEditor /> : null}
    </div>
  );
}

function ClockLoaderPreview() {
  const [subTab, setSubTab] = useState<"bike" | "home" | "builder">("bike");
  const [message, setMessage] = useState("PREPARING YOUR JOURNEY...");
  const [subMessage, setSubMessage] = useState("Building your day tour…");
  const [chargeLabel, setChargeLabel] = useState("Charging your trip assets…");
  const [logoSrc, setLogoSrc] = useState(BRAND_LOGO_ICON);
  const [percent, setPercent] = useState(42);
  const [fullScreen, setFullScreen] = useState(false);
  const [key, setKey] = useState(0);

  const subTabs: { id: typeof subTab; label: string }[] = [
    { id: "bike", label: "Bike bar" },
    { id: "home", label: "Home charge" },
    { id: "builder", label: "Builder charge" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={
              subTab === t.id
                ? "rounded-full border border-[#075473] bg-[#075473]/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#7dd3fc]"
                : "rounded-full border border-zinc-700 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Controls
        </p>
        {subTab === "bike" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Message
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-[#075473]"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Sub-message
              <input
                value={subMessage}
                onChange={(e) => setSubMessage(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-[#075473]"
              />
            </label>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Label
              <input
                value={chargeLabel}
                onChange={(e) => setChargeLabel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-[#075473]"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Logo URL (optimal ~112×112 · under 40KB · webp/png)
              <input
                value={logoSrc}
                onChange={(e) => setLogoSrc(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-[#075473]"
              />
            </label>
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Fake progress %
              <input
                type="range"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setKey((k) => k + 1);
              if (subTab !== "bike") setPercent(8);
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 hover:border-zinc-500"
          >
            Restart animation
          </button>
          <button
            type="button"
            onClick={() => setFullScreen(true)}
            className="rounded-xl border border-[#E60F43]/50 bg-[#E60F43]/15 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#ff8aa8] hover:bg-[#E60F43]/25"
          >
            Preview full screen
          </button>
        </div>
      </div>

      {subTab === "bike" ? (
        <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#0A1017] to-zinc-950 py-10">
          <TokioClockLoader
            key={key}
            message={message}
            subMessage={subMessage || undefined}
          />
        </div>
      ) : (
        <ChargingScreen
          key={`${subTab}-${key}`}
          embedded
          logoSrc={logoSrc}
          label={
            chargeLabel ||
            (subTab === "builder"
              ? "Charging your builder…"
              : "Charging your trip assets…")
          }
          progress={{
            loaded: percent,
            total: 100,
            percent,
            done: percent >= 100,
          }}
        />
      )}

      {fullScreen ? (
        <div className="fixed inset-0 z-[100]">
          {subTab === "bike" ? (
            <TokioClockLoader
              key={`fs-${key}`}
              message={message}
              subMessage={subMessage || undefined}
              fullScreen
            />
          ) : (
            <ChargingScreen
              key={`fs-charge-${key}`}
              logoSrc={logoSrc}
              label={chargeLabel}
              progress={{
                loaded: percent,
                total: 100,
                percent,
                done: percent >= 100,
              }}
            />
          )}
          <button
            type="button"
            onClick={() => setFullScreen(false)}
            className="fixed right-4 top-4 z-[101] rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md hover:bg-black/80"
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
