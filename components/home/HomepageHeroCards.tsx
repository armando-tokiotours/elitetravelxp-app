"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BrandLogoIcon } from "@/components/branding/BrandLogoIcon";
import { GridSequenceHero } from "@/components/home/GridSequenceHero";
import { HeaderSelectors } from "@/components/navigation/HeaderSelectors";
import { performFullBookingReset } from "@/lib/useBookingSync";
import { prefetchBuilderConfig } from "@/lib/builderConfigCache";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useCurtainStore } from "@/store/useCurtainStore";
import {
  DEFAULT_HOMEPAGE_HERO_INTRO,
  fetchSiteBranding,
  resolveHomepageHeroIntro,
  type HomepageHeroCardConfig,
  type HomepageHeroIntroBranding,
} from "@/lib/pocketbase/client";

const ManageBookingModal = dynamic(
  () =>
    import("@/components/modals/ManageBookingModal").then((m) => ({
      default: m.ManageBookingModal,
    })),
  { ssr: false }
);


export function HomepageHeroCards() {
  const [isLocked, setIsLocked] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [intro, setIntro] = useState<HomepageHeroIntroBranding>(
    DEFAULT_HOMEPAGE_HERO_INTRO
  );

  const reloadIntro = useCallback(async () => {
    const row = await fetchSiteBranding();
    setIntro(resolveHomepageHeroIntro(row));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const row = await fetchSiteBranding();
      if (cancelled) return;
      setIntro(resolveHomepageHeroIntro(row));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void reloadIntro();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadIntro]);

  // Warm catalog early so Pre-Elite → builder is usually a cache hit.
  useEffect(() => {
    prefetchBuilderConfig();
  }, []);

  const sortedCards = useMemo(
    () => [...intro.cards].sort((a, b) => a.order - b.order),
    [intro.cards]
  );

  const enterCard = useCallback(
    (card: HomepageHeroCardConfig) => {
      if (isLocked) return;

      setIsLocked(true);

      // Reset + trip type in parallel — never blocks navigation.
      void (async () => {
        try {
          await performFullBookingReset();
          if (card.tripType) {
            usePreBuilderStore.getState().setTripType(card.tripType);
          }
        } catch {
          /* navigation still proceeds */
        }
      })();

      // Straight to the curtain: it slides in, swaps the route at full
      // cover, then slides out revealing the quiz. No other transition.
      useCurtainStore.getState().request(card.route);
    },
    [isLocked]
  );


  return (
    <div className="relative w-full overflow-x-clip bg-[#060A0F] text-white select-none">
      {/* Fixed header — stays above the scrolling grid/accordion (z-100);
          CurtainWipe (z-9999) and ManageBookingModal (z-120) sit above it. */}
      <header className="fixed inset-x-0 top-0 z-[100] flex h-16 items-center justify-between bg-[#060A0F]/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <BrandLogoIcon
            priority
            className="h-6 w-6 rounded-full object-cover sm:h-8 sm:w-8"
          />
          <span className="font-godiva text-[10px] tracking-[0.18em] text-white uppercase sm:text-sm">
            Tokiotours
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <HeaderSelectors tone="dark" />
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            aria-label="Manage Booking"
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-center text-[8.5px] leading-[1.05] font-semibold tracking-wider text-zinc-300 backdrop-blur-md transition hover:border-white/30 hover:text-white sm:text-[10.2px]"
          >
            <span className="block">Manage</span>
            <span className="block">Booking</span>
          </button>
        </div>
      </header>

      <GridSequenceHero
        cards={sortedCards}
        onSelect={enterCard}
        headline={`${(intro.scriptTitle || "Design").split("\n")[0]} — your Japan, your way`}
        panelColor={intro.panelColor}
        panelText={intro.panelText}
        panelMedia={intro.gridPanels}
      />

      <section className="relative z-50 flex w-full flex-col items-center justify-center bg-[#060A0F] px-4 py-5 sm:px-8">
        <footer className="flex flex-wrap items-center justify-center gap-2 text-center text-[10px] font-medium text-zinc-400 sm:gap-6 sm:text-[11px]">
          <span>🏆 100% Private Guide</span>
          <span aria-hidden>•</span>
          <span>⚡ Instant Itinerary</span>
          <span aria-hidden>•</span>
          <span>🔒 Free Quote</span>
        </footer>
      </section>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </div>
  );
}
