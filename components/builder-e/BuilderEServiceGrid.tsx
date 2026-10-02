"use client";

import { useEffect, useState } from "react";
import {
  SUB_SERVICES,
  type SubServiceItem,
} from "@/components/builder-e/subServices";
import {
  brandingAttractionsWidgetUrl,
  fetchSiteBranding,
} from "@/lib/pocketbase/client";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

type BrandCardData = {
  mediaUrl?: string;
  title?: string;
  description?: string;
  subtitle?: string;
};

const DRIVER_ITEMS = SUB_SERVICES.filter((s) => s.category === "DRIVER");
const TRANSIT_ITEMS = SUB_SERVICES.filter((s) => s.category === "TRANSIT");
const VIP_CONCIERGE_IDS = new Set([
  "ghibli_vip",
  "sumo_box",
  "usj_express",
  "michelin_omakase",
  "event_verification",
  "geisha_dinner",
]);
const VIP_CONCIERGE_ITEMS = SUB_SERVICES.filter((s) => VIP_CONCIERGE_IDS.has(s.id));

function PhotoLineCard({
  title,
  subtitle,
  badge,
  duration,
  photoUrl,
  onClick,
  heightClass = "h-24",
  compact = false,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  duration?: string;
  photoUrl: string;
  onClick: () => void;
  heightClass?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full items-center overflow-hidden rounded-2xl border border-white/10 text-left shadow-xl transition-all hover:border-[#F6A724] ${heightClass} ${
        compact ? "px-3" : "px-5"
      }`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${photoUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
      <div className="relative z-10 flex w-full items-center justify-between gap-2">
        <div className="min-w-0 space-y-1 pr-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {badge ? (
              <span className="rounded border border-[#F6A724]/30 bg-[#F6A724]/20 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wider text-[#F6A724] uppercase sm:text-[9px] sm:px-2">
                {badge}
              </span>
            ) : null}
            {duration ? (
              <span className="text-[9px] text-gray-300 sm:text-[10px]">
                ⏱ {duration}
              </span>
            ) : null}
          </div>
          <h4
            className={`font-godiva tracking-wide text-white transition-colors group-hover:text-[#F6A724] ${
              compact
                ? "line-clamp-2 text-sm leading-tight"
                : "truncate text-base"
            }`}
          >
            {title}
          </h4>
          {subtitle ? (
            <p className="line-clamp-2 text-[10px] text-gray-300 sm:text-[11px]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-lg text-[#F6A724] transition-transform group-hover:translate-x-1 sm:text-xl">
          →
        </span>
      </div>
    </button>
  );
}

export function BuilderEServiceGrid({
  onSelect,
  onOpenAttractions,
}: {
  onSelect: (item: SubServiceItem) => void;
  onOpenAttractions: () => void;
}) {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const brandingRow = useSiteBrandingStore(
    (s) => s.itemsByKey.builder_e_attractions_widget
  );
  const ui = (brandingRow || getItem("builder_e_attractions_widget")) as BrandCardData;
  const [heroBg, setHeroBg] = useState(
    () => ui.mediaUrl ?? "/brand/hero-background.jpg"
  );
  const [heroTitle, setHeroTitle] = useState(
    () => ui.title ?? "Attractions & Experiences"
  );
  const [heroSub, setHeroSub] = useState(() => ui.description ?? "");

  const pickupDropoff = DRIVER_ITEMS.filter(
    (i) => i.id === "pickup" || i.id === "dropoff"
  );
  const intercity = DRIVER_ITEMS.filter((i) => i.id === "intercity");
  const transitPair = TRANSIT_ITEMS.filter(
    (i) => i.id === "bullet_train" || i.id === "jr_pass"
  );
  const suica = TRANSIT_ITEMS.filter((i) => i.id === "suica");

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHeroBg(ui.mediaUrl ?? "/brand/hero-background.jpg");
    setHeroTitle(ui.title ?? "Attractions & Experiences");
    setHeroSub(ui.description ?? "");
  }, [ui.mediaUrl, ui.title, ui.description]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const branding = await fetchSiteBranding();
      if (cancelled) return;
      const fromPb = brandingAttractionsWidgetUrl(branding);
      if (fromPb) setHeroBg(fromPb);
      const title = (branding?.attractions_widget_title || "").trim();
      const sub = (branding?.attractions_widget_subtitle || "").trim();
      if (title) setHeroTitle(title);
      if (sub) setHeroSub(sub);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="my-6 w-full space-y-6">
      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
          Chauffeur &amp; Transfers
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {pickupDropoff.map((item) => (
            <PhotoLineCard
              key={item.id}
              title={item.title}
              badge={item.badgeTag || "Chauffeur"}
              duration={item.duration}
              photoUrl={item.heroMediaUrl}
              onClick={() => onSelect(item)}
              compact
            />
          ))}
        </div>
        {intercity.map((item) => (
          <PhotoLineCard
            key={item.id}
            title={item.title}
            badge={item.badgeTag || "Chauffeur"}
            duration={item.duration}
            photoUrl={item.heroMediaUrl}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
          Attractions &amp; Experiences
        </h3>
        <PhotoLineCard
          title={heroTitle}
          subtitle={heroSub}
          badge={ui.subtitle ?? "Explore All"}
          photoUrl={heroBg}
          onClick={onOpenAttractions}
          heightClass="h-48"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
          VIP Concierge
        </h3>
        <div className="grid gap-3">
          {VIP_CONCIERGE_ITEMS.map((item) => (
            <PhotoLineCard
              key={item.id}
              title={item.title}
              subtitle={item.description}
              badge={item.requiresTicket ? "Ticketed" : "Concierge"}
              duration={item.duration}
              photoUrl={item.heroMediaUrl}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
          Transit &amp; Passes
        </h3>
        {suica.map((item) => (
          <PhotoLineCard
            key={item.id}
            title={item.title}
            badge={item.badgeTag || "Transit"}
            duration={item.duration}
            photoUrl={item.heroMediaUrl}
            onClick={() => onSelect(item)}
          />
        ))}
        <div className="grid grid-cols-2 gap-3">
          {transitPair.map((item) => (
            <PhotoLineCard
              key={item.id}
              title={item.title}
              badge={item.badgeTag || "Transit"}
              duration={item.duration}
              photoUrl={item.heroMediaUrl}
              onClick={() => onSelect(item)}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  );
}
