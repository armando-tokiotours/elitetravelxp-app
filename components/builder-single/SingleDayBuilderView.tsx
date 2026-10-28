"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
import {
  fetchExperiencesAndPlaces,
  mapEapToTour,
  type BuilderConfig,
  type PbCity,
  type PbTour,
} from "@/lib/pocketbase/client";
import {
  emptyBuilderConfigShell,
  fetchBuilderConfigShell,
  getBuilderConfig,
  peekBuilderConfigCache,
} from "@/lib/builderConfigCache";
import {
  journeyBuilderHref,
  journeyItineraryHref,
} from "@/lib/builderRoutes";
import {
  bookingBoundRef,
  useJourneyKindGuard,
} from "@/lib/bookingKindGuard";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import {
  hydrateSingleDayBookingByRef,
  isSingleDayRefHydrated,
  type SingleDayPaymentSlice,
} from "@/lib/singleDayBookingHydrate";
import { hydrateTourPayments } from "@/lib/feeCredit";
import { guestPaymentBadgeLabel } from "@/lib/tourPaymentStatus";
import { useBuilderStore } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { SingleDayBuilderHero } from "@/components/builder-single/SingleDayBuilderHero";
import {
  getWidgetPulsarClass,
  WidgetCallingPulse,
} from "@/components/branding/WidgetCallingPulse";

const BuilderSView = dynamic(
  () =>
    import("@/components/builder-single/BuilderSView").then((m) => ({
      default: m.BuilderSView,
    })),
  {
    loading: () => (
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-zinc-500">
        Loading builder…
      </div>
    ),
  }
);
import {
  readBuilderSHeroLocalCache,
  SINGLE_DAY_BUILDER_HERO_KEY,
} from "@/config/mediaConfig";
import {
  builderSDisplayCity,
  resolveBuilderSHeroCopy,
} from "@/config/teamConfig";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

