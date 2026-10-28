"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CircleHelp,
  Clapperboard,
  Compass,
  Home,
  Sparkles,
  Star,
  Sun,
  Ticket,
} from "lucide-react";
import { BrandLogoIcon } from "@/components/branding/BrandLogoIcon";
import { FaqLinkSuspense } from "@/components/navigation/FaqLink";
import {
  formatDisplayDate,
  useBuilderStore,
} from "@/store/useBuilderStore";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import {
  TravelBriefModal,
  type TravelBriefAnswers,
} from "@/components/dossier/PreBuilderSummaryWidget";
import {
  formatGuestCountText,
  resolvePnr,
} from "@/lib/dossier/bookingPassHelpers";
import { syncSingleDayBookingLead } from "@/lib/syncBookingLead";
import { bookingBoundRef } from "@/lib/bookingKindGuard";
import {
  journeyBuilderHref,
  journeyItineraryHref,
} from "@/lib/builderRoutes";

/** Dock / hamburger → Builder S/M DiscoverOverlay (ack if a listener opens it). */
export const OPEN_DISCOVER_EVENT = "tokio-open-discover";
/** Dock Builder / 1-Day Pass while reels are open → close DiscoverOverlay. */
export const CLOSE_DISCOVER_EVENT = "tokio-close-discover";
/**
 * DiscoverOverlay broadcasts open/closed so the dock can raise z-index,
 * mark Discover active, and treat Builder taps as “Back to Builder”.
 */
export const DISCOVER_OVERLAY_STATE_EVENT = "tokio-discover-overlay-state";
/** Hamburger Questionnaire → AppNavDock TravelBriefModal (dock slot is Discover). */
export const OPEN_TRAVEL_BRIEF_EVENT = "tokio-open-travel-brief";

export type OpenDiscoverEventDetail = {
  acknowledge?: () => void;
};

export type DiscoverOverlayStateDetail = {
  open: boolean;
};

const ManageBookingModal = dynamic(
  () =>
    import("@/components/modals/ManageBookingModal").then((m) => ({
      default: m.ManageBookingModal,
    })),
  { ssr: false }
);

const ExperienceProfilerModal = dynamic(
  () =>
    import("@/components/quiz/ExperienceProfilerModal").then((m) => ({
      default: m.ExperienceProfilerModal,
    })),
  { ssr: false }
);

export type BuilderContextType = "MULTIDAY" | "SINGLE" | "BUILDER_E";

type LucideIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  action?: "manage" | "quiz" | "brief" | "discover";
}

/**
 * Home lands on the journey-type / sector selector (`GridSequenceHero`
 * `#options` finale: Single Day · Activities Tickets VIP · Multi Day),
 * not the marketing hero at the top of `/`. Cold open of `/` (no hash)
 * is unchanged.
 */
export const HOME_HREF = "/#options";

/** Soft re-click Home while already on `/#options` — GridSequenceHero listens. */
export const SCROLL_HOME_OPTIONS_EVENT = "tokio-scroll-options";

/** Context-isolated navigation — never share tabs across builders. */
export const NAV_CONFIGS: Record<BuilderContextType, NavItem[]> = {
  MULTIDAY: [
    { id: "home", label: "Home", icon: Home, path: HOME_HREF },
    {
      id: "builder",
      label: "Journey",
      icon: CalendarDays,
      path: "/builder/japan-journey",
    },
    {
      id: "itinerary",
      label: "Itinerary",
      icon: Ticket,
      path: "/builder/japan-journey/itinerary",
    },
    // Discover Reels (Questionnaire moved to hamburger → OPEN_TRAVEL_BRIEF_EVENT).
    {
      id: "discover",
      label: "Discover",
      icon: Clapperboard,
      path: "/discover",
      action: "discover",
    },
    { id: "faq", label: "FAQ", icon: CircleHelp, path: "/faq" },
  ],
  SINGLE: [
    { id: "home", label: "Home", icon: Home, path: HOME_HREF },
    {
      id: "builder_single",
      label: "1-Day Pass",
      icon: Sun,
      path: "/builder/day-pass",
    },
    {
      id: "dossier",
      label: "Itinerary",
      icon: Ticket,
      path: "/builder/day-pass/itinerary",
    },
    // Discover Reels (Questionnaire moved to hamburger → OPEN_TRAVEL_BRIEF_EVENT).
    {
      id: "discover",
      label: "Discover",
      icon: Clapperboard,
      path: "/discover",
      action: "discover",
    },
    { id: "faq", label: "FAQ", icon: CircleHelp, path: "/faq" },
  ],
  BUILDER_E: [
    { id: "home", label: "Home", icon: Home, path: HOME_HREF },
    {
      id: "builder_e",
      label: "VIP Access",
      icon: Sparkles,
      path: "/builder/vip-access",
    },
    { id: "explore", label: "Explore", icon: Compass, path: "/discover" },
    {
      id: "itinerary",
      label: "Itinerary",
      icon: Ticket,
      path: "/builder/vip-access/dossier",
    },
    { id: "quiz", label: "Match Quiz", icon: Star, action: "quiz" },
  ],
};

