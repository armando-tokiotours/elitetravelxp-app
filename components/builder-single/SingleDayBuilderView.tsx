"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
import {
  fetchBuilderConfig,
  fetchExperiencesAndPlaces,
  mapEapToTour,
  type BuilderConfig,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import { useBuilderStore } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { SingleDayBuilderHero } from "@/components/builder-single/SingleDayBuilderHero";
import { BuilderSView } from "@/components/builder-single/BuilderSView";
import {
  getWidgetPulsarClass,
  WidgetCallingPulse,
} from "@/components/branding/WidgetCallingPulse";
import {
  readBuilderSHeroLocalCache,
  SINGLE_DAY_BUILDER_HERO_KEY,
} from "@/config/mediaConfig";
import {
  builderSDisplayCity,
  builderSTagline,
  resolveBuilderSHeroCopy,
} from "@/config/teamConfig";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

export function SingleDayBuilderView() {
  const searchParams = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [extraPlaces, setExtraPlaces] = useState<PbTour[]>([]);
  const [guestBadge, setGuestBadge] = useState({
    name: "Guest Brief",
    email: "",
  });
  const [savePulsarActive, setSavePulsarActive] = useState(false);

  const setTripMode = useBuilderStore((s) => s.setTripMode);
  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const ensureTemp = useBuilderStore((s) => s.ensureTempBookingRef);

  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const changeCityFocus = useSingleDayBuilderStore((s) => s.changeCityFocus);

  useEffect(() => {
    ensureTemp();
    setTripMode("single_day");

    const syncGuestBadge = () => {
      const it = useItineraryStore.getState();
      const pre = usePreBuilderStore.getState();
      const name = (
        it.clientName ||
        pre.fullName ||
        pre.lastPayload?.fullName ||
        "Guest Brief"
      ).trim();
      const email = (
        it.clientEmail ||
        pre.email ||
        pre.lastPayload?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      setGuestBadge({ name: name || "Guest Brief", email });
    };
    syncGuestBadge();

    const ref = searchParams.get("ref");
    if (ref) {
      const pre = usePreBuilderStore.getState();
      if (
        pre.lastPayload?.bookingRef === ref &&
        pre.lastPayload.itineraryData
      ) {
        hydrateStoresFromPreEliteBrief({
          bookingRef: ref,
          fullName: pre.lastPayload.fullName,
          email: pre.lastPayload.email,
          itineraryData: pre.lastPayload.itineraryData,
        });
        syncGuestBadge();
      }
    }

    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchBuilderConfig();
        if (cancelled) return;
        setConfig(cfg);
        const eap = await fetchExperiencesAndPlaces();
        if (cancelled) return;
        setExtraPlaces(
          eap
            .filter((r) => r.is_active !== false)
            .map((r) => mapEapToTour(r, cfg.cities))
        );
      } catch {
        if (!cancelled) {
          setConfig(null);
          setExtraPlaces([]);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + ref only
  }, [ensureTemp, searchParams, setTripMode]);

  const ensureBranding = useSiteBrandingStore((s) => s.ensureLoaded);
  const getBrandingItem = useSiteBrandingStore((s) => s.getItem);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  void brandingItems;

  useEffect(() => {
    void ensureBranding();
  }, [ensureBranding]);

  const heroCopy = (() => {
    const fromPb = resolveBuilderSHeroCopy(
      getBrandingItem(SINGLE_DAY_BUILDER_HERO_KEY)
    );
    const local = readBuilderSHeroLocalCache();
    if (!local) return fromPb;
    return {
      scriptAccent: local.scriptAccent?.trim() || fromPb.scriptAccent,
      mainTitlePrefix: local.mainTitlePrefix?.trim() || fromPb.mainTitlePrefix,
      tagline: local.tagline?.trim() || fromPb.tagline,
    };
  })();
  const displayCity = builderSDisplayCity(cityFocus);
  const dayTagline = builderSTagline(cityFocus, heroCopy.tagline);

  const cities = config?.cities ?? [];
  const selectedCity = useMemo(() => {
    const needle = cityFocus.trim().toLowerCase();
    if (!needle) return null;
    return (
      cities.find((c) => c.name.trim().toLowerCase() === needle) ??
      cities.find((c) => c.name.trim().toLowerCase().includes(needle)) ??
      null
    );
  }, [cities, cityFocus]);

  const experiencesCatalog = useMemo(() => {
    const tours = config?.tours ?? [];
    const ids = new Set(tours.map((t) => t.id));
    return [...tours, ...extraPlaces.filter((p) => !ids.has(p.id))];
  }, [config?.tours, extraPlaces]);

  const handleSelectCity = (city: PbCity) => {
    changeCityFocus(city.name);
  };

  if (!hydrated) {
    return (
      <div className="tokio-ambient-bg flex min-h-dvh items-center justify-center text-sm text-zinc-400">
        Loading single-day builder…
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip overflow-y-visible bg-[#04080C]">
      <div className="builder-theme relative min-h-screen overflow-x-clip overflow-y-visible bg-[#04080C] text-white [color-scheme:dark]">
        <MobileTopChrome
          brandTitle="Builders"
          ctaHref="/builder-single/itinerary"
          ctaLabel="Itinerary"
        />

        <div className="relative bg-[#04080C]">
          <SingleDayBuilderHero />

          <div className="relative z-20 -mt-20 w-full bg-transparent sm:-mt-28">
            <div className="mx-auto w-full max-w-2xl px-4 pb-8 sm:max-w-3xl">
              <div className="tokio-glass-sheet w-full overflow-visible rounded-t-3xl border border-white/10 bg-[#0A1017]/95 text-left shadow-2xl backdrop-blur-md">
                <div className="rounded-t-3xl px-5 pb-5 pt-6 sm:px-6">
                  <div className="flex items-start justify-between gap-4 pt-1">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        {heroCopy.mainTitlePrefix}
                      </p>
                      <h2 className="font-godiva text-2xl font-bold uppercase tracking-wide text-white md:text-3xl">
                        {displayCity}
                      </h2>
                      <p className="mt-2 text-xs text-zinc-400">
                        {dayTagline}
                      </p>
                    </div>
                    <div className="shrink-0 space-y-0.5 text-right">
                      <p className="text-xs font-bold text-white">
                        {guestBadge.name}
                      </p>
                      {guestBadge.email ? (
                        <p className="max-w-[14rem] truncate font-mono text-[10px] text-cyan-400 sm:max-w-[18rem]">
                          {guestBadge.email}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex w-full items-stretch gap-2">
                    <div className="min-w-0 flex-1">
                      <BookingRefBadge
                        tempBookingRef={tempBookingRef}
                        confirmedBookingRef={confirmedBookingRef}
                        bookingStatus={bookingStatus}
                      />
                    </div>
                    <NewBookingResetButton />
                  </div>
                </div>

                <div className="px-0 pb-40 pt-0">
                  <BuilderSView
                    config={config}
                    catalog={experiencesCatalog}
                    selectedCity={selectedCity}
                    onSelectCity={handleSelectCity}
                    onActivePulsarStepChange={(step) => {
                      setSavePulsarActive(step === "save");
                    }}
                  />

                  <div className="mt-2 flex flex-col gap-3 px-4 sm:flex-row sm:px-6">
                    <button
                      type="button"
                      onClick={() => {
                        const email =
                          guestBadge.email ||
                          useItineraryStore.getState().clientEmail ||
                          "";
                        const ref =
                          confirmedBookingRef || tempBookingRef || "";
                        if (email && ref) {
                          void import("@/lib/syncBookingLead").then(
                            ({ syncSingleDayBookingLead }) =>
                              syncSingleDayBookingLead({
                                bookingRef: ref,
                                email,
                                state: useSingleDayBuilderStore.getState(),
                                cityId: selectedCity?.id,
                                status: "lead",
                              })
                          );
                        }
                        window.location.href = "/builder-single/itinerary";
                      }}
                      className={`relative flex flex-1 items-center justify-center overflow-visible rounded-full bg-[#054F70] py-3.5 text-sm font-semibold text-white transition hover:bg-[#043d57] ${
                        savePulsarActive
                          ? getWidgetPulsarClass("save", "save")
                          : ""
                      }`}
                    >
                      <WidgetCallingPulse
                        active={savePulsarActive}
                        roundedClass="rounded-full"
                      />
                      <span className="relative z-[1]">
                        Save &amp; View Itinerary
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