export function SingleDayBuilderView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /** Never block first paint on catalog — grey shell instantly. */
  const [config, setConfig] = useState<BuilderConfig | null>(
    () => peekBuilderConfigCache() ?? emptyBuilderConfigShell()
  );
  const [extraPlaces, setExtraPlaces] = useState<PbTour[]>([]);
  const [guestBadge, setGuestBadge] = useState({
    name: "Guest Brief",
    email: "",
  });
  const [savePulsarActive, setSavePulsarActive] = useState(false);
  /** Saved-booking pre-hydration for `?ref=` edit mode (once per ref). */
  const boundRef = bookingBoundRef(searchParams.get("ref"));
  const [remoteHydrating, setRemoteHydrating] = useState(Boolean(boundRef));
  const [paymentLabel, setPaymentLabel] = useState<string | null>(null);

  // Mirror of BuilderApp: a bound multi_day ref must not paint the
  // 1-Day builder/menu; the guard redirects it to japan-journey.
  const journeyGuard = useJourneyKindGuard(
    "single_day",
    searchParams.get("ref")
  );
  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const tripMode = useBuilderStore((s) => s.tripMode);
  const replacedRefFor = useRef<string | null>(null);

  // Entry gate: Section 1 (full-screen hero) shows first and UNMOUNTS
  // when "Start Building" is tapped — the user is then locked into the
  // builder until a page refresh. Saved-booking arrivals (?ref=) skip
  // the hero entirely and land straight in their builder.
  const [hasStarted, setHasStarted] = useState(Boolean(boundRef));
  const startBuilding = () => {
    setHasStarted(true);
    window.scrollTo({ top: 0 });
  };

  // Landed without ?ref= (nav dock / sidebar / bottom-nav legacy links)
  // but a confirmed single-day booking is already bound in the store:
  // pin ?ref=<PNR> into the URL so reloads, shares and the itinerary
  // round-trip keep the saved-booking context instead of a blank draft.
  // Official PNRs only (bookingBoundRef excludes DRAFT-/TMP-) — fresh
  // bookings with no confirmed ref are never forced.
  useEffect(() => {
    if (searchParams.get("ref")) return;
    let cancelled = false;
    void (async () => {
      // Persisted confirmed ref may arrive a tick after first paint.
      await Promise.resolve(useBuilderStore.persist.rehydrate()).catch(
        () => undefined
      );
      if (cancelled) return;
      const live = useBuilderStore.getState();
      const bound = bookingBoundRef(live.confirmedBookingRef);
      if (!bound || live.tripMode !== "single_day") return;
      if (replacedRefFor.current === bound) return;
      replacedRefFor.current = bound;
      router.replace(journeyBuilderHref(bound, { type: "single_day" }), {
        scroll: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams, tripMode]);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const ensureTemp = useBuilderStore((s) => s.ensureTempBookingRef);
  const promoteDraftOnContact = useBuilderStore((s) => s.promoteDraftOnContact);

  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const changeCityFocus = useSingleDayBuilderStore((s) => s.changeCityFocus);

  // Instant pre-hydration when a saved booking ref is present: pull the
  // BAL row (ref-only contact lookup) into the single-day store so city,
  // date, hours, party, pace, meeting and experiences arrive pre-selected
  // instead of as empty placeholder steps. Runs once per ref — the helper
  // pins hydrated refs, so step edits / store changes never re-trigger
  // it and never get overwritten. Local Pre-Elite hydration in the mount
  // effect below still runs first; the server row wins when it exists.
  useEffect(() => {
    if (!boundRef) {
      setRemoteHydrating(false);
      setPaymentLabel(null);
      return;
    }
    let cancelled = false;
    setRemoteHydrating(true);
    void (async () => {
      const booking = await hydrateSingleDayBookingByRef(boundRef);
      if (cancelled) return;
      if (booking) {
        const it = useItineraryStore.getState();
        const pre = usePreBuilderStore.getState();
        const name = (
          it.clientName ||
          booking.fullName ||
          pre.fullName ||
          pre.lastPayload?.fullName ||
          "Guest Brief"
        ).trim();
        const email = (
          it.clientEmail ||
          booking.email ||
          pre.email ||
          pre.lastPayload?.email ||
          ""
        )
          .trim()
          .toLowerCase();
        setGuestBadge({ name: name || "Guest Brief", email });

        // Refine fee/total from the payments ledger (same helper the
        // itinerary page uses); package total comes from ops_hub.
        let payment: SingleDayPaymentSlice = booking.payment;
        try {
          const refined = await hydrateTourPayments(boundRef);
          if (!cancelled && (refined.feeCreditEur > 0 || refined.totalPaidEur > 0)) {
            payment = {
              ...payment,
              feeCreditEur: Math.max(payment.feeCreditEur, refined.feeCreditEur),
              totalPaidEur: Math.max(payment.totalPaidEur, refined.totalPaidEur),
              conciergeFeePaid:
                payment.conciergeFeePaid || refined.feeCreditEur > 0,
            };
          }
        } catch {
          /* contact payment slice is enough */
        }
        if (!cancelled) setPaymentLabel(guestPaymentBadgeLabel(payment));
      }
      if (!cancelled) setRemoteHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per ref only
  }, [boundRef]);

  useEffect(() => {
    ensureTemp();
    // tripMode adoption/redirect is owned by useJourneyKindGuard above —
    // a bound multi_day ref must not be flipped to single_day here.

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
      const hasContact = Boolean(
        email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      );
      promoteDraftOnContact(hasContact);
      setGuestBadge({ name: name || "Guest Brief", email });
    };
    syncGuestBadge();

    const ref = searchParams.get("ref");
    if (ref) {
      const pre = usePreBuilderStore.getState();
      if (
        // Once the server row for this ref has hydrated the stores, the
        // stale Pre-Elite brief (original party size, e.g. 1) must never
        // re-apply on SPA revisits — it clobbered fresh guests edits.
        !isSingleDayRefHydrated(ref) &&
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
        const cached = peekBuilderConfigCache();
        if (cached) {
          setConfig(cached);
        } else {
          // Cities-only — does not wait for tours / 15-list catalog.
          const shell = await fetchBuilderConfigShell();
          if (cancelled) return;
          setConfig(shell);
        }

        const [cfg, eap] = await Promise.all([
          getBuilderConfig(),
          fetchExperiencesAndPlaces(),
        ]);
        if (cancelled) return;
        setConfig(cfg);
        setExtraPlaces(
          eap
            .filter((r) => r.is_active !== false)
            .map((r) => mapEapToTour(r, cfg.cities))
        );
      } catch {
        /* keep painted shell */
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + ref only
  }, [ensureTemp, promoteDraftOnContact, searchParams]);

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
  // Prefix ("YOUR DAY IN") intentionally no longer rendered in the strip — city name only, centred.
  void heroCopy;
  const displayCity = builderSDisplayCity(cityFocus);

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

  // Bound multi-day booking landed on the 1-Day builder: don't paint it.
  if (journeyGuard.status !== "ok") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-transparent text-sm text-zinc-400">
        Opening your booking…
      </div>
    );
  }

  // Started builder uses itinerary cream `#faf9f4`. Hero keeps its own
  // dark full-bleed paint; outer cream only matters once cards mount.
  return (
    <div
      className={`min-h-screen overflow-x-clip overflow-y-visible ${
        hasStarted ? "bg-[#faf9f4]" : "bg-transparent"
      }`}
    >
      <div
        className={`builder-theme relative min-h-screen overflow-x-clip overflow-y-visible [color-scheme:dark] ${
          hasStarted
            ? "bg-[#faf9f4] text-slate-900"
            : "bg-transparent text-white"
        }`}
      >
        <MobileTopChrome
          brandTitle="1-Day Express Pass"
          tone={hasStarted ? "light" : "dark"}
          ctaHref={journeyItineraryHref(
            boundRef ?? bookingBoundRef(confirmedBookingRef),
            { type: "single_day" }
          )}
          ctaLabel="Itinerary"
        />

        <div
          className={`relative ${hasStarted ? "bg-[#faf9f4]" : "bg-transparent"}`}
        >
          {/* Section 1 — full-screen hero landing (unmounts on entry) */}
          {!hasStarted ? (
            <SingleDayBuilderHero onStartBuilding={startBuilding} />
          ) : null}

          {/* Section 2 — the builder UI (booking ref, steps, cards) */}
          {hasStarted ? (
            <section className="animate-fade-up relative z-20 min-h-screen w-full scroll-mt-2 bg-[#faf9f4]">
            <div className="mx-auto w-full max-w-2xl space-y-4 bg-[#faf9f4] px-4 pb-40 pt-0 sm:max-w-3xl sm:px-6">
              {/* Title + restart now live inside the guest strip (below);
                  only the payment milestone keeps a row here, when present. */}
              {paymentLabel ? (
                <div className="flex items-center justify-end gap-4">
                  <span className="max-w-[12rem] truncate rounded-lg border border-emerald-500/60 bg-emerald-950/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 sm:max-w-[16rem]">
                    {paymentLabel}
                  </span>
                </div>
              ) : null}

              {boundRef && remoteHydrating ? (
                <div
                  className="flex min-h-[12rem] items-center justify-center rounded-[22px] border border-white/10 bg-[#0A1017]/70 text-sm text-zinc-400"
                  role="status"
                >
                  Loading your saved booking…
                </div>
              ) : (
                <BuilderSView
                  config={config}
                  catalog={experiencesCatalog}
                  selectedCity={selectedCity}
                  onSelectCity={handleSelectCity}
                  headerSlot={
                    <div className="flex w-full flex-col items-start gap-1.5">
                      {/* Client name above the Booking Ref box */}
                      {/* leading-9 (36px at all widths) = the h-9 strip-title line, so the centred title shares its exact vertical centre */}
                      <span className="ml-1 text-xs font-bold tracking-widest text-slate-900 uppercase leading-9">
                        {guestBadge.name}
                      </span>
                      <BookingRefBadge
                        tempBookingRef={tempBookingRef}
                        confirmedBookingRef={confirmedBookingRef}
                        bookingStatus={bookingStatus}
                        paymentLabel={null}
                        hasGuestContact={Boolean(
                          guestBadge.email &&
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestBadge.email)
                        )}
                      />
                    </div>
                  }
                  stripTitleSlot={
                    <div className="flex w-full min-w-0 items-center justify-center text-center">
                      <h2 className="min-w-0 truncate font-godiva text-[15px] font-bold uppercase tracking-wide text-slate-900 md:text-lg">
                        {displayCity}
                      </h2>
                    </div>
                  }
                  stripTrailingSlot={
                    <NewBookingResetButton variant="strip" tone="light" />
                  }
                  onActivePulsarStepChange={(step) => {
                    setSavePulsarActive(step === "save");
                  }}
                />
              )}

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      // Touch store so zustand persist flushes the latest
                      // city/date/stops before full-page itinerary navigation.
                      const live = useSingleDayBuilderStore.getState();
                      useSingleDayBuilderStore.setState({
                        selectedExperiences: [...live.selectedExperiences],
                        cityFocus: live.cityFocus,
                        tourDate: live.tourDate,
                        tourHours: live.tourHours,
                        startTime: live.startTime,
                        meetingPoint: live.meetingPoint,
                        meetingPointName: live.meetingPointName,
                        preferredMovement: live.preferredMovement,
                      });
                      const email =
                        guestBadge.email ||
                        useItineraryStore.getState().clientEmail ||
                        "";
                      const ref = confirmedBookingRef || tempBookingRef || "";
                      if (email && ref) {
                        try {
                          const { syncSingleDayBookingLead } = await import(
                            "@/lib/syncBookingLead"
                          );
                          await syncSingleDayBookingLead({
                            bookingRef: ref,
                            email,
                            state: useSingleDayBuilderStore.getState(),
                            cityId: selectedCity?.id,
                            status: "lead",
                          });
                        } catch {
                          /* local persist is enough for itinerary view */
                        }
                      }
                      window.location.href = journeyItineraryHref(ref, {
                        type: "single_day",
                      });
                    })();
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
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
