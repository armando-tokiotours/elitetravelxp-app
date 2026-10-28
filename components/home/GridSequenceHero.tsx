"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  defaultHomepageHeroGridPanels,
  parseVideoEmbed,
  type HomepageHeroCardConfig,
  type HomepageHeroGridPanelId,
  type HomepageHeroGridPanelMedia,
} from "@/lib/pocketbase/client";
import {
  brandingSlotMobileUrl,
  brandingSlotWebUrl,
  homeCardSlot,
} from "@/lib/brandingImageSlots";

/** Per-card accent (blue / amber / emerald) — single source, moved from HomepageHeroCards. */
export const CARD_ACCENT: Record<
  string,
  { frame: string; activeFrame: string; tint: string; chip: string }
> = {
  single: {
    frame:
      "hover:border-[#0080A3]/60 hover:shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_45px_rgba(0,128,163,0.28)]",
    activeFrame:
      "border-[#0080A3]/60 shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_45px_rgba(0,128,163,0.28)]",
    tint: "from-blue-900/50 via-[#0080A3]/20",
    chip: "border-sky-400/40 text-sky-200",
  },
  experience: {
    frame:
      "hover:border-amber-500/60 hover:shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_45px_rgba(245,158,11,0.28)]",
    activeFrame:
      "border-amber-500/60 shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_45px_rgba(245,158,11,0.28)]",
    tint: "from-amber-900/50 via-amber-600/20",
    chip: "border-amber-400/40 text-amber-200",
  },
  multiday: {
    frame:
      "hover:border-emerald-500/60 hover:shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_45px_rgba(16,185,129,0.28)]",
    activeFrame:
      "border-emerald-500/60 shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_45px_rgba(16,185,129,0.28)]",
    tint: "from-emerald-900/50 via-emerald-600/20",
    chip: "border-emerald-400/40 text-emerald-200",
  },
};

const ASSETS = {
  panel1: "/assets/base4/processed/5.webp", // sky
  panel2: "/assets/base4/processed/4.webp", // Fuji + lake
  panel3: "/assets/base4/processed/2.webp", // character / mascot
  panel5: "/assets/base4/processed/7.webp", // floor / path
} as const;

/** Generous visible windows — video/iframe mount only inside these. */
function panelActiveAt(id: HomepageHeroGridPanelId, v: number): boolean {
  switch (id) {
    case "p1": // sky (col 1) — full height in State 1, pushed out by ~0.46
    case "p2": // Fuji (col 2) — full height in State 1, pushed out by ~0.46
      return v < 0.46;
    case "p4": // purple (col 1) — rises under Sky from ~0.10, pushed out by ~0.46
      return v > 0.1 && v < 0.46;
    case "p5": // path — drops in during the split, slides up and out in Transition 2
      return v >= 0.08 && v < 0.72;
    case "p3": // cat — banner through State 3, slides up and out in the finale
      return v < 0.92;
    default:
      return false; // p6 — not rendered in the seamless layout
  }
}

