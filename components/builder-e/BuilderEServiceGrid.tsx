"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  SUB_SERVICES,
  type SubServiceItem,
} from "@/components/builder-e/subServices";
import {
  getBuilderEAttractions,
  mapTourToVipSubService,
} from "@/lib/experiencesApi";
import {
  brandingAttractionsWidgetUrl,
  fetchSiteBranding,
  getPocketBase,
  type PbCity,
} from "@/lib/pocketbase/client";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { CatalogSlotImg } from "@/components/catalog/CatalogSlotPhoto";
import { WidgetApprovedCheck } from "@/components/branding/WidgetCallingPulse";
import {
  catalogMediaWebUrl,
  ensureCatalogPlaceholder,
} from "@/lib/catalogMedia";

type BrandCardData = {
  mediaUrl?: string;
  title?: string;
  description?: string;
  subtitle?: string;
};

const DRIVER_ITEMS = SUB_SERVICES.filter((s) => s.category === "DRIVER");
const TRANSIT_ITEMS = SUB_SERVICES.filter((s) => s.category === "TRANSIT");

/**
 * Builder S widget anatomy (BuilderSView WIDGET_SHELL / WidgetLabel /
 * WidgetApprovedCheck), extracted with identical classes — Builder S's
 * widgets are inline step cards with step-completion state, so they are
 * not directly reusable for catalog items. Visual parity is the goal:
 * compact dark rounded-[22px] tile, badge top-left, top-right check
 * (teal only when the item is in the cart — grey/muted otherwise, exactly
 * as Builder S renders unapproved steps), bold title, mono sub-line,
 * inner preview area, and a mono caption label BELOW the tile.
 */
const WIDGET_SHELL_E =
  "group relative w-full overflow-visible rounded-[22px] border border-white/10 bg-[#0A1017]/90 p-3.5 text-left shadow-xl transition-all hover:border-amber-500/40 active:scale-95 sm:p-4";

function WidgetTileLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mt-1 block text-center font-mono text-[10px] text-zinc-400">
      {children}
    </span>
  );
}

