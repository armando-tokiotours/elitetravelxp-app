"use client";

import { useEffect, useMemo, useState, type ReactNode, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  Check,
  HelpCircle,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type {
  PbChauffeurRate,
  PbCity,
  PbCityMovement,
  PbVehicle,
} from "@/lib/pocketbase/client";
import { cityPhoto, getPocketBase, pbFileUrl } from "@/lib/pocketbase/client";
import {
  countBillableChauffeurDays,
  isBillableChauffeurDay,
} from "@/lib/chauffeurSelections";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import {
  formatTransferPriceRange,
  priceFleetChauffeurDay,
} from "@/lib/vehicleAllocator";
import {
  useBuilderStore,
  coerceTransitType,
  type CityTransitType,
} from "@/store/useBuilderStore";
import { travelStyleTierRules } from "@/lib/preEliteHydrate";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";
import { CityTransportModal } from "./CityTransportModal";
import { HorizontalHelpAccordion } from "../HorizontalHelpAccordion";
import { GoldLight } from "@/components/branding/GoldLight";
import { TransportProductPicker } from "@/components/builder/TransportProductPicker";
import { SelfArrangeMicroTable } from "@/components/builder/SelfArrangeMicroTable";
import {
  fetchUiTransportCards,
  resolveTransportCards,
  TRANSPORT_CARD_FALLBACKS,
  TRANSPORT_CARD_FALLBACKS_BY_SCOPE,
  type ResolvedTransportCard,
} from "@/lib/uiTransportCards";
import {
  buildInterCityLegQuotes,
  compareInterCityTripCosts,
  findCityMovement,
  movementLegCostEur,
  movementTimeMins,
  suggestTransitForLeg,
} from "@/lib/interCityRoutes";
import {
  buildTransitTicketChoice,
  detectTransitTicketKind,
} from "@/lib/transitTickets";
import type { TransportTicketLine } from "@/lib/transportProducts";

const DEFAULT_MODE_CARDS: ResolvedTransportCard[] = [
  TRANSPORT_CARD_FALLBACKS.self,
  TRANSPORT_CARD_FALLBACKS.public,
  TRANSPORT_CARD_FALLBACKS.private,
];

const DEFAULT_INTERCITY_CARDS: ResolvedTransportCard[] = [
  TRANSPORT_CARD_FALLBACKS_BY_SCOPE.intercity.self,
  TRANSPORT_CARD_FALLBACKS_BY_SCOPE.intercity.public,
  TRANSPORT_CARD_FALLBACKS_BY_SCOPE.intercity.private,
];

type PanelKind = "local" | "inter";
type ExpandedPanel = { kind: PanelKind; stopKey: string } | null;

type PendingPublic = {
  stopKey: string;
  kind: PanelKind;
};

function formatMins(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function modeShortLabel(mode: CityTransitType): string {
  if (mode === "self") return "Self";
  if (mode === "public") return "Public";
  if (mode === "private") return "Private";
  return "Choose";
}

function cityThumb(city: PbCity | undefined): string {
  if (!city) return "";
  const filename = cityPhoto(city);
  return filename
    ? pbFileUrl(city.collectionId, city.id, filename, "120x120")
    : "";
}

/**
 * Full-screen Transport editor — In-City vs Inter-City timeline + pass questionnaire.
 */
export function DriversEditorModal({
  open,
  onClose,
  onTransportComplete,
  cities = [],
  cityNames,
  cityMovements = [],
  vehicles = [],
  chauffeurRates = [],
}: {
  open: boolean;
  onClose: () => void;
  onTransportComplete?: () => void;
  cities?: PbCity[];
  cityNames: Record<string, string>;
  cityMovements?: PbCityMovement[];
  vehicles?: PbVehicle[];
  chauffeurRates?: PbChauffeurRate[];
}) {
  const [mounted, setMounted] = useState(false);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingPublic, setPendingPublic] = useState<PendingPublic | null>(
    null
  );
  /** Re-open pass questionnaire from header badges (edit without selecting Public). */
  const [passEditOpen, setPassEditOpen] = useState(false);
  const [modeCards, setModeCards] =
    useState<ResolvedTransportCard[]>(DEFAULT_MODE_CARDS);
  const [intercityCards, setIntercityCards] = useState<ResolvedTransportCard[]>(
    DEFAULT_INTERCITY_CARDS
  );

  const locations = useBuilderStore((s) => s.locations);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const specialNeeds = useBuilderStore((s) => s.specialNeeds);
  const chauffeurSelections = useBuilderStore((s) => s.chauffeurSelections);
  const selectedToursMap = useBuilderStore((s) => s.selectedTours);
  const setChauffeurDayMode = useBuilderStore((s) => s.setChauffeurDayMode);
  const toggleChauffeurDayTour = useBuilderStore(
    (s) => s.toggleChauffeurDayTour
  );
  const setLocationTransitType = useBuilderStore((s) => s.setLocationTransitType);
  const setLocationLocalTransitType = useBuilderStore(
    (s) => s.setLocationLocalTransitType
  );
  const setLocationTransitChoice = useBuilderStore(
    (s) => s.setLocationTransitChoice
  );
  const addTransportProduct = useBuilderStore((s) => s.addTransportProduct);
  const setGuestTransitPasses = useBuilderStore((s) => s.setGuestTransitPasses);
  const guestHasJRPass = useBuilderStore((s) => s.guestHasJRPass);
  const guestHasICCard = useBuilderStore((s) => s.guestHasICCard);
  const guestNeedsTransitHelp = useBuilderStore((s) => s.guestNeedsTransitHelp);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const preEliteTravelStyle = useBuilderStore((s) => s.preEliteTravelStyle);
  const travelPace = useBuilderStore((s) => s.travelPace);
  const tierRules = travelStyleTierRules(preEliteTravelStyle);
  const allowPrivate = tierRules.allowPrivateChauffeur;
  const conciergeLocked = isEliteConcierge || experienceService === "concierge";
  const hasMobilityNeeds = specialNeeds.includes("reduced_mobility");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const rows = await fetchUiTransportCards();
      if (cancelled) return;
      setModeCards(resolveTransportCards(rows, "incity"));
      setIntercityCards(resolveTransportCards(rows, "intercity"));
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    setShowCompare(false);
    setShowHelp(false);
    setPendingPublic(null);
    setPassEditOpen(false);
  }, [open]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const totalPax = adults + children;
  const chauffeurDayCount = countBillableChauffeurDays(chauffeurSelections);

  const stayStops = useMemo(() => {
    const stayLocs = locations.filter(
      (loc) =>
        (!loc.visitType || loc.visitType === "stay") && (loc.nights || 0) > 0
    );
    const unique: typeof stayLocs = [];
    const seen = new Set<string>();
    for (const loc of stayLocs) {
      if (seen.has(loc.cityId)) continue;
      seen.add(loc.cityId);
      unique.push(loc);
    }
    return unique.map((loc, i) => {
      const locKey = loc.key?.trim() || loc.cityId;
      const next = unique[i + 1];
      return {
        key: locKey || `driver-${i}`,
        cityId: loc.cityId,
        locKey,
        nights: loc.nights || 1,
        transitType: coerceTransitType(loc.transitType),
        localTransitType: coerceTransitType(loc.localTransitType),
        nextCityId: next?.cityId ?? null,
      };
    });
  }, [locations]);

  useEffect(() => {
    if (!open) {
      setExpanded(null);
      return;
    }
    // Always start with all city/route accordions collapsed
    setExpanded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when modal opens
  }, [open]);

  const legQuotes = useMemo(
    () =>
      buildInterCityLegQuotes({
        locations,
        movements: cityMovements,
        guests: totalPax,
      }),
    [locations, cityMovements, totalPax]
  );
  const invoiceTransitTotal = useMemo(
    () => legQuotes.reduce((s, l) => s + l.invoiceEur, 0),
    [legQuotes]
  );

  const tripCompare = useMemo(
    () =>
      compareInterCityTripCosts({
        locations,
        movements: cityMovements,
        guests: totalPax,
      }),
    [locations, cityMovements, totalPax]
  );

  const needsPassQuestionnaire =
    guestHasJRPass == null ||
    guestHasICCard == null ||
    guestNeedsTransitHelp == null;

  const applyInterCityMode = async (
    stop: (typeof stayStops)[0],
    mode: CityTransitType
  ) => {
    const movement = stop.nextCityId
      ? findCityMovement(cityMovements, stop.cityId, stop.nextCityId)
      : null;

    if (mode === "public") {
      const kind = detectTransitTicketKind({
        fromCityId: stop.cityId,
        toCityId: stop.nextCityId || undefined,
      });
      const fromRoute =
        movement != null
          ? Math.max(0, Number(movement.public_transit_cost) || 0)
          : 0;
      const choice = buildTransitTicketChoice(mode, true, kind);
      if (fromRoute > 0) {
        choice.ticketPricePerPax = fromRoute;
      }
      setLocationTransitChoice(stop.locKey, choice);

      const linkedId = movement?.linked_transport_product_id?.trim();
      if (linkedId) {
        try {
          const pb = getPocketBase();
          const prod = await pb.collection("transport_products").getOne(linkedId, {
            requestKey: null,
          });
          const line: TransportTicketLine = {
            productId: prod.id,
            name: String((prod as { name?: string }).name || "Transport ticket"),
            transportType: String(
              (prod as { transport_type?: string }).transport_type || "other"
            ),
            pricePerPerson:
              Number((prod as { price_per_person?: number }).price_per_person) ||
              fromRoute,
            quantity: totalPax,
            durationHours:
              Number((prod as { duration_hours?: number }).duration_hours) ||
              undefined,
            hoursNote:
              String(
                (prod as { total_hours_note?: string }).total_hours_note || ""
              ) || undefined,
            explainerUrl:
              String(
                (prod as { explainer_url?: string }).explainer_url || ""
              ) || undefined,
            cityId: stop.cityId,
          };
          addTransportProduct(line);
        } catch {
          /* catalog row missing */
        }
      }
      return;
    }

    setLocationTransitType(stop.locKey, mode);
  };

  const applyLocalMode = (stop: (typeof stayStops)[0], mode: CityTransitType) => {
    setLocationLocalTransitType(stop.locKey, mode);
    if (mode === "private" && allowPrivate) {
      setActiveCityId(stop.cityId);
    }
  };

  const requestMode = (
    stop: (typeof stayStops)[0],
    kind: PanelKind,
    mode: Exclude<CityTransitType, "unset">
  ) => {
    if (mode === "private" && !allowPrivate) {
      showSystemMessage({
        text: "Upgrade to Premium Comfort to unlock private chauffeur.",
        tone: "error",
      });
      return;
    }
    if (mode === "public" && needsPassQuestionnaire) {
      setPendingPublic({ stopKey: stop.key, kind });
      return;
    }
    if (kind === "inter") void applyInterCityMode(stop, mode);
    else applyLocalMode(stop, mode);
  };

  const upgradeToPremiumComfort = () => {
    useBuilderStore.setState({ preEliteTravelStyle: "premium_comfort" });
    showSystemMessage({
      text: "Travel style upgraded to Premium Comfort — private chauffeur unlocked.",
      tone: "info",
    });
  };

  const onPassQuestionnaireSave = (answers: {
    guestHasJRPass: boolean;
    guestHasICCard: boolean;
    guestNeedsTransitHelp: boolean;
  }) => {
    setGuestTransitPasses(answers);
    const pending = pendingPublic;
    setPendingPublic(null);
    setPassEditOpen(false);
    if (!pending) return;
    const stop = stayStops.find((s) => s.key === pending.stopKey);
    if (!stop) return;
    if (pending.kind === "inter") void applyInterCityMode(stop, "public");
    else applyLocalMode(stop, "public");
  };

  const openPassQuestionnaire = (e?: MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setPassEditOpen(true);
  };

  const cityMap = useMemo(() => {
    const m: Record<string, PbCity> = {};
    for (const c of cities) m[c.id] = c;
    return m;
  }, [cities]);

  const activeCity = activeCityId ? cityMap[activeCityId] : undefined;
  const activeName = activeCityId
    ? cityNames[activeCityId] ?? activeCity?.name ?? "City"
    : "";
  const activeDayOptions = activeCityId
    ? chauffeurDaysForCity(arrivalDate, locations, activeCityId)
    : [];
  const activeSelections = activeCityId
    ? chauffeurSelections[activeCityId] ?? {}
    : {};
  const activeQuote = activeCityId
    ? priceFleetChauffeurDay({
        cityId: activeCityId,
        totalPax,
        vehicles,
        rates: chauffeurRates,
      })
    : null;
  const dailyLabel =
    activeQuote?.fromRates && activeQuote.min > 0
      ? formatTransferPriceRange(activeQuote.min, activeQuote.max)
      : null;
  const fleetLabel =
    activeQuote?.fleet?.label?.replace("×", "x") ?? null;

  const togglePanel = (kind: PanelKind, stopKey: string) => {
    setExpanded((prev) =>
      prev?.kind === kind && prev.stopKey === stopKey
        ? null
        : { kind, stopKey }
    );
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="drivers-editor"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080C]/85 p-0 backdrop-blur-md sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Transport selection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative z-[1] flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#0A1017] shadow-2xl sm:h-[min(92vh,920px)] sm:rounded-3xl sm:border sm:border-white/10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A1017]/95 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-godiva text-base uppercase tracking-wider text-white">
                  Transport
                </h3>
              </div>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowHelp((v) => !v)}
                  onMouseEnter={() => setShowHelp(true)}
                  onMouseLeave={() => setShowHelp(false)}
                  aria-label="How to use this screen"
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#F6A724]/40 bg-[#F6A724]/10 text-[#F6A724]"
                >
                  <motion.span
                    className="absolute inset-0 rounded-full border border-[#F6A724]/50"
                    animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    aria-hidden
                  />
                  <HelpCircle className="relative z-10 h-4 w-4" />
                </button>
                <AnimatePresence>
                  {showHelp ? (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-white/15 bg-[#0D1117]/95 p-3 text-xs leading-relaxed text-zinc-300 shadow-xl backdrop-blur-md"
                    >
                      1. Select a city to configure local transport.
                      <br />
                      2. Select the line between cities to configure inter-city
                      transfers.
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 pb-[max(7rem,env(safe-area-inset-bottom))] sm:px-5">
              <HorizontalHelpAccordion
                ariaLabelShow="Show compare transport costs"
                ariaLabelHide="Hide compare transport costs"
                icon={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/brand/compare-ab.png"
                    alt=""
                    aria-hidden
                    className="h-4 w-4 object-contain"
                  />
                }
                text={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      Compare Self vs Public vs Private
                      {invoiceTransitTotal > 0
                        ? ` · now €${Math.round(invoiceTransitTotal)}`
                        : ""}
                      .
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCompare(true)}
                      className="font-semibold text-[#F6A724] underline-offset-2 hover:underline"
                    >
                      Open comparison
                    </button>
                  </span>
                }
              />

              <TransportProductPicker adults={adults + children} />

              {conciergeLocked ? (
                <div className="group relative overflow-hidden rounded-2xl border border-[#075473]/40 bg-[#075473]/15 px-4 py-3">
                  <GoldLight color="#F6A724" placement="top-center" active />
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F6A724]">
                      Elite Concierge Active
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
                      Private chauffeur picks are curated 1:1 in your bespoke
                      quotation.
                    </p>
                  </div>
                </div>
              ) : null}

              <p className="text-xs text-zinc-400">
                {conciergeLocked
                  ? "Included with Elite Concierge"
                  : !allowPrivate
                    ? "Public Transit & Walking Guide"
                    : chauffeurDayCount === 0
                      ? "Cities = in-city · Lines = inter-city transfers"
                      : `${chauffeurDayCount} in-city driver day${chauffeurDayCount === 1 ? "" : "s"}`}
              </p>

              {conciergeLocked ? null : stayStops.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-4 text-sm text-zinc-400">
                  Add stay cities first to configure transport legs.
                </p>
              ) : (
                <div className="space-y-0">
                  {stayStops.map((stop, index) => {
                    const fromCity = cityMap[stop.cityId];
                    const fromName =
                      cityNames[stop.cityId] ?? fromCity?.name ?? "City";
                    const fromImg = cityThumb(fromCity);
                    const nextStop = stayStops[index + 1];
                    const toName = nextStop
                      ? cityNames[nextStop.cityId] ??
                        cityMap[nextStop.cityId]?.name ??
                        "Next"
                      : "";
                    const movement = stop.nextCityId
                      ? findCityMovement(
                          cityMovements,
                          stop.cityId,
                          stop.nextCityId
                        )
                      : null;
                    const pubMins = movementTimeMins(movement, "public");
                    const privMins = movementTimeMins(movement, "private");
                    const pubCost = movementLegCostEur(
                      movement,
                      "public",
                      totalPax
                    );
                    const privCost = movementLegCostEur(
                      movement,
                      "private",
                      totalPax
                    );
                    const suggestedInter = suggestTransitForLeg({
                      travelPace,
                      publicMins: pubMins,
                      allowPrivate,
                      guests: totalPax,
                      hasMobilityNeeds,
                    });
                    const suggestedLocal = suggestTransitForLeg({
                      travelPace,
                      publicMins: null,
                      allowPrivate,
                      guests: totalPax,
                      hasMobilityNeeds,
                    });
                    const localNeeds = stop.localTransitType === "unset";
                    const interNeeds =
                      Boolean(stop.nextCityId) && stop.transitType === "unset";
                    const localOpen =
                      expanded?.kind === "local" &&
                      expanded.stopKey === stop.key;
                    const interOpen =
                      expanded?.kind === "inter" &&
                      expanded.stopKey === stop.key;
                    const citySelections =
                      chauffeurSelections[stop.cityId] ?? {};
                    const driverDays = Object.values(citySelections).filter(
                      (sel) => isBillableChauffeurDay(sel)
                    ).length;

                    return (
                      <div key={stop.key} className="relative">
                        {/* —— City node (In-City) —— */}
                        <div
                          className={`overflow-hidden rounded-2xl border bg-zinc-900/80 transition ${
                            localOpen
                              ? "border-[#075473]/60"
                              : localNeeds
                                ? "border-amber-500/35"
                                : "border-zinc-800"
                          }`}
                        >
                          <div className="flex w-full items-center gap-2 px-3 py-3.5 sm:gap-3 sm:px-4">
                            <button
                              type="button"
                              onClick={() => togglePanel("local", stop.key)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              aria-expanded={localOpen}
                            >
                              <CityNode name={fromName} img={fromImg} large />
                              <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="truncate font-godiva text-sm uppercase tracking-wider text-white">
                                    {fromName}
                                  </span>
                                  <span
                                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-zinc-400"
                                    title={`${totalPax} guest${totalPax === 1 ? "" : "s"}`}
                                  >
                                    <Users
                                      className="h-3.5 w-3.5"
                                      aria-hidden
                                    />
                                    <span>x {totalPax}</span>
                                  </span>
                                </span>
                                <span className="mt-0.5 block text-xs text-zinc-500">
                                  In-city transport
                                  {stop.localTransitType !== "unset"
                                    ? ` · ${modeShortLabel(stop.localTransitType)}`
                                    : " · tap to choose"}
                                  {driverDays > 0
                                    ? ` · ${driverDays} chauffeur day${
                                        driverDays === 1 ? "" : "s"
                                      }`
                                    : ""}
                                </span>
                              </span>
                            </button>
                            <PassStatusBadges
                              jr={guestHasJRPass}
                              ic={guestHasICCard}
                              onEdit={openPassQuestionnaire}
                            />
                            {localNeeds ? (
                              <motion.span
                                animate={{
                                  scale: [1, 1.1, 1],
                                  opacity: [0.8, 1, 0.8],
                                }}
                                transition={{
                                  duration: 1.6,
                                  repeat: Infinity,
                                }}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/50 bg-[#1a1208] text-amber-400"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </motion.span>
                            ) : (
                              <span className="shrink-0 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-300">
                                {modeShortLabel(stop.localTransitType)}
                              </span>
                            )}
                          </div>

                          <AnimatePresence initial={false}>
                            {localOpen ? (
                              <ModeAccordion
                                key="local-body"
                                title={`How do you want to move around inside ${fromName}?`}
                                cards={modeCards}
                                costScope="incity"
                                suggested={suggestedLocal}
                                selected={stop.localTransitType}
                                allowPrivate={allowPrivate}
                                guests={totalPax}
                                pubCost={0}
                                privCost={0}
                                pubMins={null}
                                privMins={null}
                                onPick={(mode) =>
                                  requestMode(stop, "local", mode)
                                }
                                onUpgradeTravelStyle={upgradeToPremiumComfort}
                                footer={
                                  stop.localTransitType === "self" ? (
                                    <SelfArrangeMicroTable
                                      city={fromCity}
                                      nights={stop.nights}
                                      cityName={fromName}
                                    />
                                  ) : null
                                }
                              />
                            ) : null}
                          </AnimatePresence>
                        </div>

                        {/* —— Connecting line (Inter-City) —— */}
                        {stop.nextCityId && nextStop ? (
                          <div className="relative py-1 pl-8 sm:pl-10">
                            <div
                              className={`absolute left-[1.65rem] top-0 h-full w-px border-l sm:left-[2.05rem] ${
                                interNeeds
                                  ? "border-dashed border-amber-400/60"
                                  : "border-solid border-white/20"
                              }`}
                              aria-hidden
                            />
                            <div
                              className={`ml-4 overflow-hidden rounded-2xl border bg-zinc-950/60 transition sm:ml-6 ${
                                interOpen
                                  ? "border-[#075473]/60"
                                  : interNeeds
                                    ? "border-amber-500/35"
                                    : "border-zinc-800/80"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => togglePanel("inter", stop.key)}
                                className="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-4"
                                aria-expanded={interOpen}
                              >
                                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                                  {interNeeds ? (
                                    <motion.span
                                      className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/50 bg-[#1a1208] text-amber-400 shadow-[0_0_16px_rgba(246,167,36,0.35)]"
                                      animate={{
                                        scale: [1, 1.12, 1],
                                        opacity: [0.85, 1, 0.85],
                                      }}
                                      transition={{
                                        duration: 1.6,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                      }}
                                    >
                                      <AlertTriangle
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                      />
                                    </motion.span>
                                  ) : (
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0A1017] text-[9px] font-bold uppercase text-zinc-300">
                                      {modeShortLabel(stop.transitType)}
                                    </span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium text-white">
                                    {fromName} → {toName}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-zinc-500">
                                    Inter-city transfer
                                    {pubMins != null || privMins != null
                                      ? ` · Rail ${formatMins(pubMins)} · Car ${formatMins(privMins)}`
                                      : ""}
                                  </span>
                                </span>
                              </button>

                              <AnimatePresence initial={false}>
                                {interOpen ? (
                                  <ModeAccordion
                                    key="inter-body"
                                    title={`How do you want to travel ${fromName} → ${toName}?`}
                                    cards={intercityCards}
                                    costScope="intercity"
                                    suggested={suggestedInter}
                                    selected={stop.transitType}
                                    allowPrivate={allowPrivate}
                                    guests={totalPax}
                                    pubCost={pubCost}
                                    privCost={privCost}
                                    pubMins={pubMins}
                                    privMins={privMins}
                                    onPick={(mode) =>
                                      requestMode(stop, "inter", mode)
                                    }
                                    onUpgradeTravelStyle={upgradeToPremiumComfort}
                                    footer={
                                      <HorizontalHelpAccordion
                                        ariaLabelShow="Show how transit works"
                                        ariaLabelHide="Hide transit help"
                                        text={
                                          <>
                                            Inter-city public is train / bullet
                                            train (Shinkansen). Private is a
                                            door-to-door chauffeur for the
                                            vehicle (not per seat). Self-arranged
                                            keeps invoice transport at €0.
                                          </>
                                        }
                                      />
                                    }
                                  />
                                ) : null}
                              </AnimatePresence>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="tokio-modal-chrome shrink-0 border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              <button
                type="button"
                onClick={() => {
                  const missingLocal = stayStops.find(
                    (s) => s.localTransitType === "unset"
                  );
                  if (missingLocal) {
                    setExpanded({
                      kind: "local",
                      stopKey: missingLocal.key,
                    });
                    showSystemMessage({
                      text: getSystemMessage("builder_m_transit_required"),
                      tone: "error",
                    });
                    return;
                  }
                  const missingInter = stayStops.find(
                    (s) => s.nextCityId && s.transitType === "unset"
                  );
                  if (missingInter) {
                    setExpanded({
                      kind: "inter",
                      stopKey: missingInter.key,
                    });
                    showSystemMessage({
                      text: getSystemMessage("builder_m_transit_required"),
                      tone: "error",
                    });
                    return;
                  }
                  onTransportComplete?.();
                  onClose();
                }}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57]"
              >
                Done
              </button>
            </div>
          </motion.div>

          {activeCityId && !conciergeLocked ? (
            <CityTransportModal
              open={Boolean(activeCityId)}
              onClose={() => setActiveCityId(null)}
              cityName={activeName}
              cityId={activeCityId}
              dayOptions={activeDayOptions}
              daySelections={activeSelections}
              selectedTours={selectedToursMap[activeCityId] ?? []}
              dailyRateLabel={dailyLabel}
              fleetLabel={fleetLabel}
              arrivalDateMissing={!arrivalDate}
              onSetDayMode={(date, mode) =>
                setChauffeurDayMode(activeCityId, date, mode)
              }
              onToggleDayTour={(date, tourId) =>
                toggleChauffeurDayTour(activeCityId, date, tourId)
              }
            />
          ) : null}

          <TransportCompareDrawer
            open={showCompare}
            onClose={() => setShowCompare(false)}
            cityNames={cityNames}
            cityMap={cityMap}
            compare={tripCompare}
            currentInvoice={invoiceTransitTotal}
          />

          <TransitPassQuestionnaire
            open={Boolean(pendingPublic) || passEditOpen}
            onClose={() => {
              setPendingPublic(null);
              setPassEditOpen(false);
            }}
            onSave={onPassQuestionnaireSave}
            initial={{
              guestHasJRPass,
              guestHasICCard,
              guestNeedsTransitHelp,
            }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function CityNode({
  name,
  img,
  large,
}: {
  name: string;
  img: string;
  large?: boolean;
}) {
  const size = large ? "h-12 w-12 sm:h-14 sm:w-14" : "h-10 w-10 sm:h-11 sm:w-11";
  return (
    <span className="flex shrink-0 flex-col items-center gap-1">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          className={`${size} rounded-full object-cover ring-2 ring-white/15`}
        />
      ) : (
        <span
          className={`flex ${size} items-center justify-center rounded-full bg-zinc-800 text-sky-400 ring-2 ring-white/10`}
        >
          <Car className="h-4 w-4" aria-hidden />
        </span>
      )}
      {!large ? (
        <span className="line-clamp-2 w-16 text-center text-[10px] font-semibold leading-tight text-white sm:w-20 sm:text-[11px]">
          {name}
        </span>
      ) : null}
    </span>
  );
}

function passBadgeClass(value: boolean | null): string {
  if (value === true) {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-400";
  }
  if (value === false) {
    return "border-red-400/30 bg-red-400/10 text-red-400";
  }
  return "border-[#F6A724]/30 bg-[#F6A724]/10 text-[#F6A724]";
}

function passBadgeLabel(kind: "JR Pass" | "Suica", value: boolean | null): string {
  if (value === true) return `${kind}: Yes`;
  if (value === false) return `${kind}: No`;
  return `${kind}: ?`;
}

/** Interactive JR / Suica badges — reopen questionnaire without toggling accordion. */
function PassStatusBadges({
  jr,
  ic,
  onEdit,
}: {
  jr: boolean | null;
  ic: boolean | null;
  onEdit: (e: MouseEvent) => void;
}) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
      <button
        type="button"
        onClick={onEdit}
        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none transition hover:brightness-110 ${passBadgeClass(jr)}`}
        aria-label="Edit JR Pass answer"
      >
        {passBadgeLabel("JR Pass", jr)}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none transition hover:brightness-110 ${passBadgeClass(ic)}`}
        aria-label="Edit Suica / IC Card answer"
      >
        {passBadgeLabel("Suica", ic)}
      </button>
    </span>
  );
}

function ModeAccordion({
  title,
  cards = DEFAULT_MODE_CARDS,
  costScope = "incity",
  suggested,
  selected,
  allowPrivate,
  guests,
  pubCost,
  privCost,
  pubMins,
  privMins,
  onPick,
  onUpgradeTravelStyle,
  footer,
}: {
  title: string;
  cards?: ResolvedTransportCard[];
  /** In-city shows Suica/metro; inter-city shows train / bullet train costs */
  costScope?: "incity" | "intercity";
  suggested: Exclude<CityTransitType, "unset">;
  selected: CityTransitType;
  allowPrivate: boolean;
  guests: number;
  pubCost: number;
  privCost: number;
  pubMins: number | null;
  privMins: number | null;
  onPick: (mode: Exclude<CityTransitType, "unset">) => void;
  onUpgradeTravelStyle?: () => void;
  footer?: ReactNode;
}) {
  const pax = Math.max(1, guests);
  // public total is already × guests; private is vehicle total
  const pubPerPerson = pubCost > 0 ? Math.round(pubCost / pax) : 0;
  const privPerPerson = privCost > 0 ? Math.round(privCost / pax) : 0;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden border-t border-white/10"
    >
      <div className="space-y-3 px-3 py-4 sm:px-4">
        <p className="text-xs text-zinc-400">{title}</p>

        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0"
          style={{ zoom: 0.8 }}
        >
          {cards.map((card) => {
            const locked = card.mode === "private" && !allowPrivate;
            const isSelected = !locked && selected === card.mode;
            const hasSelection = selected !== "unset";
            const isRecommended = !locked && suggested === card.mode;
            const cardClass = locked
              ? "border border-zinc-800 opacity-50 grayscale"
              : isSelected
                ? "border-2 border-[#075473] opacity-100 scale-100 z-10"
                : hasSelection
                  ? "border border-zinc-800 opacity-40 grayscale-[50%] scale-95"
                  : "border border-zinc-800 opacity-100 hover:border-accent-500/40 scale-100";

            return (
              <div
                key={card.mode}
                className={`group relative w-[9.5rem] shrink-0 overflow-hidden rounded-2xl text-left transition-all duration-300 ease-in-out sm:w-auto ${cardClass}`}
              >
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    onPick(card.mode);
                  }}
                  aria-pressed={isSelected}
                  aria-disabled={locked}
                  className={`relative block w-full text-left ${
                    locked ? "pointer-events-none cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <span className="relative block aspect-[3/4] w-full bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover"
                    />
                    <span
                      className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                      aria-hidden
                    />
                    {isRecommended ? (
                      <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-0.5 rounded-full bg-[#F6A724] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0A1017]">
                        <Sparkles className="h-2.5 w-2.5" />
                        Recommended
                      </span>
                    ) : null}
                    {isSelected ? (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#D9718C] text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                    <span className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                      <span className="block font-display text-sm text-white sm:text-base">
                        {card.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-zinc-300 sm:text-[11px]">
                        {card.description}
                      </span>
                      {card.mode === "public" && pubPerPerson > 0 ? (
                        <span className="mt-1 block text-[10px] font-semibold text-[#F6A724]">
                          Est. €{pubPerPerson} per person
                          {pubMins != null ? ` · ${formatMins(pubMins)}` : ""}
                        </span>
                      ) : null}
                      {card.mode === "private" && privCost > 0 && !locked ? (
                        <span className="mt-1 block">
                          <span className="block text-[10px] font-semibold text-[#F6A724]">
                            Est. €{privPerPerson} per person
                            {privMins != null
                              ? ` · ${formatMins(privMins)}`
                              : ""}
                          </span>
                          <span className="mt-0.5 block text-[9px] font-normal text-zinc-500">
                            Total vehicle: €{Math.round(privCost)}
                          </span>
                        </span>
                      ) : null}
                      {card.subtext &&
                      !(card.mode === "public" && pubPerPerson > 0) &&
                      !(card.mode === "private" && privCost > 0 && !locked) ? (
                        <span className="mt-1 block text-[10px] font-semibold text-zinc-400">
                          {card.subtext}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>

                {locked ? (
                  <button
                    type="button"
                    onClick={() => onUpgradeTravelStyle?.()}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-black/55 px-2 text-center backdrop-blur-[1px]"
                  >
                    <Car className="h-5 w-5 text-[#F6A724]" aria-hidden />
                    <span className="text-[10px] font-bold leading-snug text-white sm:text-[11px]">
                      Upgrade to Premium Comfort to unlock
                    </span>
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {selected === "public" ? (
          <div className="mt-1 rounded-xl border border-white/10 bg-[#0D1117]/70 p-5">
            <h4 className="mb-3 text-sm font-bold tracking-wide text-[#F6A724] uppercase">
              {costScope === "intercity"
                ? "Inter-city train costs"
                : "Public Transport Costs"}
            </h4>
            <div className="mb-4 flex flex-col gap-2 text-sm text-zinc-300">
              {costScope === "intercity" ? (
                <>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Shinkansen / limited express (per person)</span>
                    <span className="font-mono">
                      {pubCost > 0
                        ? `Est. €${Math.round(pubCost / Math.max(1, guests))}`
                        : "Est. on quote"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Party total (this leg)</span>
                    <span className="font-mono">
                      {pubCost > 0
                        ? `Est. €${Math.round(pubCost)}`
                        : "Est. on quote"}
                    </span>
                  </div>
                  <div className="pt-1 text-xs text-zinc-500">
                    * Reserved seats recommended. Local Suica / metro is billed
                    separately on in-city days.
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Suica / IC Card (Per person)</span>
                    <span className="font-mono">Est. €15</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Local Metro/Train Tickets (Daily average)</span>
                    <span className="font-mono">Est. €6 - €10</span>
                  </div>
                  <div className="pt-1 text-xs text-zinc-500">
                    * Exact ticket costs depend on daily travel distance. Bullet
                    trains (Shinkansen) are calculated separately in inter-city
                    routes.
                  </div>
                </>
              )}
            </div>
            <a
              href="/faq"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#075473] transition-colors hover:text-[#F6A724]"
            >
              Read: How public transport works in Japan ↗
            </a>
          </div>
        ) : null}

        {footer}
      </div>
    </motion.div>
  );
}

function TransitPassQuestionnaire({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (answers: {
    guestHasJRPass: boolean;
    guestHasICCard: boolean;
    guestNeedsTransitHelp: boolean;
  }) => void;
  initial: {
    guestHasJRPass: boolean | null;
    guestHasICCard: boolean | null;
    guestNeedsTransitHelp: boolean | null;
  };
}) {
  const [jr, setJr] = useState<boolean | null>(initial.guestHasJRPass);
  const [ic, setIc] = useState<boolean | null>(initial.guestHasICCard);
  const [help, setHelp] = useState<boolean | null>(
    initial.guestNeedsTransitHelp
  );

  useEffect(() => {
    if (!open) return;
    setJr(initial.guestHasJRPass);
    setIc(initial.guestHasICCard);
    setHelp(initial.guestNeedsTransitHelp);
  }, [open, initial.guestHasJRPass, initial.guestHasICCard, initial.guestNeedsTransitHelp]);

  if (!open) return null;

  const canSave = jr != null && ic != null && help != null;

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Transit pass questionnaire"
    >
      <motion.div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/95 shadow-2xl"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-4 py-3.5">
          <div>
            <p className="font-godiva text-sm uppercase tracking-wider text-white">
              Public transport passes
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Helps Tours &amp; Experiences recommend the right tickets
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <YesNoQuestion
            label="Do you already hold a valid JR Pass for this trip?"
            value={jr}
            onChange={setJr}
          />
          <YesNoQuestion
            label="Do you already have a local IC Card (Suica / Pasmo)?"
            value={ic}
            onChange={setIc}
          />
          <YesNoQuestion
            label="Would you like our team to help arrange these passes for you?"
            value={help}
            onChange={setHelp}
          />
        </div>

        <div className="border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSave({
                guestHasJRPass: jr!,
                guestHasICCard: ic!,
                guestNeedsTransitHelp: help!,
              });
            }}
            className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue with Public Transport
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function YesNoQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <p className="text-sm text-zinc-200">{label}</p>
      <div className="mt-2 flex gap-2">
        {([true, false] as const).map((v) => {
          const active = value === v;
          return (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange(v)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-[#075473] bg-[#075473] text-white"
                  : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white"
              }`}
            >
              {v ? "Yes" : "No"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TransportCompareDrawer({
  open,
  onClose,
  cityNames,
  cityMap,
  compare,
  currentInvoice,
}: {
  open: boolean;
  onClose: () => void;
  cityNames: Record<string, string>;
  cityMap: Record<string, PbCity>;
  compare: ReturnType<typeof compareInterCityTripCosts>;
  currentInvoice: number;
}) {
  if (!open) return null;

  const nameOf = (id: string) =>
    cityNames[id] ?? cityMap[id]?.name ?? "City";

  const columns = [
    {
      key: "self",
      label: "Self",
      total: compare.selfEur,
      note: "€0 on invoice · guest arranges",
      accent: "border-zinc-600",
    },
    {
      key: "public",
      label: "Public",
      total: compare.publicEur,
      note: "Rail / metro · per guest × party",
      accent: "border-[#075473]",
    },
    {
      key: "private",
      label: "Private",
      total: compare.privateEur,
      note: "Vehicle total per leg",
      accent: "border-[#F6A724]/50",
    },
  ] as const;

  return (
    <motion.div
      className="absolute inset-0 z-40 flex flex-col bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Compare transport costs"
    >
      <motion.div
        className="mt-auto flex max-h-[88%] flex-col rounded-t-3xl border border-white/10 bg-[#0D1117]"
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
          <div>
            <p className="font-godiva text-sm uppercase tracking-wider text-white">
              Summary
            </p>
            <p className="text-xs text-zinc-500">
              Estimated inter-city costs · current invoice €
              {Math.round(currentInvoice)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-3 gap-2">
            {columns.map((col) => (
              <div
                key={col.key}
                className={`rounded-2xl border ${col.accent} bg-black/40 px-2.5 py-3 text-center`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {col.label}
                </p>
                <p className="mt-1.5 font-display text-xl text-white">
                  €{Math.round(col.total)}
                </p>
                <p className="mt-1 text-[9px] leading-snug text-zinc-500">
                  {col.note}
                </p>
              </div>
            ))}
          </div>

          {compare.legs.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Add at least two stay cities to compare legs.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Per leg
              </p>
              {compare.legs.map((leg) => (
                <div
                  key={`${leg.fromCityId}-${leg.toCityId}`}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                >
                  <p className="text-xs font-medium text-white">
                    {nameOf(leg.fromCityId)} → {nameOf(leg.toCityId)}
                  </p>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] text-zinc-400">
                    <span>Self €0</span>
                    <span>
                      Public €{Math.round(leg.publicEur)}
                      {leg.publicMins != null
                        ? ` · ${formatMins(leg.publicMins)}`
                        : ""}
                    </span>
                    <span>
                      Private €{Math.round(leg.privateEur)}
                      {leg.privateMins != null
                        ? ` · ${formatMins(leg.privateMins)}`
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