function PanelMedia({
  media,
  active,
  builtIn,
  alt,
  builtInPreload,
}: {
  media: HomepageHeroGridPanelMedia;
  active: boolean;
  builtIn?: string;
  alt: string;
  builtInPreload?: boolean;
}) {
  const mediaType = media.mediaType ?? "image";
  const embed =
    mediaType === "youtube_link" ? parseVideoEmbed(media.mediaEmbedUrl) : null;
  const videoSrc =
    mediaType === "video"
      ? (media.mediaVideoUrl || "").trim()
      : embed?.provider === "file"
        ? embed.embedUrl
        : "";
  const showVideo = active && Boolean(videoSrc);
  const showEmbed = active && Boolean(embed) && embed?.provider !== "file";
  const customImage =
    mediaType === "image" ? (media.mediaImageUrl || "").trim() : "";

  // External-storage panel uploads (/uploads/hero-panels/…, possibly with a
  // ?v= cache-buster) are served as plain <img>: Next/Image rejects local
  // srcs with query strings unless localPatterns is configured, and adding
  // localPatterns would block every other local image in the app. The
  // files are already optimized before upload, so no optimizer is needed.
  const isUploadsImage = customImage.startsWith("/uploads/");

  return (
    <>
      {customImage && isUploadsImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={customImage}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      ) : customImage ? (
        <Image
          src={customImage}
          alt={alt}
          fill
          quality={100}
          sizes="100vw"
          className="object-cover"
          draggable={false}
        />
      ) : builtIn ? (
        <Image
          src={builtIn}
          alt={alt}
          fill
          preload={builtInPreload}
          quality={100}
          sizes="100vw"
          className="object-cover"
          draggable={false}
        />
      ) : null}
      {showVideo ? (
        <video
          data-panel-media="video"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      {showEmbed && embed ? (
        <iframe
          data-panel-media="embed"
          src={embed.embedUrl}
          title={alt}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="pointer-events-none absolute inset-0 h-full w-full border-0 object-cover"
          loading="lazy"
        />
      ) : null}
    </>
  );
}

export function GridSequenceHero({
  cards,
  onSelect,
  headline,
  panelColor,
  panelText,
  panelMedia,
}: {
  cards: HomepageHeroCardConfig[];
  onSelect: (card: HomepageHeroCardConfig) => void;
  headline: string;
  /** Dynamic purple-panel background (site_branding.hero_intro_config). */
  panelColor?: string;
  /** Dynamic purple-panel copy; empty falls back to `headline`. */
  panelText?: string;
  panelMedia?: Record<HomepageHeroGridPanelId, HomepageHeroGridPanelMedia>;
}) {
  const panels = panelMedia ?? defaultHomepageHeroGridPanels();
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Relay pattern: avoid framer-motion 13 WAAPI
  // ViewTimeline corruption on taller-than-viewport targets + opacity bug.
  // Verified in-browser: WAAPI-accelerated useScroll does not fire "change"
  // reliably on scroll jumps (progress stuck at 1 after scrollTo(0,0)), so
  // a native scroll listener computes progress exactly and is authoritative.
  const progress = useMotionValue(0);
  // NOTE: do NOT relay scrollYProgress -> progress here. Verified in-browser
  // that its WAAPI ViewTimeline value stays at 0 / stale on this 500vh
  // target and would overwrite the exact native value below.
  void scrollYProgress;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total)) : 0;
      progress.set(p);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [progress, scrollYProgress]);

  // Direct landing on the journey-type / sector option cards (finale):
  // `/#options` (Home dock, Discover Builder pill, etc.) jumps straight
  // to the Single Day · VIP Tickets · Multi Day "Select Option" cards
  // instead of the top of the 600vh scroll sequence. Listen for
  // hashchange + soft Home re-clicks while already on `/#options`.
  useEffect(() => {
    let raf = 0;
    let retry = 0;
    const jump = () => {
      if (window.location.hash !== "#options") return;
      const el =
        containerRef.current ?? document.getElementById("options");
      if (!el) return;
      // Tall scroll-sequence (~600vh): land on finale. Static / reduced-
      // motion (~1vh): total≈0 so this is just the section top.
      const total = el.offsetHeight - window.innerHeight;
      window.scrollTo({
        top: el.offsetTop + Math.max(0, total),
        behavior: "instant" as ScrollBehavior,
      });
    };
    const scheduleJump = () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(retry);
      jump();
      raf = window.requestAnimationFrame(() =>
        window.requestAnimationFrame(jump)
      );
      retry = window.setTimeout(jump, 350);
    };
    scheduleJump();
    window.addEventListener("hashchange", scheduleJump);
    window.addEventListener("tokio-scroll-options", scheduleJump);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(retry);
      window.removeEventListener("hashchange", scheduleJump);
      window.removeEventListener("tokio-scroll-options", scheduleJump);
    };
  }, []);

  const [finalActive, setFinalActive] = useState(false);
  useMotionValueEvent(progress, "change", (v) => {
    setFinalActive(v > 0.88);
  });

  const [activePanels, setActivePanels] = useState<
    Record<HomepageHeroGridPanelId, boolean>
  >({ p1: true, p2: true, p3: true, p4: false, p5: false, p6: false });
  useMotionValueEvent(progress, "change", (v) => {
    setActivePanels((prev) => {
      const next: Record<HomepageHeroGridPanelId, boolean> = {
        p1: panelActiveAt("p1", v),
        p2: panelActiveAt("p2", v),
        p3: panelActiveAt("p3", v),
        p4: panelActiveAt("p4", v),
        p5: panelActiveAt("p5", v),
        p6: panelActiveAt("p6", v),
      };
      return (
        prev.p1 === next.p1 &&
        prev.p2 === next.p2 &&
        prev.p3 === next.p3 &&
        prev.p4 === next.p4 &&
        prev.p5 === next.p5 &&
        prev.p6 === next.p6
      )
        ? prev
        : next;
    });
  });
  // ═══════════════════════════════════════════════════════════════════
  // STRICT SPATIAL MATH (ZERO GAPS, EXACT SPATIAL INTERPOLATION)
  // Timeline (10 keyframes — holds and transitions):
  // [0.00 - 0.10] -> STATE 1 HOLD: Sky / Fuji / Cat as three
  //                  FULL-HEIGHT panels in thirds. Purple is hidden
  //                  below Sky (top 100%); Path is hidden above Cat
  //                  (top −50%, height 50%).
  // [0.10 - 0.22] -> VERTICAL SPLIT: Purple pushes up under Sky
  //                  (Sky height 100→50%, Purple top 100→50%) while
  //                  Path drops down over Cat (Path top −50→0%, Cat
  //                  top 0→50% + height 100→50%). At every instant
  //                  Path bottom == Cat top and Cat bottom == 100%,
  //                  and Sky bottom == Purple top — zero black gaps.
  // [0.22 - 0.34] -> READING PAUSE: every panel value is frozen at
  //                  its split-end value (duplicate keyframe), so the
  //                  split layout — Sky top-left, Purple bottom-left,
  //                  Fuji centre, Path top-right, Cat bottom-right —
  //                  holds still long enough to read the Purple text.
  // [0.34 - 0.46] -> PUSH LEFT: Sky/Purple and Fuji slide left off
  //                  screen; Path & Cat expand to 100% width.
  // [0.46 - 0.59] -> STATE 2 HOLD: Path (top 50%) & Cat (bottom 50%)
  //                  hold the full screen.
  // [0.59 - 0.70] -> TRANSITION 2: Path slides up and out of the
  //                  screen (path_t 0→−50%, height stays 50%); Cat
  //                  rises to become the top banner (cat_top 50→0%,
  //                  cat_height 50→35%) while the Accordion slides up
  //                  (top 100→35%). Path bottom == Cat top and Cat
  //                  bottom == Accordion top at every instant.
  // [0.70 - 0.78] -> STATE 3 HOLD: Cat banner (top 0%, height 35%) +
  //                  Accordion (top 35%, height 65%) — hold.
  // [0.78 - 0.90] -> FINALE: Cat slides up and out (cat_top 0→−35%,
  //                  height stays 35% — sliding, not squashing) while
  //                  the Accordion expands to the full screen
  //                  (acc_top 35→0%, acc_height 65→100%). Cat bottom
  //                  == Accordion top at every instant.
  // [0.90 - 1.00] -> FINALE HOLD: Accordion full screen (top 0%,
  //                  height 100%), every value frozen (duplicate
  //                  keyframes), a resting end view to read and click
  //                  the cards (clickable from >0.88).
  // The transform arrays below are driven by the relayed native-scroll
  // `progress` MotionValue above (framer's WAAPI useScroll goes stale
  // on this taller-than-viewport target; the relay feeds identical
  // 0→1 values).
  // ═══════════════════════════════════════════════════════════════════
  const scrollTimeline = [0, 0.1, 0.22, 0.34, 0.46, 0.59, 0.7, 0.78, 0.9, 1];

  // COLUMN 1: Sky (Top Left) & Purple Box (Bottom Left)
  const col1_left = useTransform(progress, scrollTimeline, [
    "0%", "0%", "0%", "0%", "-66.666%", "-66.666%", "-66.666%", "-66.666%", "-66.666%", "-66.666%"
  ]);
  const col1_width = "33.333%";

  // COLUMN 2: Fuji (Center)
  const col2_left = useTransform(progress, scrollTimeline, [
    "33.333%", "33.333%", "33.333%", "33.333%", "-33.333%", "-33.333%", "-33.333%", "-33.333%", "-33.333%", "-33.333%"
  ]);
  const col2_width = "33.333%";

  // COLUMN 3: Path & Cat X-Axis
  // Both expand horizontally to fill the screen in the push-left phase
  const col3_left = useTransform(progress, scrollTimeline, [
    "66.666%", "66.666%", "66.666%", "66.666%", "0%", "0%", "0%", "0%", "0%", "0%"
  ]);
  const col3_width = useTransform(progress, scrollTimeline, [
    "33.333%", "33.333%", "33.333%", "33.333%", "100%", "100%", "100%", "100%", "100%", "100%"
  ]);

  // SKY (Panel 1) Y-Axis — full height in State 1, squashes to the
  // top half during the vertical split as Purple rises beneath it.
  const sky_h = useTransform(progress, scrollTimeline, [
    "100%", "100%", "50%", "50%", "50%", "50%", "50%", "50%", "50%", "50%"
  ]);

  // PURPLE (Panel 4) Y-Axis — hidden below the canvas in State 1
  // (top 100%), pushes up to the bottom half during the split.
  // Its top always equals Sky's bottom (sky_h), so no gap opens.
  const purp_t = useTransform(progress, scrollTimeline, [
    "100%", "100%", "50%", "50%", "50%", "50%", "50%", "50%", "50%", "50%"
  ]);

  // PATH (Panel 5) Y-Axis — hidden above the canvas in State 1
  // (top −50%, height 50%), drops to the top half during the split,
  // then slides up and out of the screen in Transition 2
  // (path_t 0→−50%, height stays 50% — never squashes) and stays out.
  const path_t = useTransform(progress, scrollTimeline, [
    "-50%", "-50%", "0%", "0%", "0%", "0%", "-50%", "-50%", "-50%", "-50%"
  ]);
  const path_height = useTransform(progress, scrollTimeline, [
    "50%", "50%", "50%", "50%", "50%", "50%", "50%", "50%", "50%", "50%"
  ]);

  // CAT (Panel 3) Y-Axis
  // Full height in State 1. During the split its top stays glued to
  // the Path's bottom edge (path_t + path_height) and its bottom
  // stays at 100% (cat_top + cat_height == 100%). In Transition 2 it
  // rises to the top as the Path exits above it: cat_top = path_t +
  // path_height (50→0) and cat_height 50→35%, so its bottom meets
  // the Accordion top (cat_top + cat_height == acc_top) — coverage
  // stays 100% with no black band. It holds as the banner through
  // State 3, then slides up and out in the finale (height stays 35%).
  const cat_top = useTransform(progress, scrollTimeline, [
    "0%", "0%", "50%", "50%", "50%", "50%", "0%", "0%", "-35%", "-35%"
  ]);
  const cat_height = useTransform(progress, scrollTimeline, [
    "100%", "100%", "50%", "50%", "50%", "50%", "35%", "35%", "35%", "35%"
  ]);

  // ACCORDION CONTAINER Y-Axis
  // Slides up from the bottom to meet the Cat banner in Transition 2
  // (top 100→35%, height 65%), holds below it through State 3, then
  // expands to the full section in the finale (top 35→0%, height
  // 65→100%) as the Cat exits above it — always 100% coverage.
  const acc_top = useTransform(progress, scrollTimeline, [
    "100%", "100%", "100%", "100%", "100%", "100%", "35%", "35%", "0%", "0%"
  ]);
  const acc_height = useTransform(progress, scrollTimeline, [
    "65%", "65%", "65%", "65%", "65%", "65%", "65%", "65%", "100%", "100%"
  ]);

  // Order final boxes: single → experience → multiday, fallback to array order
  const orderedCards = (() => {
    const byId = (id: string) => cards.find((c) => c.id === id);
    const picked = [byId("single"), byId("experience"), byId("multiday")].filter(
      (c): c is HomepageHeroCardConfig => Boolean(c)
    );
    if (picked.length === 3) return picked;
    const rest = cards.filter((c) => !picked.includes(c));
    return [...picked, ...rest].slice(0, 3);
  })();

  // ── Flexbox Accordion finale (recovered design) ──
  // Exactly one panel expanded; default = center card (experience).
  // First click on a collapsed panel only expands it; clicking the
  // expanded panel (or its CTA) enters the booking flow.
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const defaultExpandedId =
    orderedCards.find((c) => c.id === "experience")?.id ??
    orderedCards[1]?.id ??
    orderedCards[0]?.id;
  const expandedId =
    activeCardId && orderedCards.some((c) => c.id === activeCardId)
      ? activeCardId
      : defaultExpandedId;

  const handleCardClick = (card: HomepageHeroCardConfig, interactive: boolean) => {
    if (!interactive) return;
    if (card.id !== expandedId) {
      setActiveCardId(card.id);
      return;
    }
    onSelect(card);
  };

  /** Card face shared by the accordion finale and the seamless selectors. */
  const renderCardFace = (card: HomepageHeroCardConfig, isExpanded: boolean) => {
    const accent = CARD_ACCENT[card.id] ?? CARD_ACCENT.single;
    const photo = (card.heroPhotoUrl || "").trim();
    const localPhoto = photo.startsWith("/") && !photo.startsWith("//");
    // /uploads/ photos bypass the Next image optimizer: it rejects local
    // URLs carrying the ?v= cache-buster (400). Slot photos also get the
    // lighter mobile proxy via srcSet.
    const uploadsPhoto = photo.startsWith("/uploads/");
    const slotKey = homeCardSlot(card.id);
    const photoQuery = photo.includes("?")
      ? photo.slice(photo.indexOf("?"))
      : "";
    const slotSrcSet =
      uploadsPhoto && photo.split("?")[0] === brandingSlotWebUrl(slotKey)
        ? `${brandingSlotMobileUrl(slotKey)}${photoQuery} 768w, ${brandingSlotWebUrl(slotKey)}${photoQuery} 1600w`
        : undefined;
    const tag = (card.japaneseText || "").trim() || card.title;
    // Per-card media: only the EXPANDED face mounts video/iframe;
    // collapsed faces keep the photo/gradient backdrop (unchanged).
    const mediaType = card.mediaType ?? "image";
    const embed =
      mediaType === "youtube_link" ? parseVideoEmbed(card.mediaEmbedUrl) : null;
    const videoSrc =
      mediaType === "video"
        ? (card.mediaVideoUrl || "").trim()
        : embed?.provider === "file"
          ? embed.embedUrl
          : "";
    const showVideo = isExpanded && Boolean(videoSrc);
    const showEmbed = isExpanded && Boolean(embed) && embed?.provider !== "file";
    return (
      <>
            {photo ? (
              uploadsPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} srcSet={slotSrcSet} sizes="(max-width: 767px) 92vw, 60vw" alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} loading="lazy" decoding="async" />
              ) : localPhoto ? (
                <Image src={photo} alt="" fill sizes="(max-width: 767px) 92vw, 60vw" className="object-cover" draggable={false} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} loading="lazy" decoding="async" />
              )
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-t to-transparent ${accent.tint} bg-gray-900`} />
            )}
            {/* Expanded-only media — under tint/content, never intercepts clicks */}
            {showVideo ? (
              <video
                data-card-media="video"
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={photo && !localPhoto ? photo : undefined}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            {showEmbed && embed ? (
              <iframe
                data-card-media="embed"
                src={embed.embedUrl}
                title={card.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                className="pointer-events-none absolute inset-0 h-full w-full border-0 object-cover"
                loading="lazy"
              />
            ) : null}
            {/* Accent tint + legibility gradients */}
            {photo ? (
              <div className={`absolute inset-0 bg-gradient-to-t to-transparent opacity-70 ${accent.tint}`} />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

            {/* Collapsed label — rotated on desktop, horizontal mini-label on mobile */}
            <div
              aria-hidden={isExpanded}
              className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300 ${
                isExpanded ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <span className="block -rotate-90 text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap text-white uppercase drop-shadow-lg">
                {card.title}
              </span>
            </div>

            {/* Expanded content — fades in with a delay */}
            <div
              aria-hidden={!isExpanded}
              className={`absolute inset-0 z-20 transition-opacity duration-500 delay-200 ${
                isExpanded ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <div className="absolute top-4 right-4 max-w-[75%]">
                <span className={`block max-w-full truncate rounded-full border bg-[#060A0F]/80 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase backdrop-blur-md ${accent.chip}`}>
                  {tag}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 p-5 sm:p-6">
                <h3 className="font-godiva text-xl leading-tight font-black tracking-tight text-white uppercase drop-shadow-2xl sm:text-2xl">
                  {card.title}
                </h3>
                <p className="mt-2 line-clamp-3 max-w-md text-sm leading-relaxed font-light text-zinc-300 drop-shadow-lg">
                  {card.subtitle}
                </p>
                <span className="mt-4 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-white uppercase backdrop-blur-md transition group-hover:border-[#FF0055] group-hover:bg-[#FF0055]">
                  Select Option
                </span>
              </div>
            </div>
      </>
    );
  };

  /** Flexbox Accordion — used by the reduced-motion static finale. */
  const renderAccordion = (interactive: boolean) => (
    <>
      {orderedCards.map((card) => {
        const accent = CARD_ACCENT[card.id] ?? CARD_ACCENT.single;
        const isExpanded = card.id === expandedId;
        return (
          <div
            key={card.id}
            data-testid={`final-box-${card.id}`}
            data-accordion-panel={card.id}
            data-expanded={isExpanded ? "true" : "false"}
            role="button"
            tabIndex={interactive ? 0 : -1}
            aria-label={card.title}
            aria-expanded={isExpanded}
            onClick={() => handleCardClick(card, interactive)}
            onKeyDown={(e) => {
              if (!interactive) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardClick(card, interactive);
              }
            }}
            className={`group relative min-h-[72px] cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-gray-900 shadow-[0_18px_44px_rgba(0,0,0,0.75)] transition-all duration-700 ease-in-out md:min-h-0 ${
              isExpanded
                ? `flex-[4] opacity-100 md:flex-[5] ${accent.activeFrame}`
                : `flex-[1] opacity-60 ${accent.frame}`
            }`}
          >
            {renderCardFace(card, isExpanded)}
          </div>
        );
      })}
    </>
  );

  // Hydration-safe gate: server snapshot is false, so the first client
  // render matches SSR even when the OS requests reduced motion.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (isClient && reduceMotion) {
    return (
      <section id="options" data-testid="grid-sequence-hero-static" className="relative w-full bg-[#060A0F] px-4 pt-20 pb-8 md:px-8">
        <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden rounded-3xl bg-[#060A0F]">
          <p className="px-2 pt-6 text-center text-sm font-semibold tracking-[0.18em] text-white uppercase">{headline}</p>
          <div className="flex flex-1 flex-col gap-3 p-4 md:flex-row md:gap-4">{renderAccordion(true)}</div>
        </div>
      </section>
    );
  }

  return (
    <div ref={containerRef} id="options" data-testid="grid-sequence-hero" className="relative h-[600vh] w-full bg-[#060A0F]">
      {/* Sticky canvas below the fixed header (h-16). Gaps between panels
          come from each panel's own p-2 — positioning math stays
          edge-to-edge so widths always sum to 100%. */}
      <div className="pointer-events-none sticky top-0 h-[100dvh] w-full overflow-hidden pt-16">
        <div className="relative h-full w-full p-2 md:p-4">
          {/* ── COLUMN 1: SKY (TOP) & DYNAMIC PURPLE TEXT (BOTTOM) ── */}
          <motion.div data-grid-panel="p1" style={{ left: col1_left, width: col1_width, top: "0%", height: sky_h }} className="absolute p-2">
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#0B1015]">
              <PanelMedia media={panels.p1} active={activePanels.p1} builtIn={ASSETS.panel1} alt="Japan sky" />
            </div>
          </motion.div>

          {/* ═══ PURPLE PANEL (dynamic text & colour from PocketBase) ═══ */}
          <motion.div data-grid-panel="p4" style={{ left: col1_left, width: col1_width, top: purp_t, height: "50%" }} className="absolute p-2">
            <div
              style={{ backgroundColor: panelColor || "#9333EA" }}
              className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/5 p-6 text-center md:p-12"
            >
              <PanelMedia media={panels.p4} active={activePanels.p4} alt={headline} />
              {(panels.p4.mediaImageUrl || panels.p4.mediaVideoUrl || (panels.p4.mediaEmbedUrl || "").trim()) ? (
                <div
                  style={{ backgroundColor: panelColor || "#9333EA", opacity: 0.8 }}
                  className="absolute inset-0"
                  aria-hidden
                />
              ) : null}
              <h2 className="relative z-10 text-2xl leading-tight font-black tracking-tight text-white uppercase drop-shadow-lg md:text-4xl lg:text-5xl">
                {(panelText || "").trim() || headline}
              </h2>
            </div>
          </motion.div>

          {/* ── COLUMN 2: MT. FUJI (FULL HEIGHT) ── */}
          <motion.div data-grid-panel="p2" style={{ left: col2_left, width: col2_width, top: "0%", height: "100%" }} className="absolute p-2">
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#0B1015]">
              <PanelMedia media={panels.p2} active={activePanels.p2} builtIn={ASSETS.panel2} alt="Mount Fuji and lake" builtInPreload />
            </div>
          </motion.div>

          {/* ── COLUMN 3: PATH (TOP) & CHARACTER (BOTTOM) ── */}
          <motion.div data-grid-panel="p5" style={{ left: col3_left, width: col3_width, top: path_t, height: path_height }} className="absolute p-2">
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#0B1015]">
              <PanelMedia media={panels.p5} active={activePanels.p5} builtIn={ASSETS.panel5} alt="Garden path in Japan" />
            </div>
          </motion.div>
          <motion.div data-grid-panel="p3" style={{ left: col3_left, width: col3_width, top: cat_top, height: cat_height }} className="absolute p-2">
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#0B1015]">
              <PanelMedia media={panels.p3} active={activePanels.p3} builtIn={ASSETS.panel3} alt="Japan travel character" />
            </div>
          </motion.div>

          {/* ── STATE 3: ACCORDION (slides up to meet the Path banner) ──
              Expand/collapse flexbox accordion: one box open, the other
              two squeezed to strips. First click expands a strip;
              clicking the open box enters the booking flow. */}
          <motion.div
            data-grid-panel="accordion"
            style={{ left: "0%", width: "100%", top: acc_top, height: acc_height, pointerEvents: finalActive ? "auto" : "none" }}
            className="absolute p-2"
          >
            <div className="flex h-full w-full flex-row gap-2 md:gap-4">
              {renderAccordion(finalActive)}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
