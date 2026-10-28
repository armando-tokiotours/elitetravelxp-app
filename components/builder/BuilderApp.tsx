"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  type BuilderConfig,
  type PbAccommodation,
} from "@/lib/pocketbase/client";
import {
  emptyBuilderConfigShell,
  fetchBuilderConfigShell,
  getBuilderConfig,
  peekBuilderConfigCache,
} from "@/lib/builderConfigCache";
import { BUILDER_ROUTES } from "@/lib/builderRoutes";
import { useJourneyKindGuard } from "@/lib/bookingKindGuard";
import {
  hydrateMultiDayBookingByRef,
  isMultiDayRefHydrated,
  type MultiDayPaymentSlice,
} from "@/lib/multiDayBookingHydrate";
import { hydrateTourPayments } from "@/lib/feeCredit";
import { guestPaymentBadgeLabel } from "@/lib/tourPaymentStatus";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import { useBuilderStore } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { BuilderHero } from "./BuilderHero";
import { BookingRefBadge } from "./BookingRefBadge";
import { NewBookingResetButton } from "./NewBookingResetButton";

const BuilderMView = dynamic(
  () =>
    import("./BuilderMView").then((m) => ({
      default: m.BuilderMView,
    })),
  {
    loading: () => (
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-zinc-500">
        Loading journey builder…
      </div>
    ),
  }
);