function WidgetTile({
  title,
  subtitle,
  badge,
  badgeTone = "amber",
  icon,
  caption,
  photoUrl,
  catalogId,
  selected = false,
  showCheck = true,
  wide = false,
  onClick,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: "amber" | "cyan";
  icon?: string;
  /** Caption label below the tile (Builder S: "Hours & Date" style). */
  caption: string;
  photoUrl: string;
  /** When set, photo resolves slot-first: /uploads/catalog/{catalogId}_1.webp */
  catalogId?: string;
  /** In-cart / configured — drives the teal approved check. */
  selected?: boolean;
  showCheck?: boolean;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="min-w-0 overflow-visible">
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        className={`${WIDGET_SHELL_E} flex min-h-[11.5rem] flex-col ${wide ? "sm:min-h-[12rem]" : ""}`}
      >
        {showCheck ? <WidgetApprovedCheck show={selected} /> : null}
        <div className="relative z-10 flex items-center gap-2 pr-7">
          {icon ? (
            <span className="shrink-0 text-base leading-none" aria-hidden>
              {icon}
            </span>
          ) : null}
          {badge ? (
            <span
              className={`truncate rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase ${
                badgeTone === "cyan"
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <div className="relative z-10 mt-2 min-w-0">
          <h4 className="font-godiva line-clamp-2 text-lg leading-tight font-black text-white">
            {title}
          </h4>
          {subtitle ? (
            <p className="mt-1 line-clamp-2 font-mono text-[11px] text-zinc-300">
              {subtitle}
            </p>
          ) : null}
        </div>
        {/* Inner preview — the item's OWN slot photo thumbnail only. */}
        <div className="relative z-10 mt-3 w-full overflow-hidden rounded-xl border border-white/5 bg-black/30">
          <div className={`relative w-full ${wide ? "h-24 sm:h-28" : "h-16 sm:h-20"}`}>
            {catalogId ? (
              <CatalogSlotImg
                recordId={catalogId}
                // Own picture only: the slot itself IS the fallback target
                // when photoUrl already points at it — never fall back to a
                // borrowed generic photo for a different service.
                fallbackSrc={
                  photoUrl && photoUrl !== catalogMediaWebUrl(catalogId)
                    ? photoUrl
                    : ""
                }
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                emptyClassName="absolute inset-0 h-full w-full bg-[#2C2C2E]"
              />
            ) : photoUrl ? (
              <div
                className="absolute inset-0 bg-[#2C2C2E] bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url(${photoUrl})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]" />
            )}
            <span
              className="absolute right-1.5 bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-sm text-[#F6A724] transition-transform group-hover:translate-x-0.5"
              aria-hidden
            >
              →
            </span>
          </div>
        </div>
        <span className="relative z-10 mt-2 font-mono text-[9px] tracking-wider text-zinc-500 uppercase">
          Tap to explore
        </span>
      </button>
      <WidgetTileLabel>{caption}</WidgetTileLabel>
    </div>
  );
}

const TILE_CAPTIONS: Record<string, string> = {
  pickup: "Arrival Transfer",
  dropoff: "Departure Transfer",
  intercity: "Between Cities",
  suica: "IC Card Pass",
  bullet_train: "Reserved Seats",
  jr_pass: "Unlimited Rail",
};

export function BuilderEServiceGrid({
  onSelect,
  onOpenAttractions,
  selectedIds,
}: {
  onSelect: (item: SubServiceItem) => void;
  onOpenAttractions: () => void;
  /** Service/tour IDs already added to this PNR — teal check state. */
  selectedIds?: ReadonlySet<string>;
}) {
  const isSelected = (item: SubServiceItem) =>
    Boolean(
      selectedIds?.has(item.id) ||
        (item.tourId ? selectedIds?.has(item.tourId) : false)
    );
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const getItem = useSiteBrandingStore((s) => s.getItem);
  const brandingRow = useSiteBrandingStore(
    (s) => s.itemsByKey.builder_e_attractions_widget
  );
  const ui = (brandingRow || getItem("builder_e_attractions_widget")) as BrandCardData;
  const [heroBg, setHeroBg] = useState(() => ui.mediaUrl ?? "");
  const [heroTitle, setHeroTitle] = useState(
    () => ui.title ?? "Attractions & Experiences"
  );
  const [heroSub, setHeroSub] = useState(() => ui.description ?? "");
  const [vipItems, setVipItems] = useState<SubServiceItem[]>([]);
  const [vipLoading, setVipLoading] = useState(true);

  // Real `transport_products` record IDs matched to the static transit
  // items (by transport_type / name). When a real record exists its PB
  // ID is the attached slot ID; otherwise the static item id is used.
  const [transitPbIds, setTransitPbIds] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pb = getPocketBase();
        const rows = await pb
          .collection("transport_products")
          .getFullList<{ id: string; name?: string; transport_type?: string }>({
            filter: "is_active != false",
            requestKey: null,
          })
          .catch(() => [] as { id: string; name?: string; transport_type?: string }[]);
        if (cancelled || rows.length === 0) return;
        const match = (pred: (r: (typeof rows)[number]) => boolean) =>
          rows.find(pred)?.id;
        const byTypeOrName = (
          type: string,
          nameRe: RegExp
        ): string | undefined =>
          match((r) => String(r.transport_type || "") === type) ||
          match((r) => nameRe.test(String(r.name || "")));
        const map: Record<string, string> = {};
        const suicaId = byTypeOrName("suica", /suica/i);
        if (suicaId) map.suica = suicaId;
        const bulletId = byTypeOrName("bullet_train", /shinkansen|bullet/i);
        if (bulletId) map.bullet_train = bulletId;
        const jrId = match((r) =>
          /jr\s*(whole|japan|pass)|japan rail pass/i.test(String(r.name || ""))
        );
        if (jrId) map.jr_pass = jrId;
        if (Object.keys(map).length) setTransitPbIds(map);
      } catch {
        // Static slot IDs remain the fallback — never borrowed photos.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Attach each static card's OWN catalog slot: a real transport_products
  // ID when matched above, else the stable static item id. The card then
  // shows only `/uploads/catalog/{catalogId}_1.webp` — its own photo, or
  // the named blank placeholder for that ID when no photo exists yet.
  const withOwnSlot = (item: SubServiceItem): SubServiceItem => {
    const catalogId =
      transitPbIds[item.id] || item.catalogId || item.id;
    const slotUrl = catalogMediaWebUrl(catalogId);
    return {
      ...item,
      catalogId,
      heroMediaUrl: slotUrl,
      galleryUrls: [slotUrl],
    };
  };

  const driverItems = DRIVER_ITEMS.map(withOwnSlot);
  const transitItems = TRANSIT_ITEMS.map(withOwnSlot);

  // Self-heal missing slots with the named blank placeholder. The server
  // endpoint is staff-authed and never overwrites an existing slot, so
  // this is a silent no-op for guests / when the photo already exists.
  useEffect(() => {
    const token = getPocketBase().authStore.token || "";
    for (const item of [...driverItems, ...transitItems]) {
      if (item.catalogId) {
        void ensureCatalogPlaceholder(item.catalogId, item.title, token).catch(
          () => false
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitPbIds]);

  const pickupDropoff = driverItems.filter(
    (i) => i.id === "pickup" || i.id === "dropoff"
  );
  const intercity = driverItems.filter((i) => i.id === "intercity");
  const transitPair = transitItems.filter(
    (i) => i.id === "bullet_train" || i.id === "jr_pass"
  );
  const suica = transitItems.filter((i) => i.id === "suica");

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHeroBg(ui.mediaUrl ?? "");
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

  useEffect(() => {
    let cancelled = false;
    setVipLoading(true);
    (async () => {
      try {
        const pb = getPocketBase();
        const cities = await pb
          .collection("cities")
          .getFullList<PbCity>({ sort: "name" })
          .catch(() => [] as PbCity[]);
        const tours = await getBuilderEAttractions(
          cities.filter((c) => c.is_active !== false)
        );
        if (cancelled) return;
        setVipItems(tours.map(mapTourToVipSubService));
      } catch {
        if (!cancelled) setVipItems([]);
      } finally {
        if (!cancelled) setVipLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const driverTile = (item: SubServiceItem) => (
    <WidgetTile
      key={item.id}
      title={item.title}
      subtitle={
        [item.duration ? `⏱ ${item.duration}` : "", item.routeHint || ""]
          .filter(Boolean)
          .join(" · ") || item.description
      }
      badge={item.badgeTag || "Chauffeur"}
      icon={item.icon}
      caption={TILE_CAPTIONS[item.id] || "Chauffeur & Transfers"}
      photoUrl={item.heroMediaUrl}
      catalogId={item.catalogId || item.id}
      selected={isSelected(item)}
      onClick={() => onSelect(item)}
    />
  );

  const transitTile = (item: SubServiceItem) => (
    <WidgetTile
      key={item.id}
      title={item.title}
      subtitle={
        [item.duration ? `⏱ ${item.duration}` : "", item.routeHint || ""]
          .filter(Boolean)
          .join(" · ") || item.description
      }
      badge={item.badgeTag || "Transit"}
      badgeTone="cyan"
      icon={item.icon}
      caption={TILE_CAPTIONS[item.id] || "Transit & Passes"}
      photoUrl={item.heroMediaUrl}
      catalogId={item.catalogId || item.id}
      selected={isSelected(item)}
      onClick={() => onSelect(item)}
    />
  );

  return (
    <div className="my-6 w-full space-y-6">
      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
          Chauffeur &amp; Transfers
        </h3>
        <div className="grid grid-cols-2 items-start gap-3.5">
          {pickupDropoff.map(driverTile)}
          {intercity.map(driverTile)}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
          Attractions &amp; Experiences
        </h3>
        {/* Wide discovery entry kept wide (it opens the explorer, it is
            not a selectable catalog item) — same shell/badge/caption
            family, no check so no fake selected state. */}
        <WidgetTile
          title={heroTitle}
          subtitle={heroSub}
          badge={ui.subtitle ?? "Explore All"}
          caption="Explore Tours & Tickets"
          photoUrl={heroBg}
          showCheck={false}
          wide
          onClick={onOpenAttractions}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
          VIP Concierge
        </h3>
        {vipLoading ? (
          <p className="rounded-[22px] border border-white/10 bg-[#0A1017]/90 px-4 py-6 text-center text-xs text-zinc-500">
            Loading VIP experiences…
          </p>
        ) : vipItems.length === 0 ? (
          <p className="rounded-[22px] border border-white/10 bg-[#0A1017]/90 px-4 py-6 text-center text-xs text-zinc-500">
            No ticketed VIP experiences in the catalog yet. Ops: add them in{" "}
            <Link
              href="/team-access/source-wizard"
              className="text-[#7dd3fc] underline underline-offset-2 hover:text-cyan-200"
            >
              Catalog Wizard
            </Link>{" "}
            (experiences · ticketed / VIP).
          </p>
        ) : (
          <div className="grid grid-cols-2 items-start gap-3.5">
            {vipItems.map((item) => (
              <WidgetTile
                key={item.id}
                title={item.title}
                subtitle={item.description}
                badge={
                  item.badgeTag ||
                  (item.requiresTicket ? "Ticketed" : "Concierge")
                }
                icon={item.icon}
                caption={
                  item.requiresTicket
                    ? "Ticketed Experience"
                    : "Concierge Experience"
                }
                photoUrl={item.heroMediaUrl}
                catalogId={item.tourId || item.id}
                selected={isSelected(item)}
                onClick={() => onSelect(item)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
          Transit &amp; Passes
        </h3>
        <div className="grid grid-cols-2 items-start gap-3.5">
          {suica.map(transitTile)}
          {transitPair.map(transitTile)}
        </div>
      </div>
    </div>
  );
}
