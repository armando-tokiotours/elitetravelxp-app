"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchBudgetPlannerTours,
  pbFileUrl,
  tourPhoto,
  type PbTour,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaThumbs";
import {
  buildBudgetPlan,
  type BudgetInputMode,
  type BudgetPlanResult,
  type StayStrategy,
} from "@/lib/budgetCalculatorEngine";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

const PRESETS = [
  { id: "tight", label: "Tight", perDay: 50 },
  { id: "moderate", label: "Moderate", perDay: 120 },
  { id: "custom", label: "Custom", perDay: null },
] as const;

type CurrencyCode = "EUR" | "USD";
const EUR_TO_USD = 1.08;

function formatMoney(eur: number, currency: CurrencyCode): string {
  const n = currency === "USD" ? eur * EUR_TO_USD : eur;
  const sym = currency === "USD" ? "$" : "€";
  return `${sym}${Math.round(n).toLocaleString()}`;
}

function toEurInput(display: number, currency: CurrencyCode): number {
  if (currency === "USD") return display / EUR_TO_USD;
  return display;
}

function fromEurDisplay(eur: number, currency: CurrencyCode): number {
  if (currency === "USD") return Math.round(eur * EUR_TO_USD);
  return Math.round(eur);
}

export function BudgetPlannerForm() {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const brand = useSiteBrandingStore((s) => s.getBudgetPlanner)();
  void brandingItems;

  const setCustomBudgetTarget = useBuilderStore((s) => s.setCustomBudgetTarget);
  const setAdults = useBuilderStore((s) => s.setAdults);
  const setChildren = useBuilderStore((s) => s.setChildren);
  const storeAdults = useBuilderStore((s) => s.adults);
  const storeChildren = useBuilderStore((s) => s.children);

  const [mode, setMode] = useState<BudgetInputMode>("per_person_day");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("moderate");
  const [targetDisplay, setTargetDisplay] = useState(120);
  const [adults, setAdultsLocal] = useState(Math.max(1, storeAdults || 2));
  const [children, setChildrenLocal] = useState(Math.max(0, storeChildren || 0));
  const [days, setDays] = useState(7);
  const [stayStrategy, setStayStrategy] = useState<StayStrategy>("self");
  const [tours, setTours] = useState<PbTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ran, setRan] = useState(false);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    let cancelled = false;
    fetchBudgetPlannerTours()
      .then((rows) => {
        if (!cancelled) setTours(rows);
      })
      .catch(() => {
        if (!cancelled) setTours([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const targetEur = useMemo(
    () => toEurInput(targetDisplay, currency),
    [targetDisplay, currency]
  );

  const plan: BudgetPlanResult | null = useMemo(() => {
    if (!ran) return null;
    return buildBudgetPlan(
      {
        mode,
        targetAmount: targetEur,
        adults,
        children,
        days,
        stayStrategy,
      },
      tours
    );
  }, [ran, mode, targetEur, adults, children, days, stayStrategy, tours]);

  const applyPreset = (id: (typeof PRESETS)[number]["id"]) => {
    setPreset(id);
    const row = PRESETS.find((p) => p.id === id);
    if (row?.perDay != null) {
      setMode("per_person_day");
      setTargetDisplay(fromEurDisplay(row.perDay, currency));
    }
  };

  const runPlan = () => {
    setRan(true);
    setSelectedIds(new Set());
  };

  const toggleTour = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedSpend = useMemo(() => {
    if (!plan) return 0;
    return plan.suggestions
      .filter((s) => selectedIds.has(s.tour.id))
      .reduce((sum, s) => sum + s.partyPrice, 0);
  }, [plan, selectedIds]);

  const syncToBuilder = () => {
    if (plan) setCustomBudgetTarget(plan.totalBudget);
    setAdults(adults);
    setChildren(children);
  };

  const eyebrow = brand.subtitle || "TAILORED PLANNING";
  const headline =
    brand.title || "Travel Japan Your Way — Fits Any Budget";
  const body =
    brand.description ||
    "Have a tight or specific budget? Input your target limits and we will curate the best affordable sights, transit, and optional experiences for you.";
  const heroSrc = brand.mediaUrl || "/images/matcher-poster.webp";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-zinc-950/40" />
        <div className="relative px-5 py-10 sm:px-8 sm:py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C4A35A]">
            {eyebrow}
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl leading-tight text-white sm:text-4xl">
            {headline}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base">
            {body}
          </p>
        </div>
      </header>

      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Budget parameters
          </h2>
          <div className="inline-flex rounded-xl border border-zinc-700 bg-zinc-950 p-1 text-xs">
            {(["EUR", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  const eur = toEurInput(targetDisplay, currency);
                  setCurrency(c);
                  setTargetDisplay(fromEurDisplay(eur, c));
                }}
                className={`rounded-lg px-3 py-1.5 transition ${
                  currency === c
                    ? "bg-[#C4A35A] text-zinc-950"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {c === "EUR" ? "€ EUR" : "$ USD"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 inline-flex w-full rounded-xl border border-zinc-700 bg-zinc-950 p-1 sm:w-auto">
          {(
            [
              { id: "per_person_day" as const, label: "Per person / day" },
              { id: "total" as const, label: "Total trip budget" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setMode(opt.id);
                setPreset("custom");
              }}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm transition sm:flex-none ${
                mode === opt.id
                  ? "bg-zinc-100 text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {mode === "per_person_day" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  preset === p.id
                    ? "border-[#C4A35A] bg-[#C4A35A]/15 text-[#C4A35A]"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {p.label}
                {p.perDay != null
                  ? `: ${formatMoney(p.perDay, currency)}/day`
                  : ""}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Target amount
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3">
              <span className="text-zinc-500">{currency === "USD" ? "$" : "€"}</span>
              <input
                type="number"
                min={1}
                value={targetDisplay}
                onChange={(e) => {
                  setPreset("custom");
                  setTargetDisplay(Number(e.target.value) || 0);
                }}
                className="w-full bg-transparent py-2.5 text-sm text-white outline-none"
              />
            </div>
            <span className="mt-1 block normal-case tracking-normal text-[11px] text-zinc-600">
              {mode === "per_person_day"
                ? "Per person / day"
                : "Total for the trip"}
            </span>
          </label>

          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Adults
            <input
              type="number"
              min={1}
              max={12}
              value={adults}
              onChange={(e) =>
                setAdultsLocal(Math.max(1, Number(e.target.value) || 1))
              }
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none"
            />
          </label>

          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Children
            <input
              type="number"
              min={0}
              max={12}
              value={children}
              onChange={(e) =>
                setChildrenLocal(Math.max(0, Number(e.target.value) || 0))
              }
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none"
            />
          </label>

          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Days in Japan
            <input
              type="number"
              min={1}
              max={60}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none"
            />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs uppercase tracking-wider text-zinc-500">
            Accommodation strategy
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: "self" as const,
                  title: "Self-arranged",
                  hint: "Hostels / Airbnb / no hotel package",
                },
                {
                  id: "budget_hotels" as const,
                  title: "Budget hotels / capsule",
                  hint: "Suggested only — not forced into the plan",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStayStrategy(opt.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  stayStrategy === opt.id
                    ? "border-[#C4A35A] bg-[#C4A35A]/10"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <p className="text-sm font-medium text-white">{opt.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{opt.hint}</p>
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={runPlan}
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-[#C4A35A] px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-[#d4b56a] disabled:opacity-50 sm:w-auto"
        >
          {loading ? "Loading tours…" : "Curate affordable options"}
        </button>
      </section>

      {plan ? (
        <section className="mt-8 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Total budget",
                value: formatMoney(plan.totalBudget, currency),
              },
              {
                label: "Fixed transit (est.)",
                value: formatMoney(plan.fixedTransitEstimate, currency),
              },
              {
                label: "Stay reserve",
                value: formatMoney(plan.stayReserve, currency),
              },
              {
                label: "Usable for experiences",
                value: formatMoney(plan.usableForExperiences, currency),
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  {card.label}
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <p className="text-sm text-zinc-400">
            ~{formatMoney(plan.dailyPerPerson, currency)} / person / day · Add
            tours à la carte only if needed. Free & low-cost options listed
            first.
          </p>

          <div className="space-y-3">
            {plan.suggestions.length === 0 ? (
              <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
                No active tours found. Check PocketBase tours or try again
                later.
              </p>
            ) : (
              plan.suggestions.map((s) => {
                const city = s.tour.expand?.city_id?.name;
                const thumbFile = tourPhoto(s.tour);
                const thumb =
                  thumbFile && s.tour.collectionId
                    ? pbFileUrl(s.tour.collectionId, s.tour.id, thumbFile, {
                        thumb: PB_THUMBS.card,
                        format: "webp",
                      })
                    : "";
                const selected = selectedIds.has(s.tour.id);
                const tagLabel =
                  s.tag === "free_or_low"
                    ? "Free / low-cost"
                    : s.tag === "value"
                      ? "Fits budget"
                      : "Stretch";
                return (
                  <div
                    key={s.tour.id}
                    className={`flex gap-3 rounded-xl border p-3 transition ${
                      selected
                        ? "border-[#C4A35A] bg-[#C4A35A]/10"
                        : s.fitsBudget
                          ? "border-zinc-800 bg-zinc-900/40"
                          : "border-zinc-800/60 bg-zinc-950/40 opacity-70"
                    }`}
                  >
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-medium text-white">
                          {s.tour.title}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                            s.tag === "free_or_low"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : s.tag === "value"
                                ? "bg-sky-500/15 text-sky-300"
                                : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {tagLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {city || "Japan"}
                        {s.tour.category === "activity"
                          ? " · Experience"
                          : " · Tour"}
                      </p>
                      <p className="mt-1 text-sm text-[#C4A35A]">
                        {s.partyPrice === 0
                          ? "Free / self-guided"
                          : `${formatMoney(s.partyPrice, currency)} party · ${formatMoney(s.perPerson, currency)}/pp`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTour(s.tour.id)}
                      className={`shrink-0 self-center rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        selected
                          ? "border-[#C4A35A] bg-[#C4A35A] text-zinc-950"
                          : "border-zinc-600 text-zinc-300 hover:border-zinc-400"
                      }`}
                    >
                      {selected ? "Added" : "Add if needed"}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-4 backdrop-blur md:bottom-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-white">
                Selected experiences:{" "}
                <span className="font-semibold text-[#C4A35A]">
                  {formatMoney(selectedSpend, currency)}
                </span>
                <span className="text-zinc-500">
                  {" "}
                  / {formatMoney(plan.usableForExperiences, currency)} usable
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                Remaining after picks:{" "}
                {formatMoney(
                  Math.max(0, plan.usableForExperiences - selectedSpend),
                  currency
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/discover"
                onClick={syncToBuilder}
                className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 hover:border-zinc-400"
              >
                Browse Discover
              </Link>
              <Link
                href="/builder"
                onClick={syncToBuilder}
                className="rounded-xl bg-[#C4A35A] px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-[#d4b56a]"
              >
                Continue in Builder
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
