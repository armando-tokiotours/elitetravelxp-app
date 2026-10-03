"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { JapanKeyword } from "@/components/branding/JapanKeyword";
import { BrandLogoIcon } from "@/components/branding/BrandLogoIcon";
import { performFullBookingReset } from "@/lib/useBookingSync";
import { prefetchBuilderConfig } from "@/lib/builderConfigCache";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import {
  DEFAULT_HOMEPAGE_HERO_INTRO,
  fetchSiteBranding,
  heroTextOrientationStyle,
  heroTextRoleClass,
  resolveHomepageHeroIntro,
  type HomepageHeroCardConfig,
  type HomepageHeroIntroBranding,
  type HomepageHeroOverlayLayout,
} from "@/lib/pocketbase/client";

const ManageBookingModal = dynamic(
  () =>
    import("@/components/modals/ManageBookingModal").then((m) => ({
      default: m.ManageBookingModal,
    })),
  { ssr: false }
);

function overlayStyle(o: HomepageHeroOverlayLayout): React.CSSProperties {
  const basePx = o.role === "h1" ? 16 : o.role === "h2" ? 13 : 11;
  return {
    left: `${o.left}%`,
    top: `${o.top}%`,
    fontSize: `${(basePx * o.fontSize) / 100}px`,
    ...heroTextOrientationStyle(o.orientation),
  };
}

function CardOverlay({
  text,
  overlay,
}: {
  text: string;
  overlay: HomepageHeroOverlayLayout;
}) {
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={overlayStyle(overlay)}
    >
      <span
        className={`inline-block rounded-xl border border-white/20 bg-[#075473]/25 px-2.5 py-1 tracking-[0.2em] text-white uppercase shadow-lg backdrop-blur-md ${heroTextRoleClass(
          overlay.role
        )}`}
      >
        {text || "JAPANESE"}
      </span>
    </div>
  );
}

function CameraViewfinder() {
  return (
    <div className="pointer-events-none absolute inset-2 z-20 flex flex-col justify-between opacity-100 sm:inset-3">
      <div className="flex items-start justify-between">
        <div className="h-4 w-4 rounded-tl-sm border-t-2 border-l-2 border-amber-400 shadow-[0_0_8px_rgba(246,167,36,0.8)] sm:h-5 sm:w-5" />
        <div className="h-4 w-4 rounded-tr-sm border-t-2 border-r-2 border-amber-400 shadow-[0_0_8px_rgba(246,167,36,0.8)] sm:h-5 sm:w-5" />
      </div>
      <div className="animate-pulse self-center text-base font-light text-amber-400/80 sm:text-lg">
        +
      </div>
      <div className="flex items-end justify-between">
        <div className="h-4 w-4 rounded-bl-sm border-b-2 border-l-2 border-amber-400 shadow-[0_0_8px_rgba(246,167,36,0.8)] sm:h-5 sm:w-5" />
        <div className="h-4 w-4 rounded-br-sm border-b-2 border-r-2 border-amber-400 shadow-[0_0_8px_rgba(246,167,36,0.8)] sm:h-5 sm:w-5" />
      </div>
    </div>
  );
}