export function BuilderApp() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<BuilderConfig | null>(
    () => peekBuilderConfigCache() ?? emptyBuilderConfigShell()
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const state = useBuilderStore();
  const [paymentLabel, setPaymentLabel] = useState<string | null>(null);
  const [guestBadge, setGuestBadge] = useState({
    name: "Guest Brief",
    email: "",
  });
  const setArrival = useBuilderStore((s) => s.setArrivalTransferId);
  const setDeparture = useBuilderStore((s) => s.setDepartureTransferId);
  const setTransit = useBuilderStore((s) => s.setTransitModeId);
  const addLocation = useBuilderStore((s) => s.addLocation);
  const revalidateBuilderUnlock = useBuilderStore(
    (s) => s.revalidateBuilderUnlock
  );
  // Locked hero gate: on a fresh mount only the full-screen hero is
  // rendered and page scroll is locked, so Section 2 (builder UI) is not
  // reachable by scrolling. "Start Building" unmounts the hero for the
  // rest of this mount — there is no scroll/nav path back to it. The
  // hero returns only when BuilderApp remounts: a page refresh/reload,
  // or a fresh builder entry after loading a booking (Retrieve /
  // Manage Booking push to the itinerary, whose edit entry and any
  // ?ref= builder link mount BuilderApp anew behind the hero).
  // Deliberately component-local state: never persist this flag.
  const [hasEnteredBuilder, setHasEnteredBuilder] = useState(false);
  const builderRef = useRef<HTMLElement>(null);
  const scrollToBuilder = () => {
    setHasEnteredBuilder(true);
  };

  // Scroll-lock while the hero gate is closed.
  useEffect(() => {
    if (hasEnteredBuilder) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.scrollTo(0, 0);
    // `overflow: hidden` alone still permits programmatic scroll where
    // page chrome leaves slack (e.g. mobile bottom padding) — pin to 0.
    const pinToTop = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    window.addEventListener("scroll", pinToTop, { passive: true });
    return () => {
      window.removeEventListener("scroll", pinToTop);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [hasEnteredBuilder]);

  // Land at the top of Section 2 once the hero unmounts.
  useEffect(() => {
    if (!hasEnteredBuilder) return;
    builderRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [hasEnteredBuilder]);

  const ensureTempBookingRef = useBuilderStore((s) => s.ensureTempBookingRef);
  const promoteDraftOnContact = useBuilderStore((s) => s.promoteDraftOnContact);

  // A booking-bound ref owns the mode: single_day (e.g. JPN-5CC72J) must
  // never paint the Grand Japan Journey builder/menu — the guard redirects
  // to /builder/day-pass?ref=… and repairs tripMode for nav chrome. Only
  // ref-less fresh trips adopt multi_day here.
  const journeyGuard = useJourneyKindGuard(
    "multi_day",
    searchParams.get("ref")
  );

  useEffect(() => {
    const syncGuestBadge = () => {
      const it = useItineraryStore.getState();
      const pre = usePreBuilderStore.getState();
      let storedName = "";
      let storedEmail = "";
      try {
        const raw = localStorage.getItem("travelxp-itinerary-profile");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            state?: { clientName?: string; clientEmail?: string };
          };
          storedName = String(parsed.state?.clientName || "").trim();
          storedEmail = String(parsed.state?.clientEmail || "")
            .trim()
            .toLowerCase();
        }
      } catch {
        /* ignore */
      }

      const name = (
        it.clientName ||
        pre.fullName ||
        pre.lastPayload?.fullName ||
        storedName ||
        ""
      ).trim();
      const email = (
        it.clientEmail ||
        pre.email ||
        pre.lastPayload?.email ||
        storedEmail ||
        ""
      )
        .trim()
        .toLowerCase();

      if (name && !it.clientName) it.setClientName(name);
      if (email && !it.clientEmail) it.setClientEmail(email);

      const hasContact = Boolean(
        email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      );
      promoteDraftOnContact(hasContact);

      setGuestBadge({
        name: name || "Guest Brief",
        email,
      });
    };

    useBuilderStore.persist.rehydrate();
    void Promise.all([
      usePreBuilderStore.persist.rehydrate(),
      useItineraryStore.persist.rehydrate(),
    ]).finally(syncGuestBadge);

    const unsubIt = useItineraryStore.subscribe(syncGuestBadge);
    const unsubPre = usePreBuilderStore.subscribe(syncGuestBadge);
    const unsubHydrate = useBuilderStore.persist.onFinishHydration(() => {
      ensureTempBookingRef();
      syncGuestBadge();
    });
    if (useBuilderStore.persist.hasHydrated()) {
      ensureTempBookingRef();
    }
    return () => {
      unsubIt();
      unsubPre();
      unsubHydrate();
    };
  }, [ensureTempBookingRef, promoteDraftOnContact]);

  // Existing booking → builder: server row first (parity with Single-Day).
  // Prefer ?ref=; if the URL has none, still rehydrate from the bound PNR
  // already in the persisted store so a plain /builder refresh recovers
  // the last saved collection row (not empty defaults).
  useEffect(() => {
    let cancelled = false;

    const run = async (refRaw: string) => {
      const ref = String(refRaw || "")
        .trim()
        .toUpperCase();
      if (!ref) return;

      const booking = isMultiDayRefHydrated(ref)
        ? null
        : await hydrateMultiDayBookingByRef(ref);
      if (cancelled) return;

      if (booking) {
        if (booking.fullName || booking.email) {
          setGuestBadge({
            name: booking.fullName || "Guest Brief",
            email: booking.email,
          });
        }
        let payment: MultiDayPaymentSlice = booking.payment;
        try {
          const refined = await hydrateTourPayments(ref);
          if (
            !cancelled &&
            (refined.feeCreditEur > 0 || refined.totalPaidEur > 0)
          ) {
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
        return;
      }
      if (isMultiDayRefHydrated(ref)) return;

      const pre = usePreBuilderStore.getState();
      if (pre.bookingRef === ref && pre.lastPayload?.itineraryData) {
        hydrateStoresFromPreEliteBrief({
          bookingRef: ref,
          fullName: pre.lastPayload.fullName,
          email: pre.lastPayload.email,
          itineraryData: pre.lastPayload.itineraryData,
        });
        setGuestBadge({
          name: (pre.lastPayload.fullName || "").trim() || "Guest Brief",
          email: (pre.lastPayload.email || "").trim().toLowerCase(),
        });
        return;
      }

      // Opening builder with an existing lead ref still advances draft → in_progress
      void import("@/lib/bookingLifecycle").then(
        ({ requestAdvanceBookingInProgress }) =>
          requestAdvanceBookingInProgress(ref)
      );
    };

    const fromUrl = String(searchParams.get("ref") || "")
      .trim()
      .toUpperCase();
    if (fromUrl) {
      void run(fromUrl);
      return () => {
        cancelled = true;
      };
    }

    // No ?ref= — wait for zustand rehydrate, then pull the bound store PNR.
    const bootFromStore = () => {
      if (cancelled) return;
      const s = useBuilderStore.getState();
      const storeRef = String(
        s.confirmedBookingRef || s.tempBookingRef || ""
      )
        .trim()
        .toUpperCase();
      // Only official PNRs (hydrate helper ignores DRAFT-/TMP-).
      if (storeRef && !storeRef.startsWith("DRAFT-") && !storeRef.startsWith("TMP-")) {
        void run(storeRef);
      }
    };
    const unsub = useBuilderStore.persist.onFinishHydration(bootFromStore);
    if (useBuilderStore.persist.hasHydrated()) bootFromStore();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [searchParams]);

  // Re-validation: clamp unlock when earlier steps become incomplete
  useEffect(() => {
    revalidateBuilderUnlock();
  }, [
    state.arrivalDate,
    state.durationDays,
    state.adults,
    state.children,
    state.arrivalTransferId,
    state.departureTransferId,
    state.locations,
    state.cityHotels,
    revalidateBuilderUnlock,
  ]);

  useEffect(() => {
    // Don't seed multi-day defaults (locations/nights) while a bound
    // single-day booking is being verified / redirected away.
    if (journeyGuard.status !== "ok") return;
    let cancelled = false;

    const applyDefaults = (data: BuilderConfig) => {
      const snap = useBuilderStore.getState();
      if (!snap.arrivalTransferId) {
        const firstAirport =
          data.hubs.find((h) => h.type === "Airport") || data.hubs[0];
        if (firstAirport) setArrival(firstAirport.id);
        else if (data.transfers[0]) setArrival(data.transfers[0].id);
      }
      if (!snap.departureTransferId) {
        const airports = data.hubs.filter((h) => h.type === "Airport");
        const second = airports[1] || airports[0] || data.hubs[0];
        if (second) setDeparture(second.id);
        else if (data.transfers[1] || data.transfers[0]) {
          setDeparture(data.transfers[1]?.id ?? data.transfers[0].id);
        }
      }
      if (!snap.transitModeId && data.transitModes[0]) {
        setTransit(data.transitModes[0].id);
      }
      const after = useBuilderStore.getState();
      const middle = after.locations.filter(
        (l) =>
          !l.isTransitHub &&
          l.key !== "__transit_arrival__" &&
          l.key !== "__transit_departure__"
      );
      if (middle.length === 0 && data.cities[0]) {
        addLocation(data.cities[0].id);
        useBuilderStore
          .getState()
          .redistributeStayNights(useBuilderStore.getState().durationDays);
      } else if (middle.length > 0) {
        const assigned = middle.reduce((sum, l) => sum + (l.nights || 0), 0);
        if (assigned !== after.durationDays) {
          useBuilderStore
            .getState()
            .redistributeStayNights(after.durationDays);
        }
      }
    };

    (async () => {
      try {
        const cached = peekBuilderConfigCache();
        if (cached) {
          setConfig(cached);
          applyDefaults(cached);
        } else {
          const shell = await fetchBuilderConfigShell();
          if (cancelled) return;
          setConfig(shell);
          applyDefaults(shell);
        }

        const data = await getBuilderConfig();
        if (cancelled) return;
        setConfig(data);
        applyDefaults(data);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load trip configuration from PocketBase."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addLocation, setArrival, setDeparture, setTransit, journeyGuard.status]);

  const handleAccommodationsLoaded = useCallback(
    (rows: PbAccommodation[]) => {
      setConfig((prev) => (prev ? { ...prev, accommodations: rows } : prev));
    },
    []
  );

  // Bound single-day/experience booking landed on the multi-day builder:
  // never paint the Grand Japan Journey hero/stepper for it.
  if (journeyGuard.status !== "ok") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
        Opening your booking…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="builder-theme relative min-h-screen bg-transparent text-white [color-scheme:dark]">
        <MobileTopChrome
          brandTitle="Grand Japan Journey"
          ctaHref={BUILDER_ROUTES.japanJourneyItinerary}
          ctaLabel="Itinerary"
        />

        <div className="relative bg-transparent">
          {!hasEnteredBuilder ? (
            <BuilderHero
              branding={config?.branding ?? null}
              onStartBuilding={scrollToBuilder}
            />
          ) : (
            <>
              {/* Section 2 — the builder UI (booking ref, steps, cards).
              Cards mount directly on the page canvas — no outer glass wrapper box */}
              <section
            ref={builderRef}
            className="relative z-20 w-full scroll-mt-2 bg-transparent"
          >
            <div className="mx-auto max-w-3xl space-y-4 bg-transparent px-4 pb-40 pt-0 sm:px-6">
              {/* Title + restart now live inside the guest strip (below);
                  only the payment milestone keeps a row here, when present. */}
              {paymentLabel ? (
                <div className="flex items-center justify-end gap-4">
                  <span className="max-w-[12rem] truncate rounded-lg border border-emerald-500/60 bg-emerald-950/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 sm:max-w-[16rem]">
                    {paymentLabel}
                  </span>
                </div>
              ) : null}

              {loading ? (
                <p className="rounded-2xl border border-[#2C2C2E] bg-[#121212]/70 p-8 text-center text-sm text-zinc-400">
                  Loading your trip builder…
                </p>
              ) : error ? (
                <div className="rounded-2xl border border-red-900/60 bg-[#121212] p-6 text-sm text-red-300">
                  <p className="font-semibold">PocketBase unavailable</p>
                  <p className="mt-2 text-zinc-400">{error}</p>
                </div>
              ) : config ? (
                <BuilderMView
                  key={state.tempBookingRef || "draft"}
                  config={config}
                  onAccommodationsLoaded={handleAccommodationsLoaded}
                  headerSlot={
                    <div className="flex w-full flex-col items-start gap-1.5">
                      {/* Client name above the Booking Ref box */}
                      {/* leading-9 (36px at all widths) = the h-9 strip-title line, so the centred title shares its exact vertical centre */}
                      <span className="ml-1 text-xs font-bold tracking-widest text-white uppercase leading-9">
                        {guestBadge.name}
                      </span>
                      <BookingRefBadge
                        tempBookingRef={state.tempBookingRef}
                        confirmedBookingRef={state.confirmedBookingRef}
                        bookingStatus={state.bookingStatus}
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
                      <h2 className="min-w-0 truncate font-display text-[1.16rem] font-black text-white sm:text-[1.33rem]">
                        JAPAN
                      </h2>
                    </div>
                  }
                  stripTrailingSlot={<NewBookingResetButton variant="strip" />}
                />
              ) : null}
            </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