function isNavActive(pathname: string, item: NavItem): boolean {
  if (!item.path) return false;
  const pathOnly = item.path.split("#")[0] || "/";
  if (pathOnly === "/") return pathname === "/";
  if (item.path === "/builder") {
    return (
      pathname === "/builder" ||
      (pathname.startsWith("/builder/") &&
        !pathname.startsWith("/builder/itinerary") &&
        !pathname.startsWith("/builder-single") &&
        !pathname.startsWith("/builder-e"))
    );
  }
  if (item.path === "/builder-e") {
    return (
      pathname === "/builder-e" ||
      (pathname.startsWith("/builder-e/") &&
        !pathname.startsWith("/builder-e/dossier"))
    );
  }
  if (item.path === "/builder-single") {
    return (
      pathname === "/builder-single" ||
      (pathname.startsWith("/builder-single/") &&
        !pathname.startsWith("/builder-single/itinerary"))
    );
  }
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

/**
 * Dock for the whole `/builder/**` tree (which hosts multi-day, day-pass
 * and VIP routes under one layout) and for `/discover` (mounted by
 * app/discover/layout.tsx — Discover is not under the builder layout, so
 * without that mount it got no magic menu at all). Context follows the
 * route first, then the active booking's tripMode — never a hardcoded
 * MULTIDAY: a bound single_day booking (tripMode repaired by
 * useJourneyKindGuard) must see the Single-Day menu even before its
 * redirect lands. `/discover` uses SINGLE when tripMode is single_day
 * (Discover dock item stays visible / active after leaving reels);
 * otherwise BUILDER_E so VIP Explore still owns the disc.
 */
export function BuilderNavDock() {
  const pathname = usePathname();
  const tripMode = useBuilderStore((s) => s.tripMode);
  const context: BuilderContextType =
    pathname.startsWith("/builder/day-pass") ||
    pathname.startsWith("/builder-single")
      ? "SINGLE"
      : pathname.startsWith("/discover")
        ? tripMode === "single_day"
          ? "SINGLE"
          : "BUILDER_E"
        : pathname.startsWith("/builder/vip-access") ||
            pathname.startsWith("/builder-e")
          ? "BUILDER_E"
          : pathname.startsWith("/builder/japan-journey") ||
              pathname === "/builder"
            ? tripMode === "single_day"
              ? "SINGLE"
              : "MULTIDAY"
            : tripMode === "single_day"
              ? "SINGLE"
              : "MULTIDAY";
  return <AppNavDock context={context} />;
}

export function AppNavDock({ context }: { context: BuilderContextType }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const items = NAV_CONFIGS[context];
  // Magic Navigation slide — one layoutId element per orientation travels
  // between items (see `.magic-cutout` in app/globals.css). initial={false} keeps first mount
  // from flying in from the first item.
  const indicatorTransition = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 300, damping: 25 } as const);
  // Route-driven active state (isNavActive above). Parent routes also
  // prefix-match their nested itinerary/dossier routes, so resolve to the
  // single most specific match — exactly one item may own the sliding
  // layoutId disc at a time. DiscoverOverlay open forces the Discover /
  // Explore slot so the disc matches the reels screen.
  const routeActiveId = items
    .filter((item) => isNavActive(pathname, item))
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0]?.id;
  const [manageOpen, setManageOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const discoverSlotId =
    items.find((i) => i.id === "discover")?.id ??
    items.find((i) => i.id === "explore")?.id;
  const activeId =
    discoverOpen && discoverSlotId ? discoverSlotId : routeActiveId;
  // Discover overlay is z-[999] — lift dock above it while reels are open.
  const dockZ = discoverOpen ? "z-[1000]" : undefined;

  // ── Questionnaire / Travel Brief popup (SINGLE + MULTIDAY only) ──
  // Same answers + stores the dossier Guest Vision Brief widget reads.
  const isSingleContext = context === "SINGLE";
  const bPreEliteTravelStyle = useBuilderStore((s) => s.preEliteTravelStyle);
  const bPreEliteInterests = useBuilderStore((s) => s.preEliteInterests);
  const bPreEliteMotivation = useBuilderStore((s) => s.preEliteMotivation);
  const bPreElitePainPoints = useBuilderStore((s) => s.preElitePainPoints);
  const bTravelPace = useBuilderStore((s) => s.travelPace);
  const bPreferredTourLanguage = useBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const bGuestSpecialRequirements = useBuilderStore(
    (s) => s.guestSpecialRequirements
  );
  const bAdults = useBuilderStore((s) => s.adults);
  const bChildren = useBuilderStore((s) => s.children);
  const bArrivalDate = useBuilderStore((s) => s.arrivalDate);
  const bDurationDays = useBuilderStore((s) => s.durationDays);
  const bTempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const bConfirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bBookingStatus = useBuilderStore((s) => s.bookingStatus);
  const sdTravelPace = useSingleDayBuilderStore((s) => s.travelPace);
  const sdPreferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const sdGuestSpecialRequirements = useSingleDayBuilderStore(
    (s) => s.guestSpecialRequirements
  );
  const sdAdults = useSingleDayBuilderStore((s) => s.adults);
  const sdChildren = useSingleDayBuilderStore((s) => s.children);
  const sdTourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const sdTourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const clientName = useItineraryStore((s) => s.clientName);
  const clientEmail = useItineraryStore((s) => s.clientEmail);
  const preName = usePreBuilderStore(
    (s) => s.fullName || s.lastPayload?.fullName || ""
  );
  const preEmail = usePreBuilderStore(
    (s) => s.email || s.lastPayload?.email || ""
  );
  const briefGuestName = (clientName || preName || "").trim();
  const briefGuestEmail = (clientEmail || preEmail || "")
    .trim()
    .toLowerCase();
  const briefPnr = resolvePnr({
    tempBookingRef: bTempBookingRef,
    confirmedBookingRef: bConfirmedBookingRef,
    bookingStatus: bBookingStatus,
  });
  const briefAnswers: TravelBriefAnswers = isSingleContext
    ? {
        travelStyle: bPreEliteTravelStyle,
        travelPace: sdTravelPace,
        tourLanguage: sdPreferredTourLanguage,
        guestSpecialRequirements: sdGuestSpecialRequirements,
        interests: bPreEliteInterests,
        motivation: bPreEliteMotivation,
        painPoints: bPreElitePainPoints,
      }
    : {
        travelStyle: bPreEliteTravelStyle,
        travelPace: bTravelPace,
        tourLanguage: bPreferredTourLanguage,
        guestSpecialRequirements: bGuestSpecialRequirements,
        interests: bPreEliteInterests,
        motivation: bPreEliteMotivation,
        painPoints: bPreElitePainPoints,
      };

  /** Mirror of the dossier brief saves (store apply + revert on failure). */
  const saveBrief = async (next: TravelBriefAnswers): Promise<boolean> => {
    const prev = briefAnswers;
    if (isSingleContext) {
      const applyBrief = (a: TravelBriefAnswers) => {
        useBuilderStore.setState({
          preEliteTravelStyle: a.travelStyle,
          preEliteInterests: [...a.interests],
          preEliteMotivation: a.motivation,
          preElitePainPoints: [...a.painPoints],
        });
        const builder = useBuilderStore.getState();
        builder.setTravelPace(a.travelPace);
        builder.setPreferredTourLanguage(a.tourLanguage || "EN");
        builder.setGuestSpecialRequirements(a.guestSpecialRequirements);
        const sd = useSingleDayBuilderStore.getState();
        sd.setTravelPace(a.travelPace);
        sd.setPreferredTourLanguage(a.tourLanguage || "EN");
        sd.setGuestSpecialRequirements(a.guestSpecialRequirements);
      };
      applyBrief(next);
      if (!briefGuestEmail || !briefPnr || briefPnr === "······") return true;
      const ok = await syncSingleDayBookingLead({
        bookingRef: briefPnr,
        email: briefGuestEmail,
        state: useSingleDayBuilderStore.getState(),
        preEliteTravelStyle: next.travelStyle,
        preEliteInterests: [...next.interests],
        preEliteMotivation: next.motivation,
        preElitePainPoints: [...next.painPoints],
      });
      if (!ok) applyBrief(prev);
      return ok;
    }
    const apply = (a: TravelBriefAnswers) => {
      useBuilderStore.setState({
        preEliteTravelStyle: a.travelStyle,
        preEliteInterests: [...a.interests],
        preEliteMotivation: a.motivation,
        preElitePainPoints: [...a.painPoints],
        travelPace: a.travelPace,
        preferredTourLanguage: a.tourLanguage || "EN",
      });
      useBuilderStore
        .getState()
        .setGuestSpecialRequirements(a.guestSpecialRequirements);
    };
    apply(next);
    // Persisted locally in the builder store; the next builder/dossier
    // sync (Save / checkout) carries these selections to the lead — the
    // same fallback the dossier brief save uses before contact/PNR.
    return true;
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Hamburger Questionnaire (dock slot is Discover) still opens this modal.
  useEffect(() => {
    if (context === "BUILDER_E") return;
    const onOpenBrief = () => setBriefOpen(true);
    window.addEventListener(OPEN_TRAVEL_BRIEF_EVENT, onOpenBrief);
    return () =>
      window.removeEventListener(OPEN_TRAVEL_BRIEF_EVENT, onOpenBrief);
  }, [context]);

  useEffect(() => {
    const onState = (e: Event) => {
      const open = Boolean(
        (e as CustomEvent<DiscoverOverlayStateDetail>).detail?.open
      );
      setDiscoverOpen(open);
    };
    window.addEventListener(DISCOVER_OVERLAY_STATE_EVENT, onState);
    return () =>
      window.removeEventListener(DISCOVER_OVERLAY_STATE_EVENT, onState);
  }, []);

  const activate = (item: NavItem) => {
    if (item.action === "manage") {
      setManageOpen(true);
      return;
    }
    if (item.action === "quiz") {
      setQuizOpen(true);
      return;
    }
    if (item.action === "brief") {
      setBriefOpen(true);
      return;
    }
    if (item.action === "discover") {
      // Already on reels — keep overlay; do not bounce to /discover.
      if (discoverOpen) return;
      // Prefer in-builder DiscoverOverlay (same as Tours & Experiences).
      // Listeners ack synchronously; otherwise fall through to /discover.
      let handled = false;
      window.dispatchEvent(
        new CustomEvent<OpenDiscoverEventDetail>(OPEN_DISCOVER_EVENT, {
          detail: {
            acknowledge: () => {
              handled = true;
            },
          },
        })
      );
      if (!handled && item.path) router.push(item.path);
      return;
    }
    // Reels open: Builder / 1-Day Pass / VIP = Back to Builder (close only).
    // Ticket / Itinerary / Home / FAQ still navigate; close first so the
    // overlay does not linger under the next route.
    if (discoverOpen) {
      const isBuilderSlot =
        item.id === "builder" ||
        item.id === "builder_single" ||
        item.id === "builder_e";
      window.dispatchEvent(new CustomEvent(CLOSE_DISCOVER_EVENT));
      if (isBuilderSlot) return;
    }
    // Home → `/#options` (3-card selector). Soft: already on `/` still
    // scrolls to the finale (hashchange or SCROLL_HOME_OPTIONS_EVENT).
    if (item.id === "home") {
      const homePath = item.path || HOME_HREF;
      if (pathname === "/") {
        if (window.location.hash === "#options") {
          window.dispatchEvent(new Event(SCROLL_HOME_OPTIONS_EVENT));
        } else {
          window.location.hash = "options";
        }
        return;
      }
      router.push(homePath);
      return;
    }
    if (item.path) {
      let path = item.path;
      // Builder entries carry the confirmed PNR so the builder reloads
      // the saved booking instead of a blank draft (single + multi-day).
      if (context === "SINGLE" || context === "MULTIDAY") {
        const live = useBuilderStore.getState();
        const isSingle = context === "SINGLE";
        const bound =
          live.tripMode === (isSingle ? "single_day" : "multi_day")
            ? bookingBoundRef(live.confirmedBookingRef)
            : null;
        const type = isSingle ? "single_day" : "multi_day";
        if (bound && item.id === (isSingle ? "builder_single" : "builder")) {
          path = journeyBuilderHref(bound, { type });
        } else if (
          bound &&
          item.id === (isSingle ? "dossier" : "itinerary")
        ) {
          path = journeyItineraryHref(bound, { type });
        }
      }
      router.push(path);
    }
  };

  return (
    <>
      {/* Desktop rail only (lg+): below lg MobileTopChrome's hamburger + the bottom dock are the nav — showing the rail there too left a mostly-empty 64px column under the hamburger header. */}
      <aside
        className={`magic-nav no-print fixed top-0 bottom-0 left-0 hidden w-16 flex-col items-center border-r border-white/10 bg-[var(--nav-bg)] py-6 print:hidden lg:flex ${
          dockZ ?? "z-40"
        }`}
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-10 w-10 items-center justify-center overflow-hidden focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
          aria-label="Home"
        >
          <BrandLogoIcon
            priority
            className="h-10 w-[51px] object-contain"
          />
        </button>

        <div className="mt-8 flex w-full flex-col items-center">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            const dockClassName = `group relative flex h-14 w-full items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-inset focus-visible:outline-none ${
              active ? "text-white" : "text-gray-400 hover:text-white"
            }`;
            const dockContent = (
              <>
                {active ? (
                  <motion.span
                    layoutId="magic-indicator-vertical"
                    initial={false}
                    transition={indicatorTransition}
                    className="magic-cutout magic-cutout--vertical"
                    aria-hidden="true"
                  >
                    <span className="magic-bubble">
                      <Icon className="h-5 w-5 text-white" aria-hidden />
                    </span>
                  </motion.span>
                ) : (
                  <Icon className="h-5 w-5 text-current" aria-hidden />
                )}
                <span className="pointer-events-none absolute top-1/2 left-[calc(100%+2.25rem)] z-50 -translate-y-1/2 rounded border border-white/10 bg-black/90 px-2 py-1 text-[10px] font-bold whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {item.label}
                </span>
              </>
            );
            // FAQ carries the current path+query so its Back button can return here.
            if (item.id === "faq") {
              return (
                <FaqLinkSuspense
                  key={item.id}
                  title={item.label}
                  className={dockClassName}
                  ariaCurrent={active ? "page" : undefined}
                >
                  {dockContent}
                </FaqLinkSuspense>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => activate(item)}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={dockClassName}
              >
                {dockContent}
              </button>
            );
          })}
        </div>
      </aside>

      <nav
        className={`magic-nav magic-nav--dock no-print fixed inset-x-0 bottom-0 flex h-16 items-stretch justify-around border-t px-2 pb-[env(safe-area-inset-bottom)] print:hidden lg:hidden ${
          dockZ ?? "z-50"
        }`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          const mobileClassName = `group relative flex min-w-0 flex-1 flex-col items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-inset focus-visible:outline-none ${
            active ? "text-white" : "text-white/80 hover:text-white"
          }`;
          const mobileContent = (
            <>
              {active ? (
                <motion.span
                  layoutId="magic-indicator-horizontal"
                  initial={false}
                  transition={indicatorTransition}
                  className="magic-cutout magic-cutout--horizontal"
                  aria-hidden="true"
                >
                  <span className="magic-bubble magic-bubble--mobile">
                    <Icon className="h-5 w-5 text-white" aria-hidden />
                  </span>
                </motion.span>
              ) : (
                <Icon className="h-5 w-5 text-current" aria-hidden />
              )}
              <motion.span
                initial={false}
                animate={{
                  opacity: active ? 1 : 0,
                  y: active ? 0 : 6,
                }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 300, damping: 20 }
                }
                className="pointer-events-none absolute bottom-1.5 max-w-[4.5rem] truncate text-[9px] font-bold tracking-tight text-white drop-shadow-sm"
                aria-hidden={!active}
              >
                {item.label}
              </motion.span>
            </>
          );
          if (item.id === "faq") {
            return (
              <FaqLinkSuspense
                key={item.id}
                className={mobileClassName}
                ariaCurrent={active ? "page" : undefined}
              >
                {mobileContent}
              </FaqLinkSuspense>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => activate(item)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={mobileClassName}
            >
              {mobileContent}
            </button>
          );
        })}
      </nav>

      {/* Questionnaire popup — SINGLE/MULTIDAY only (hamburger opens via
          OPEN_TRAVEL_BRIEF_EVENT; dock slot is Discover). */}
      {context !== "BUILDER_E" ? (
        <TravelBriefModal
          open={briefOpen}
          onClose={() => setBriefOpen(false)}
          answers={briefAnswers}
          onSave={saveBrief}
          guestName={briefGuestName}
          pnrCode={briefPnr}
          tripTypeLabel={
            isSingleContext ? "1-Day Express Pass" : "Grand Japan Journey"
          }
          timingLabel={
            isSingleContext
              ? `${sdTourDate ? formatSingleDayDisplayDate(sdTourDate) : "Date TBD"} · ${sdTourHours} Hours`
              : bArrivalDate
                ? `${formatDisplayDate(bArrivalDate)} · ${bDurationDays} Day${bDurationDays === 1 ? "" : "s"}`
                : "Dates TBD"
          }
          groupLabel={formatGuestCountText(
            isSingleContext ? sdAdults : bAdults,
            isSingleContext ? sdChildren : bChildren
          )}
        />
      ) : null}
      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onSuccess={(ref) => {
          setToast(`Itinerary ${ref} loaded successfully`);
        }}
      />
      <ExperienceProfilerModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
      />
      {toast ? (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#075473]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#F3D9C4] shadow-lg sm:bottom-8"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