export function HomepageHeroCards() {
  const router = useRouter();
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [intro, setIntro] = useState<HomepageHeroIntroBranding>(
    DEFAULT_HOMEPAGE_HERO_INTRO
  );
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

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

  useEffect(() => () => clearTimers(), [clearTimers]);

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

      setActiveCardId(card.id);
      setIsLocked(true);
      clearTimers();

      // Quick white flash in the photo box, then navigate (no multi-second hold).
      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 639px)").matches;
      const holdDuration = isMobile ? 120 : 80;

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

      const holdId = window.setTimeout(() => {
        setIsFlashing(true);
        const navId = window.setTimeout(() => {
          router.push(card.route);
        }, 90);
        timersRef.current.push(navId);
      }, holdDuration);
      timersRef.current.push(holdId);
    },
    [clearTimers, isLocked, router]
  );

  return (
    // Mobile: svh = visible Safari height (chrome subtracted). Allow scroll if still short.
    // Desktop: keep locked dvh composition.
    <div className="tokio-ambient-bg relative flex min-h-svh w-full select-none flex-col overflow-x-hidden overflow-y-auto text-white pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:h-dvh sm:max-h-dvh sm:overflow-hidden sm:pt-[max(0.75rem,env(safe-area-inset-top))] sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <header className="relative z-20 flex shrink-0 items-center justify-between px-4 py-1.5 sm:px-8 sm:py-2.5">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <BrandLogoIcon
            priority
            className="h-6 w-6 rounded-full object-cover sm:h-8 sm:w-8"
          />
          <span className="font-godiva text-[10px] tracking-[0.18em] text-white uppercase sm:text-sm">
            Tokiotours
          </span>
        </div>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-300 uppercase transition hover:border-white/30 hover:text-white sm:text-xs"
        >
          Manage
        </button>
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center px-4 pb-1 pt-0.5 sm:max-h-[calc(100dvh-7.5rem)] sm:items-stretch sm:px-8 sm:pb-3 sm:pt-2">
        <div className="mb-1.5 w-full shrink-0 space-y-0.5 text-center sm:mb-2 sm:hidden sm:space-y-1">
          {intro.scriptTitle ? (
            <JapanKeyword className="block text-[1rem] leading-none text-[#E02B49] [@media(max-height:700px)]:text-[0.9rem]">
              {intro.scriptTitle}
            </JapanKeyword>
          ) : null}
          <h1 className="font-godiva whitespace-pre-line text-[0.95rem] leading-tight tracking-wide text-white uppercase [@media(max-height:700px)]:text-[0.85rem]">
            {intro.mainTitle}
          </h1>
          <p className="mx-auto line-clamp-2 max-w-sm text-[9px] leading-snug font-light text-gray-300 [@media(max-height:700px)]:line-clamp-1 sm:line-clamp-3 sm:text-[10px]">
            {intro.tagline}
          </p>
        </div>

        {/* Desktop intro — unchanged top-left stack */}
        <div className="relative z-20 mb-2 hidden w-full max-w-2xl shrink-0 space-y-0.5 sm:mb-2 sm:block">
          {intro.scriptTitle ? (
            <JapanKeyword className="block text-3xl leading-none text-[#E02B49] sm:text-4xl">
              {intro.scriptTitle}
            </JapanKeyword>
          ) : null}
          <h1 className="-mt-2 font-godiva whitespace-pre-line text-2xl leading-[1.05] tracking-wide text-white uppercase sm:-mt-2.5 sm:text-3xl">
            {intro.mainTitle}
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-snug font-light text-gray-300 sm:text-sm">
            {intro.tagline}
          </p>
        </div>

        {/* Mobile: compact stack that can shrink · Desktop: top-aligned 3-col */}
        <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col items-center justify-start gap-1.5 sm:my-auto sm:mt-2 sm:mb-auto sm:max-w-5xl sm:grid sm:grid-cols-3 sm:items-start sm:justify-items-center sm:gap-6 [@media(max-height:700px)]:gap-1">
          {sortedCards.map((card, cardIndex) => {
            const isActive = activeCardId === card.id;
            const isOtherActive = activeCardId !== null && !isActive;
            const photo = (card.heroPhotoUrl || "").trim();
            const localPhoto = photo.startsWith("/") && !photo.startsWith("//");

            return (
              <button
                key={card.id}
                type="button"
                disabled={isLocked && !isActive}
                onClick={() => enterCard(card)}
                onMouseEnter={() => {
                  if (!isLocked) setActiveCardId(card.id);
                }}
                onMouseLeave={() => {
                  if (!isLocked) setActiveCardId(null);
                }}
                className={`group m-0 flex min-h-0 w-full max-w-[92%] flex-1 cursor-pointer flex-col items-center justify-center p-0 text-center transition-all duration-300 sm:max-w-none sm:flex-none sm:justify-start ${
                  isOtherActive
                    ? "scale-[0.98] opacity-80"
                    : "scale-100 opacity-100"
                } ${isLocked && !isActive ? "pointer-events-none" : ""}`}
              >
                {/* Photo — shorter on phone so 3 fit in Safari svh · portrait desktop */}
                <div
                  className={`relative aspect-[2.2/1] w-full min-h-0 max-h-[22svh] flex-1 overflow-hidden border p-0 transition-all duration-500
                    rounded-xl bg-[#2C2C2E]
                    sm:aspect-[3/4.2] sm:h-auto sm:max-h-[50vh] sm:flex-none sm:rounded-2xl
                    [@media(max-height:700px)]:max-h-[18svh]
                    ${
                      isActive
                        ? "border-amber-400/70 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_35px_rgba(246,167,36,0.5)] sm:scale-105"
                        : "border-white/10 shadow-[0_10px_24px_rgba(0,0,0,0.7)]"
                    }
                    ${isOtherActive ? "opacity-80 blur-[2px]" : ""}`}
                >
                  {photo ? (
                    localPhoto ? (
                      <Image
                        src={photo}
                        alt=""
                        fill
                        priority={cardIndex === 0}
                        sizes="(max-width: 639px) 92vw, 33vw"
                        className={`object-cover transition-all duration-700 ${
                          isActive ? "scale-110" : "scale-100"
                        } ${isOtherActive ? "brightness-75 contrast-90" : "brightness-100"}`}
                        draggable={false}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt=""
                        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
                          isActive ? "scale-110" : "scale-100"
                        } ${isOtherActive ? "brightness-75 contrast-90" : "brightness-100"}`}
                        draggable={false}
                        loading={cardIndex === 0 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    )
                  ) : null}

                  <CardOverlay text={card.japaneseText} overlay={card.overlay} />

                  {isActive ? <CameraViewfinder /> : null}

                  <div
                    className={`absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 transition-opacity ${
                      isActive ? "opacity-35" : "opacity-70"
                    }`}
                  />

                  {/* White camera flash — only inside this photo box, then navigate */}
                  {isFlashing && isActive ? (
                    <div
                      aria-hidden
                      className="animate-box-camera-flash pointer-events-none absolute inset-0 z-40 bg-white"
                    />
                  ) : null}
                </div>

                {/* Title centered under photo (mobile + desktop) */}
                <div className="mt-0.5 shrink-0 text-center sm:mt-2">
                  <h3
                    className={`font-godiva text-[10px] tracking-widest uppercase transition-colors sm:text-sm ${
                      isActive ? "text-[#F6A724]" : "text-white"
                    }`}
                  >
                    {card.title}
                  </h3>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="relative z-10 flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-white/10 px-4 py-1.5 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.35rem))] text-center text-[8px] font-medium text-zinc-300 sm:gap-6 sm:py-3 sm:pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:text-[11px]">
        <span>🏆 100% Private Guide</span>
        <span>•</span>
        <span>⚡ Instant Itinerary</span>
        <span>•</span>
        <span>🔒 Free Quote</span>
      </footer>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </div>
  );
}
