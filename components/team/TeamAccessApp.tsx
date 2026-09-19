"use client";

import type PocketBase from "pocketbase";
import { useEffect, useMemo, useState } from "react";
import {
  COLLECTIONS,
  formatPbError,
  rowPhotoFilename,
  rowTitle,
  type CollectionDef,
  type CollectionKey,
} from "@/lib/pocketbase/admin-schema";
import type { PbTour, PbHub, PbVehicle } from "@/lib/pocketbase/client";
import {
  DEFAULT_APP_SETTINGS,
  ensureDefaultRules,
  getPbBaseUrl,
  pbFileUrl,
  type PbAppSetting,
  type PbCity,
} from "@/lib/pocketbase/client";
import { useTeamAuth } from "@/store/useTeamAuth";
import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { SiteBrandingPanel } from "@/components/team/SiteBrandingPanel";
import { HotelRatesUploader } from "@/components/team/HotelRatesUploader";
import { SeasonalityPanel } from "@/components/team/SeasonalityPanel";
import { ToursCsvSync } from "@/components/team/ToursCsvSync";
import { formatTourTierSummary } from "@/lib/tourPricing";
import { optimizeFileForUpload } from "@/lib/optimizeUploadClient";

type PbClient = PocketBase;

function TeamShell({
  children,
  title = "Admin",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <>
      <AppSidebar
        brandEyebrow="Elite Travel"
        brandTitle={title}
        expandOnHover
      />
      <div
        className={`${APP_SIDEBAR_RAIL_PAD} min-h-screen bg-zinc-950 text-white`}
      >
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 md:hidden">
          <MobileAppNav brandEyebrow="Elite Travel" brandTitle={title} />
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[#C4A35A]">
              Elite Travel
            </p>
            <h1 className="font-display text-lg leading-tight text-white">
              {title}
            </h1>
          </div>
        </header>
        {children}
      </div>
    </>
  );
}

export function TeamAccessApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<
    "truth" | "rules" | "seasonality" | "users" | "branding"
  >("truth");
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const email = useTeamAuth((s) => s.email);
  const login = useTeamAuth((s) => s.login);
  const logout = useTeamAuth((s) => s.logout);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);
  const getClient = useTeamAuth((s) => s.getClient);

  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useTeamAuth.persist.rehydrate();
      if (cancelled) return;
      await hydrateAuth();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateAuth]);

  if (!ready) {
    return (
      <TeamShell title="Team Access">
        <p className="p-8 text-center text-sm text-zinc-400">Loading…</p>
      </TeamShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <TeamShell title="Team Access">
        <main className="mx-auto max-w-md px-4 py-10">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-sm">
            <h2 className="font-display text-2xl text-white">Team login</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Sign in with PocketBase admin credentials to manage Source of Truth,
              Rules of Logic, and team users.
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              PocketBase: {getPbBaseUrl()}
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthLoading(true);
                setAuthError(null);
                try {
                  await login(emailInput.trim(), password);
                } catch (err) {
                  setAuthError(
                    `${formatPbError(err)} · ${getPbBaseUrl()}`
                  );
                } finally {
                  setAuthLoading(false);
                }
              }}
            >
              <label className="block text-xs uppercase tracking-wider text-zinc-400">
                Email
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#C4A35A]"
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-zinc-400">
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#C4A35A]"
                />
              </label>
              {authError ? (
                <p className="text-sm text-red-400">{authError}</p>
              ) : null}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-full bg-amber-500 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                {authLoading ? "Signing in…" : "Enter Team Access"}
              </button>
            </form>
          </div>
        </main>
      </TeamShell>
    );
  }

  return (
    <TeamShell title="Admin">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">
            Signed in as <span className="text-zinc-100">{email}</span>
          </p>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Sign out
          </button>
        </div>

        <div className="mb-6 inline-flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1.5">
          <TabButton active={tab === "truth"} onClick={() => setTab("truth")}>
            Source of Truth
          </TabButton>
          <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>
            Rules of Logic
          </TabButton>
          <TabButton
            active={tab === "seasonality"}
            onClick={() => setTab("seasonality")}
          >
            Seasonality
          </TabButton>
          <TabButton
            active={tab === "branding"}
            onClick={() => setTab("branding")}
          >
            Site Branding
          </TabButton>
          <TabButton active={tab === "users"} onClick={() => setTab("users")}>
            Users
          </TabButton>
        </div>

        {tab === "truth" ? (
          <SourceOfTruthPanel getClient={getClient} />
        ) : tab === "rules" ? (
          <RulesOfLogicPanel getClient={getClient} />
        ) : tab === "seasonality" ? (
          <SeasonalityPanel getClient={getClient} />
        ) : tab === "branding" ? (
          <SiteBrandingPanel getClient={getClient} />
        ) : (
          <UsersPanel getClient={getClient} currentEmail={email} />
        )}
      </main>
    </TeamShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-amber-500 font-bold text-zinc-950"
          : "border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function displayRowTitle(
  def: CollectionDef,
  row: Record<string, unknown>,
  cities: PbCity[],
  hubs: PbHub[] = [],
  vehicles: PbVehicle[] = []
): string {
  if (def.id === "city_movements") {
    const from =
      cities.find((c) => c.id === row.from_city_id)?.name ??
      String(row.from_city_id ?? "From");
    const to =
      cities.find((c) => c.id === row.to_city_id)?.name ??
      String(row.to_city_id ?? "To");
    return `${from} → ${to}`;
  }
  if (def.id === "airport_transfers") {
    const hub =
      hubs.find((h) => h.id === row.hub_id)?.name ??
      String(row.hub_id ?? "Hub");
    const veh =
      vehicles.find((v) => v.id === row.vehicle_id)?.name ||
      vehicles.find((v) => v.id === row.vehicle_id)?.type ||
      String(row.vehicle_id ?? "Vehicle");
    return `${hub} · ${veh}`;
  }
  if (def.id === "chauffeur_rates") {
    const city =
      cities.find((c) => c.id === row.city_id)?.name ??
      String(row.city_id ?? "City");
    const veh =
      vehicles.find((v) => v.id === row.vehicle_id)?.name ||
      vehicles.find((v) => v.id === row.vehicle_id)?.type ||
      String(row.vehicle_id ?? "Vehicle");
    return `${city} · ${veh}`;
  }
  return rowTitle(def, row);
}

function rowSubtitle(def: CollectionDef, row: Record<string, unknown>): string {
  if (def.id === "hubs") {
    return [
      row.type ? String(row.type) : null,
      "vehicle rates in editor",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "seasonal_highlights") {
    const sm = row.start_month;
    const sd = row.start_day;
    const em = row.end_month;
    const ed = row.end_day;
    const window =
      sm != null && sd != null && em != null && ed != null
        ? `${sm}/${sd}–${em}/${ed}`
        : "";
    return [window, row.badge_text ? String(row.badge_text) : null]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "cities") {
    const mod = row.base_price_modifier;
    const base = row.base_price;
    const bits = [];
    if (mod != null) bits.push(`×${mod}`);
    if (base != null) bits.push(`€${base} base`);
    return bits.join(" · ") || "—";
  }
  if (def.id === "tours") {
    const tier = formatTourTierSummary(row as never);
    const hrs = row.duration_hours;
    const isActivity =
      String(row.category || "tour").toLowerCase() === "activity";
    const cat = isActivity ? "Activity" : "Tour";
    const vibes = Array.isArray(row.vibe_tags)
      ? (row.vibe_tags as unknown[])
          .map((v) => String(v))
          .filter(Boolean)
          .join("+")
      : "";
    const crowd = row.crowd_tag ? String(row.crowd_tag).replace(/_/g, " ") : "";
    return [
      cat,
      vibes || null,
      crowd || null,
      tier || null,
      hrs != null ? `${hrs}h` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "vehicles") {
    return [
      row.price_per_day != null ? `€${row.price_per_day}/day` : null,
      row.max_passengers != null ? `${row.max_passengers} pax` : null,
      row.max_luggage != null ? `${row.max_luggage} bags` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "transfers") {
    const pick = row.base_pickup_fee ?? row.pickup_fee;
    const drop = row.base_dropoff_fee ?? row.dropoff_fee;
    return [
      row.type ? String(row.type) : null,
      pick != null ? `pickup €${pick}` : null,
      drop != null ? `drop €${drop}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "feature_explainers") {
    return [
      row.feature_key ? String(row.feature_key) : null,
      row.media_type ? String(row.media_type) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "airport_transfers") {
    return [
      row.base_pickup_fee != null
        ? `pickup €${row.base_pickup_fee}`
        : row.pickup_price_min != null
          ? `pickup €${row.pickup_price_min}`
          : null,
      row.base_dropoff_fee != null
        ? `drop €${row.base_dropoff_fee}`
        : row.dropoff_price_min != null
          ? `drop €${row.dropoff_price_min}`
          : null,
      "(+30% max)",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "chauffeur_rates") {
    return [
      row.base_daily_rate != null ? `€${row.base_daily_rate}/day` : null,
      "(+30% max)",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "accommodations") {
    const min = row.price_min ?? row.min_price_per_night ?? row.min_price;
    const max = row.price_max ?? row.max_price_per_night ?? row.max_price;
    return [
      row.star_rating || row.tier ? String(row.star_rating || row.tier) : null,
      row.season_tier ? String(row.season_tier) : null,
      row.month ? String(row.month) : null,
      min != null && max != null ? `€${min}–€${max}/night` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (def.id === "city_movements") {
    const pub = row.public_transit_time_mins;
    const priv = row.private_transit_time_mins;
    return [
      pub != null ? `public ${pub}m / €${row.public_transit_cost ?? "—"}` : null,
      priv != null
        ? `private ${priv}m / €${row.private_transit_cost ?? "—"}`
        : null,
      row.is_recommended_order ? "recommended →" : "alt direction",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

function SourceOfTruthPanel({ getClient }: { getClient: () => PbClient }) {
  const [category, setCategory] = useState<CollectionKey>("cities");
  const def = COLLECTIONS.find((c) => c.id === category)!;
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cities, setCities] = useState<PbCity[]>([]);
  const [tours, setTours] = useState<PbTour[]>([]);
  const [hubs, setHubs] = useState<PbHub[]>([]);
  const [vehicles, setVehicles] = useState<PbVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [tourCategoryFilter, setTourCategoryFilter] = useState<
    "all" | "tour" | "activity"
  >("all");

  const tourRows = category === "tours" ? rows : [];
  const toursOnlyCount = tourRows.filter(
    (r) => String(r.category || "tour").toLowerCase() !== "activity"
  ).length;
  const activitiesOnlyCount = tourRows.filter(
    (r) => String(r.category || "tour").toLowerCase() === "activity"
  ).length;
  const displayedRows =
    category === "tours" && tourCategoryFilter !== "all"
      ? rows.filter((r) => {
          const cat =
            String(r.category || "tour").toLowerCase() === "activity"
              ? "activity"
              : "tour";
          return cat === tourCategoryFilter;
        })
      : rows;

  const load = async () => {
    setLoading(true);
    setError(null);
    setDebug(null);
    try {
      const pb = getClient();
      if (!useTeamAuth.getState().ensureAuth()) {
        throw new Error("Admin session expired — please sign in again.");
      }
      let list: Record<string, unknown>[] = [];
      try {
        list = (await pb.collection(category).getFullList({
          sort: def.sort,
        })) as unknown as Record<string, unknown>[];
      } catch (sortErr) {
        console.warn("Sort failed, retrying unsorted:", formatPbError(sortErr));
        list = (await pb
          .collection(category)
          .getFullList()) as unknown as Record<string, unknown>[];
      }
      setRows(list);
      if (
        category === "tours" ||
        category === "seasonal_highlights" ||
        category === "hubs" ||
        category === "accommodations" ||
        category === "city_movements" ||
        category === "chauffeur_rates"
      ) {
        setCities(
          await pb.collection("cities").getFullList<PbCity>({ sort: "name" })
        );
      }
      if (
        category === "airport_transfers" ||
        category === "hubs" ||
        category === "chauffeur_rates"
      ) {
        if (category === "airport_transfers") {
          setHubs(
            await pb.collection("hubs").getFullList<PbHub>({ sort: "name" })
          );
        }
        setVehicles(
          await pb
            .collection("vehicles")
            .getFullList<PbVehicle>({ sort: "max_passengers" })
        );
      }
      if (category === "seasonal_highlights") {
        setTours(
          await pb.collection("tours").getFullList<PbTour>({ sort: "title" })
        );
      }
    } catch (e) {
      const msg = formatPbError(e);
      setError(msg);
      setDebug(
        JSON.stringify(
          e && typeof e === "object"
            ? {
                message: (e as { message?: string }).message,
                status: (e as { status?: number }).status,
                response: (e as { response?: unknown }).response,
                url: getClient().baseUrl,
              }
            : e,
          null,
          2
        )
      );
      console.error("[Team Access] load failed", category, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const toggleActive = async (row: Record<string, unknown>) => {
    if (!("is_active" in row) && row.is_active === undefined) return;
    try {
      const next = row.is_active === false;
      await getClient()
        .collection(category)
        .update(String(row.id), { is_active: next });
      await load();
    } catch (e) {
      setError(formatPbError(e));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
      <aside className="flex flex-row flex-wrap gap-2 lg:flex-col">
        {COLLECTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCategory(c.id);
              setEditing(null);
              setCreating(false);
              setTourCategoryFilter("all");
            }}
            className={`rounded-xl px-4 py-2.5 text-left text-sm font-medium ${
              category === c.id
                ? "bg-amber-500 font-bold text-zinc-950"
                : "border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white"
            }`}
          >
            {c.label}
          </button>
        ))}
      </aside>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5">
        {category === "tours" ? (
          <ToursCsvSync
            title={def.label}
            getClient={getClient}
            cities={cities}
            onSynced={() => void load()}
            trailing={
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setEditing(null);
                }}
                className="rounded-full bg-[#C4A35A] px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
              >
                + Add
              </button>
            }
          />
        ) : (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-white">{def.label}</h2>
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setEditing(null);
              }}
              className="rounded-full bg-[#C4A35A] px-4 py-2 text-sm font-semibold text-[#0B1F3A]"
            >
              + Add
            </button>
          </div>
        )}

        {category === "tours" ? (
          <div className="mb-4 inline-flex w-fit flex-wrap items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1.5">
            {(
              [
                {
                  id: "all" as const,
                  label: `All (${tourRows.length})`,
                },
                {
                  id: "tour" as const,
                  label: `🗺️ Guided Tours (${toursOnlyCount})`,
                },
                {
                  id: "activity" as const,
                  label: `🎟️ Activities & Experiences (${activitiesOnlyCount})`,
                },
              ] as const
            ).map((tab) => {
              const on = tourCategoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTourCategoryFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    on
                      ? "bg-amber-500 text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
            <p className="font-medium">{error}</p>
            {debug ? (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-red-400/80">
                {debug}
              </pre>
            ) : null}
          </div>
        ) : null}

        {category === "accommodations" ? (
          <HotelRatesUploader getClient={getClient} onImported={() => void load()} />
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : displayedRows.length === 0 ? (
          <p className="text-sm text-zinc-400">
            {category === "tours" && tourCategoryFilter !== "all"
              ? "No records in this filter. Try All or another tab."
              : "No records yet. Click + Add."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="pb-2 pr-2 font-medium">Photo</th>
                  <th className="pb-2 font-medium">Record</th>
                  <th className="pb-2 font-medium">Details</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => {
                  const filename = rowPhotoFilename(def, row);
                  const thumb =
                    filename && row.id
                      ? pbFileUrl(
                          String(row.collectionId ?? def.id),
                          String(row.id),
                          filename,
                          "100x100"
                        )
                      : "";
                  const hasActive = Object.prototype.hasOwnProperty.call(
                    row,
                    "is_active"
                  );
                  const active = row.is_active !== false;
                  return (
                    <tr
                      key={String(row.id)}
                      className="border-b border-zinc-800/60"
                    >
                      <td className="py-3 pr-2">
                        {thumb && row.media_type !== "Video" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : thumb && row.media_type === "Video" ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-[10px] text-white">
                            ▶
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-[10px] text-zinc-500">
                            —
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-medium text-zinc-100">
                        {displayRowTitle(def, row, cities, hubs, vehicles)}
                      </td>
                      <td className="py-3 pr-3 text-zinc-400">
                        {rowSubtitle(def, row)}
                      </td>
                      <td className="py-3 pr-3">
                        {hasActive ? (
                          <button
                            type="button"
                            onClick={() => void toggleActive(row)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              active
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {active ? "Active" : "Inactive"}
                          </button>
                        ) : def.id === "city_movements" ? (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              row.is_recommended_order
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {row.is_recommended_order
                              ? "Recommended"
                              : "Alt direction"}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="mr-3 text-[#C4A35A]"
                          onClick={() => {
                            setEditing(row);
                            setCreating(false);
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={async () => {
                            if (!confirm("Delete this record?")) return;
                            try {
                              await getClient()
                                .collection(category)
                                .delete(String(row.id));
                              await load();
                            } catch (e) {
                              setError(formatPbError(e));
                            }
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(creating || editing) && (
          <RecordEditModal
            def={def}
            cities={cities}
            tours={tours}
            hubs={hubs}
            vehicles={vehicles}
            initial={creating ? null : editing}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={async () => {
              setCreating(false);
              setEditing(null);
              await load();
            }}
            getClient={getClient}
          />
        )}
      </section>
    </div>
  );
}

function RecordEditModal({
  def,
  cities,
  tours,
  hubs,
  vehicles,
  initial,
  onCancel,
  onSaved,
  getClient,
}: {
  def: CollectionDef;
  cities: PbCity[];
  tours: PbTour[];
  hubs: PbHub[];
  vehicles: PbVehicle[];
  initial: Record<string, unknown> | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  getClient: () => PbClient;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const f of def.fields) {
      if (f.type === "file") continue;
      let v = initial?.[f.key];
      if ((v == null || v === "") && f.legacyKey) {
        v = initial?.[f.legacyKey];
      }
      // Tours: seed tiered prices from legacy single price when empty
      if (
        (v == null || v === "") &&
        def.id === "tours" &&
        (f.key === "price_1_pax" ||
          f.key === "price_2_pax" ||
          f.key === "price_3_pax" ||
          f.key === "price_4_pax" ||
          f.key === "price_extra_pax")
      ) {
        const unit = Number(
          initial?.base_price ??
            initial?.price_per_person ??
            initial?.price ??
            0
        );
        if (unit > 0) {
          const mult =
            f.key === "price_1_pax"
              ? 1
              : f.key === "price_2_pax"
                ? 2
                : f.key === "price_3_pax"
                  ? 3
                  : f.key === "price_4_pax"
                    ? 4
                    : 1;
          v = String(unit * mult);
        }
      }
      if (f.type === "bool") {
        base[f.key] = v === false || v === "false" ? "false" : "true";
      } else if (f.type === "multiselect") {
        if (Array.isArray(v)) {
          base[f.key] = JSON.stringify(
            v.map((x) => String(x).trim()).filter(Boolean)
          );
        } else if (typeof v === "string" && v.trim()) {
          try {
            const parsed = JSON.parse(v);
            base[f.key] = Array.isArray(parsed)
              ? JSON.stringify(parsed)
              : JSON.stringify(
                  v
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                );
          } catch {
            base[f.key] = JSON.stringify(
              v
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)
            );
          }
        } else {
          base[f.key] = "[]";
        }
      } else if (f.key === "base_price_modifier" && (v == null || v === "")) {
        base[f.key] = "1";
      } else if (
        def.id === "tours" &&
        f.key === "category" &&
        (v == null || v === "")
      ) {
        base[f.key] = "tour";
      } else if (
        def.id === "tours" &&
        f.key === "access_type" &&
        (v == null || v === "")
      ) {
        const cat = String(initial?.category || base.category || "tour")
          .toLowerCase();
        base[f.key] = cat === "activity" ? "direct_ticket" : "guided_route";
      } else if (f.key === "type" && (v == null || v === "")) {
        base[f.key] =
          def.id === "hubs" ? "Airport" : "Both";
      } else {
        base[f.key] = v == null ? "" : String(v);
      }
    }
    return base;
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [vehicleRates, setVehicleRates] = useState<HubVehicleRateDraft[]>([]);
  const [ratesLoading, setRatesLoading] = useState(def.id === "hubs");
  const [removedRateIds, setRemovedRateIds] = useState<string[]>([]);

  useEffect(() => {
    if (def.id !== "hubs") return;
    let cancelled = false;
    (async () => {
      setRatesLoading(true);
      try {
        if (!initial?.id) {
          if (!cancelled) {
            setVehicleRates([]);
            setRemovedRateIds([]);
          }
          return;
        }
        const pb = getClient();
        const rows = await pb.collection("airport_transfers").getFullList({
          filter: `hub_id="${String(initial.id)}"`,
          sort: "vehicle_id",
        });
        if (cancelled) return;
        setVehicleRates(
          rows.map((r) => ({
            key: String(r.id),
            id: String(r.id),
            vehicle_id: String(r.vehicle_id ?? ""),
            base_pickup_fee: String(
              (r as { base_pickup_fee?: number }).base_pickup_fee ??
                (r as { pickup_price_min?: number }).pickup_price_min ??
                ""
            ),
            base_dropoff_fee: String(
              (r as { base_dropoff_fee?: number }).base_dropoff_fee ??
                (r as { dropoff_price_min?: number }).dropoff_price_min ??
                ""
            ),
          }))
        );
        setRemovedRateIds([]);
      } catch (e) {
        if (!cancelled) {
          console.warn("[Team Access] hub rates load failed", e);
          setVehicleRates([]);
        }
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [def.id, initial?.id, getClient]);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const tourCategory =
    def.id === "tours"
      ? String(form.category || "tour").toLowerCase() === "activity"
        ? "activity"
        : "tour"
      : null;

  const setTourCategory = (next: "tour" | "activity") => {
    setForm((f) => {
      const nextForm: Record<string, string> = { ...f, category: next };
      if (next === "activity") {
        try {
          const parsed = JSON.parse(f.vibe_tags || "[]");
          if (Array.isArray(parsed) && parsed.length > 1) {
            const primary = parsed.find(
              (x) => String(x) !== "multi_vibe"
            );
            nextForm.vibe_tags = JSON.stringify(
              primary != null ? [String(primary)] : [String(parsed[0])]
            );
          }
        } catch {
          /* keep */
        }
        if (!f.access_type || f.access_type === "guided_route") {
          nextForm.access_type = "direct_ticket";
        }
      } else {
        if (!f.access_type || f.access_type === "direct_ticket") {
          nextForm.access_type = "guided_route";
        }
      }
      return nextForm;
    });
  };

  const existingPhotoUrl = (fKey: string, legacy?: string) => {
    if (!initial?.id) return "";
    const raw = initial[fKey] ?? (legacy ? initial[legacy] : undefined);
    const filename =
      raw != null && String(raw).trim() !== "" ? String(raw) : "";
    if (!filename) return "";
    return pbFileUrl(
      String(initial.collectionId ?? def.id),
      String(initial.id),
      filename,
      "200x200"
    );
  };

  const syncHubVehicleRates = async (pb: PbClient, hubId: string) => {
    for (const id of removedRateIds) {
      await pb.collection("airport_transfers").delete(id);
    }
    for (const rate of vehicleRates) {
      if (!rate.vehicle_id) continue;
      const pickup = Number(rate.base_pickup_fee);
      const dropoff = Number(rate.base_dropoff_fee);
      if (!Number.isFinite(pickup) || !Number.isFinite(dropoff)) {
        throw new Error(
          "Each vehicle rate needs numeric base pickup and drop-off fees."
        );
      }
      const payload = {
        hub_id: hubId,
        vehicle_id: rate.vehicle_id,
        base_pickup_fee: pickup,
        base_dropoff_fee: dropoff,
      };
      if (rate.id) {
        await pb.collection("airport_transfers").update(rate.id, payload);
      } else {
        await pb.collection("airport_transfers").create(payload);
      }
    }
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const pb = getClient();
      if (
        !useTeamAuth.getState().ensureAuth() ||
        !pb.authStore.isSuperuser
      ) {
        throw new Error("Admin session expired — please sign in again.");
      }
      const fd = new FormData();
      for (const f of def.fields) {
        if (f.type === "file") {
          const file = files[f.key];
          if (file) {
            const optimized = await optimizeFileForUpload(file);
            fd.append(f.key, optimized);
            if (f.legacyKey) fd.append(f.legacyKey, optimized);
          }
          continue;
        }
        const val = form[f.key] ?? "";
        if (f.type === "bool") {
          fd.append(f.key, val === "true" ? "true" : "false");
        } else if (f.type === "multiselect") {
          let selected: string[] = [];
          try {
            const parsed = JSON.parse(val || "[]");
            if (Array.isArray(parsed)) {
              selected = parsed.map((x) => String(x).trim()).filter(Boolean);
            }
          } catch {
            selected = val
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
          }
          if (selected.length === 0) {
            // Clear multi-select
            fd.append(f.key, "");
          } else {
            for (const opt of selected) {
              fd.append(f.key, opt);
            }
          }
        } else if (f.type === "number") {
          if (val !== "") {
            fd.append(f.key, val);
            if (f.legacyKey) fd.append(f.legacyKey, val);
          }
        } else if (f.type === "city" || f.type === "tour" || f.type === "hub" || f.type === "vehicle") {
          // Empty string clears the relation
          fd.append(f.key, val);
        } else if (f.required || val) {
          fd.append(f.key, val);
          if (f.legacyKey) fd.append(f.legacyKey, val);
        }
      }

      // Vehicles: keep required legacy `type` + max_pax in sync
      if (def.id === "vehicles" && form.name) {
        fd.set("name", form.name);
        fd.set("type", form.name);
      }
      if (def.id === "vehicles" && form.max_passengers) {
        fd.set("max_passengers", form.max_passengers);
        fd.set("max_pax", form.max_passengers);
      }

      // Tours: keep legacy `price` / `price_per_person` in sync for old readers
      if (def.id === "tours") {
        const cat =
          String(form.category || "tour").toLowerCase() === "activity"
            ? "activity"
            : "tour";
        fd.set(
          "access_type",
          cat === "tour"
            ? "guided_route"
            : form.access_type || "direct_ticket"
        );
        // Enforce vibe limits on save
        try {
          const parsed = JSON.parse(form.vibe_tags || "[]");
          if (Array.isArray(parsed)) {
            let tags = parsed.map((x) => String(x).trim()).filter(Boolean);
            if (cat === "activity") {
              tags = tags.filter((t) => t !== "multi_vibe").slice(0, 1);
            } else {
              tags = tags.slice(0, 4);
            }
            fd.delete("vibe_tags");
            for (const t of tags) fd.append("vibe_tags", t);
          }
        } catch {
          /* keep form appends */
        }
        const p1 = (form.price_1_pax || "").trim();
        if (p1 !== "") {
          fd.set("price", p1);
          fd.set("price_per_person", p1);
        }
      }

      let hubId = initial?.id ? String(initial.id) : "";
      if (initial?.id) {
        await pb.collection(def.id).update(String(initial.id), fd);
      } else {
        const created = await pb.collection(def.id).create(fd);
        hubId = String(created.id);
      }

      if (def.id === "hubs" && hubId) {
        const seen = new Set<string>();
        for (const rate of vehicleRates) {
          if (!rate.vehicle_id) continue;
          if (seen.has(rate.vehicle_id)) {
            throw new Error("Each vehicle can only have one rate per hub.");
          }
          seen.add(rate.vehicle_id);
        }
        await syncHubVehicleRates(pb, hubId);
      }

      await onSaved();
    } catch (e) {
      setErr(formatPbError(e));
      console.error("[Team Access] save failed", def.id, e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl text-white">
            {initial
              ? `Edit · ${displayRowTitle(def, initial, cities, hubs, vehicles)}`
              : `New ${def.label.slice(0, -1)}`}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {def.fields.map((f) => {
            if (f.type === "file") {
              const existing = existingPhotoUrl(f.key, f.legacyKey);
              const live = previews[f.key];
              return (
                <div key={f.key} className="sm:col-span-2">
                  <p className="mb-1 text-xs uppercase tracking-wider text-[#8A8278]">
                    {f.label}
                  </p>
                  <div
                    className={`rounded-2xl border-2 border-dashed p-5 text-center ${
                      dragKey === f.key
                        ? "border-[#C4A35A] bg-[#F3EBD9]"
                        : "border-[#D9D2C7] bg-white"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragKey(f.key);
                    }}
                    onDragLeave={() => setDragKey(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragKey(null);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        setFiles((s) => ({ ...s, [f.key]: file }));
                        setPreviews((s) => ({
                          ...s,
                          [f.key]: URL.createObjectURL(file),
                        }));
                      }
                    }}
                  >
                    {(live || existing) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={live || existing}
                        alt=""
                        className="mx-auto mb-2 h-24 w-24 rounded-xl object-cover"
                      />
                    )}
                    <p className="text-sm text-[#5C6570]">
                      {files[f.key]?.name ||
                        "Drag & drop image, or choose a file"}
                    </p>
                    <input
                      type="file"
                      accept={f.accept || "image/*"}
                      className="mt-2 block w-full text-sm"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setFiles((s) => ({ ...s, [f.key]: file }));
                        if (file) {
                          setPreviews((s) => ({
                            ...s,
                            [f.key]: URL.createObjectURL(file),
                          }));
                        }
                      }}
                    />
                  </div>
                </div>
              );
            }

            const TIER_KEYS = [
              "price_1_pax",
              "price_2_pax",
              "price_3_pax",
              "price_4_pax",
              "price_extra_pax",
            ] as const;

            if (
              TIER_KEYS.includes(f.key as (typeof TIER_KEYS)[number]) &&
              f.key !== "price_1_pax"
            ) {
              return null;
            }

            if (f.key === "price_1_pax") {
              const tierFields = def.fields.filter((x) =>
                TIER_KEYS.includes(x.key as (typeof TIER_KEYS)[number])
              );
              return (
                <div key="tiered-pricing" className="sm:col-span-2">
                  <p className="mb-2 text-xs uppercase tracking-wider text-[#8A8278]">
                    Tiered pricing (€)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {tierFields.map((tf) => (
                      <div key={tf.key}>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[#8A8278]">
                          {tf.label}
                          {tf.required ? " *" : ""}
                        </label>
                        <input
                          type="number"
                          step="any"
                          min={0}
                          value={form[tf.key] ?? ""}
                          onChange={(e) => set(tf.key, e.target.value)}
                          className="w-full rounded-xl border border-[#D9D2C7] bg-white px-2.5 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (
              def.id === "tours" &&
              f.key === "access_type" &&
              tourCategory === "tour"
            ) {
              // Tours always use guided_route — hide the activity-only flags.
              return null;
            }

            const vibeMaxSelect =
              def.id === "tours" && f.key === "vibe_tags"
                ? tourCategory === "activity"
                  ? 1
                  : f.maxSelect ?? 4
                : f.maxSelect;

            const fieldLabel =
              def.id === "tours" && f.key === "vibe_tags"
                ? tourCategory === "activity"
                  ? "Primary vibe tag (pick 1)"
                  : "Vibe tags (multi-select)"
                : f.label;

            const fieldHint =
              def.id === "tours" && f.key === "vibe_tags"
                ? tourCategory === "activity"
                  ? "Hyper-focused matching — one core category only."
                  : "Tours combine multiple sights and neighborhoods into a guided route."
                : def.id === "tours" && f.key === "category"
                  ? "Tour = guided multi-stop day · Activity = ticket / VIP / single experience"
                  : def.id === "tours" && f.key === "access_type"
                    ? "Ticket / Admission · Time-Sensitive Event · VIP Exclusive"
                    : f.hint;

            const span =
              f.type === "textarea" ||
              f.type === "city" ||
              f.type === "hub" ||
              f.type === "vehicle" ||
              f.type === "tour" ||
              f.type === "multiselect"
                ? "sm:col-span-2"
                : "";

            return (
              <div key={f.key} className={span}>
                <label className="mb-1 block text-xs uppercase tracking-wider text-[#8A8278]">
                  {fieldLabel}
                  {f.required ? " *" : ""}
                </label>
                {fieldHint ? (
                  <p className="mb-2 text-[11px] leading-snug text-[#8A8278]">
                    {fieldHint}
                  </p>
                ) : null}
                {f.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                  />
                ) : f.type === "bool" ? (
                  <div className="inline-flex rounded-full border border-[#D9D2C7] bg-white p-1">
                    {["true", "false"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set(f.key, v)}
                        className={`rounded-full px-4 py-1.5 text-sm ${
                          (form[f.key] ?? "true") === v
                            ? "bg-[#0B1F3A] text-white"
                            : "text-[#5C6570]"
                        }`}
                      >
                        {v === "true" ? "Active" : "Inactive"}
                      </button>
                    ))}
                  </div>
                ) : f.type === "select" && f.key === "category" ? (
                  <div className="inline-flex rounded-full border border-[#D9D2C7] bg-white p-1">
                    {(f.options || ["tour", "activity"]).map((o) => {
                      const label =
                        o === "activity"
                          ? "Activity / Experience"
                          : o === "tour"
                            ? "Tour"
                            : o.charAt(0).toUpperCase() + o.slice(1);
                      const current = form[f.key] || "tour";
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() =>
                            setTourCategory(
                              o === "activity" ? "activity" : "tour"
                            )
                          }
                          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                            current === o
                              ? "bg-[#0B1F3A] text-white"
                              : "text-[#5C6570] hover:text-[#0B1F3A]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : f.type === "select" && f.key === "access_type" ? (
                  <div className="flex flex-wrap gap-2">
                    {(f.options || [])
                      .filter((o) => o !== "guided_route")
                      .map((o) => {
                        const labels: Record<string, string> = {
                          direct_ticket: "Ticket / Admission",
                          vip_event: "VIP Exclusive",
                          time_sensitive: "Time-Sensitive Event",
                        };
                        const on = (form[f.key] || "") === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={() => set(f.key, o)}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${
                              on
                                ? "border-[#0B1F3A] bg-[#0B1F3A] text-white"
                                : "border-[#D9D2C7] bg-white text-[#5C6570] hover:border-[#0B1F3A]/40"
                            }`}
                          >
                            {labels[o] ?? o}
                          </button>
                        );
                      })}
                  </div>
                ) : f.type === "select" ? (
                  <select
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {(f.options || []).map((o) => (
                      <option key={o} value={o}>
                        {o.charAt(0).toUpperCase() + o.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : f.type === "multiselect" ? (
                  <div className="flex flex-wrap gap-2">
                    {(f.options || [])
                      .filter((o) => {
                        if (
                          def.id === "tours" &&
                          f.key === "vibe_tags" &&
                          tourCategory === "activity"
                        ) {
                          return o !== "multi_vibe";
                        }
                        return true;
                      })
                      .map((o) => {
                      let selected: string[] = [];
                      try {
                        const parsed = JSON.parse(form[f.key] || "[]");
                        if (Array.isArray(parsed)) {
                          selected = parsed.map((x) => String(x));
                        }
                      } catch {
                        selected = [];
                      }
                      const on = selected.includes(o);
                      const optionLabel =
                        o === "multi_vibe"
                          ? "Multi-Vibe / Full Day Mix"
                          : o;
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => {
                            let next: string[];
                            if (on) {
                              next = selected.filter((x) => x !== o);
                            } else if (
                              vibeMaxSelect != null &&
                              selected.length >= vibeMaxSelect
                            ) {
                              next =
                                vibeMaxSelect === 1
                                  ? [o]
                                  : [...selected.slice(0, vibeMaxSelect - 1), o];
                            } else {
                              next = [...selected, o];
                            }
                            set(f.key, JSON.stringify(next));
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            on
                              ? "border-[#0B1F3A] bg-[#0B1F3A] text-white"
                              : "border-[#D9D2C7] bg-white text-[#5C6570] hover:border-[#0B1F3A]/40"
                          }`}
                        >
                          {optionLabel}
                        </button>
                      );
                    })}
                  </div>
                ) : f.type === "city" ? (
                  <select
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">
                      {def.id === "seasonal_highlights"
                        ? "All Japan"
                        : "Select city"}
                    </option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : f.type === "hub" ? (
                  <select
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select airport / hub</option>
                    {hubs.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                ) : f.type === "vehicle" ? (
                  <select
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name || v.type || v.id}
                        {v.max_passengers != null
                          ? ` (${v.max_passengers} pax)`
                          : ""}
                      </option>
                    ))}
                  </select>
                ) : f.type === "tour" ? (
                  <select
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">No linked tour</option>
                    {tours.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    step={f.type === "number" ? "any" : undefined}
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>

        {def.id === "hubs" ? (
          <div className="mt-5 rounded-2xl border border-[#E8E2D9] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-[#0B1F3A]">
                  Vehicle Pricing
                </h4>
                <p className="mt-1 text-xs text-[#8A8278]">
                  Base fees per vehicle. Client max = base × 1.30.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setVehicleRates((rows) => [
                    ...rows,
                    {
                      key: `new-${Date.now()}-${rows.length}`,
                      vehicle_id: "",
                      base_pickup_fee: "",
                      base_dropoff_fee: "",
                    },
                  ])
                }
                className="rounded-full border border-[#C4A35A] bg-[#FBF8F2] px-3 py-1.5 text-xs font-semibold text-[#0B1F3A]"
              >
                + Add Vehicle Rate
              </button>
            </div>

            {ratesLoading ? (
              <p className="text-sm text-[#8A8278]">Loading rates…</p>
            ) : vehicleRates.length === 0 ? (
              <p className="text-sm text-[#8A8278]">
                No vehicle rates yet. Add Alphard, 10-seater, 14-seater, etc.
              </p>
            ) : (
              <div className="space-y-3">
                {vehicleRates.map((rate, idx) => (
                  <div
                    key={rate.key}
                    className="grid gap-2 rounded-xl border border-[#EEE8DF] bg-[#FBF8F2] p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
                  >
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A8278]">
                      Vehicle
                      <select
                        value={rate.vehicle_id}
                        onChange={(e) =>
                          setVehicleRates((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? { ...r, vehicle_id: e.target.value }
                                : r
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-[#D9D2C7] bg-white px-2 py-2 text-sm"
                      >
                        <option value="">Select vehicle…</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name || v.type || v.id}
                            {v.max_passengers != null
                              ? ` (${v.max_passengers} pax)`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A8278]">
                      Pickup base (€)
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={rate.base_pickup_fee}
                        onChange={(e) =>
                          setVehicleRates((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? { ...r, base_pickup_fee: e.target.value }
                                : r
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-[#D9D2C7] bg-white px-2 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8A8278]">
                      Drop-off base (€)
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={rate.base_dropoff_fee}
                        onChange={(e) =>
                          setVehicleRates((rows) =>
                            rows.map((r, i) =>
                              i === idx
                                ? { ...r, base_dropoff_fee: e.target.value }
                                : r
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-[#D9D2C7] bg-white px-2 py-2 text-sm"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          setVehicleRates((rows) =>
                            rows.filter((_, i) => i !== idx)
                          );
                          if (rate.id) {
                            setRemovedRateIds((ids) => [...ids, rate.id!]);
                          }
                        }}
                        className="rounded-lg px-2 py-2 text-sm text-red-600"
                        aria-label="Remove vehicle rate"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {err ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-full bg-[#0B1F3A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#D9D2C7] px-5 py-2.5 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

type HubVehicleRateDraft = {
  key: string;
  id?: string;
  vehicle_id: string;
  base_pickup_fee: string;
  base_dropoff_fee: string;
};

function RulesOfLogicPanel({ getClient }: { getClient: () => PbClient }) {
  const [rows, setRows] = useState<PbAppSetting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      await ensureDefaultRules(pb);
      const list = await pb
        .collection("app_settings")
        .getFullList<PbAppSetting>({ sort: "key" });
      setRows(list);
      setDraft(Object.fromEntries(list.map((r) => [r.key, String(r.value)])));
    } catch (e) {
      setError(formatPbError(e));
      console.error("[Team Access] rules load failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = useMemo(
    () => Object.fromEntries(DEFAULT_APP_SETTINGS.map((d) => [d.key, d])),
    []
  );

  const saveAll = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      for (const row of rows) {
        const next = draft[row.key] ?? row.value;
        if (String(next) !== String(row.value)) {
          await pb.collection("app_settings").update(row.id, { value: next });
        }
      }
      setMsg("Rules saved. Builder applies them on next load.");
      await load();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading app_settings…</p>;
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <h2 className="font-display text-2xl text-white">Rules of Logic</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Stored in <code>app_settings</code> — vehicle allocation, tour days, and
        pricing multipliers.
      </p>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        {rows.map((row) => {
          const info = meta[row.key];
          const isBool = row.key === "allow_tours_on_travel_days";
          return (
            <div
              key={row.id}
              className="flex flex-col gap-2 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="max-w-md">
                <p className="font-medium text-zinc-100">{row.key}</p>
                <p className="text-xs text-zinc-400">
                  {row.description || info?.description}
                </p>
              </div>
              {isBool ? (
                <div className="inline-flex rounded-full border border-zinc-700 bg-zinc-950 p-1">
                  {["true", "false"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, [row.key]: v }))
                      }
                      className={`rounded-full px-4 py-1.5 text-sm ${
                        (draft[row.key] ?? row.value) === v
                          ? "bg-amber-500 font-semibold text-zinc-950"
                          : "text-zinc-400"
                      }`}
                    >
                      {v === "true" ? "On" : "Off"}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={draft[row.key] ?? row.value}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [row.key]: e.target.value }))
                  }
                  className="w-full max-w-[12rem] rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:text-right"
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void saveAll()}
        className="mt-6 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save rules"}
      </button>
      {msg ? <p className="mt-3 text-sm text-zinc-400">{msg}</p> : null}
    </div>
  );
}

type TeamUser = {
  id: string;
  email: string;
  created?: string;
  updated?: string;
};

function UsersPanel({
  getClient,
  currentEmail,
}: {
  getClient: () => PbClient;
  currentEmail: string | null;
}) {
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const list = await pb.collection("_superusers").getFullList<TeamUser>({
        sort: "email",
      });
      setRows(list);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createUser = async () => {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (password !== passwordConfirm) {
        throw new Error("Password confirmation does not match.");
      }
      await getClient().collection("_superusers").create({
        email: email.trim(),
        password,
        passwordConfirm,
      });
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setMsg("User created — they can sign in on Team Access.");
      await load();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (id: string) => {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      if (resetPass.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (resetPass !== resetConfirm) {
        throw new Error("Password confirmation does not match.");
      }
      await getClient().collection("_superusers").update(id, {
        password: resetPass,
        passwordConfirm: resetConfirm,
      });
      setResetId(null);
      setResetPass("");
      setResetConfirm("");
      setMsg("Password updated.");
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (row: TeamUser) => {
    if (row.email === currentEmail) {
      setError("You cannot delete the account you are signed in with.");
      return;
    }
    if (!confirm(`Delete team user ${row.email}?`)) return;
    setError(null);
    try {
      await getClient().collection("_superusers").delete(row.id);
      setMsg(`Deleted ${row.email}`);
      await load();
    } catch (e) {
      setError(formatPbError(e));
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <h2 className="font-display text-2xl text-white">Users</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Create and manage PocketBase admin accounts that can open Team Access.
      </p>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {msg ? <p className="mt-3 text-sm text-emerald-400">{msg}</p> : null}

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="font-medium text-zinc-100">Create user</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-400 sm:col-span-2">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder="colleague@tokiotours.nl"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Confirm password
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving || !email || !password}
          onClick={() => void createUser()}
          className="mt-4 rounded-full bg-[#C4A35A] px-5 py-2 text-sm font-semibold text-[#0B1F3A] disabled:opacity-50"
        >
          {saving ? "Creating…" : "+ Create user"}
        </button>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-medium text-zinc-100">Existing users</h3>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/60">
                    <td className="py-3 pr-3 font-medium text-zinc-100">
                      {row.email}
                      {row.email === currentEmail ? (
                        <span className="ml-2 text-xs font-normal text-zinc-500">
                          (you)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="mr-3 text-[#C4A35A]"
                        onClick={() => {
                          setResetId(row.id);
                          setResetPass("");
                          setResetConfirm("");
                        }}
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        className="text-red-400 disabled:opacity-40"
                        disabled={row.email === currentEmail}
                        onClick={() => void removeUser(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resetId ? (
        <div className="mt-5 rounded-2xl border border-[#C4A35A]/40 bg-zinc-950 p-4">
          <h3 className="font-medium text-zinc-100">
            Reset password · {rows.find((r) => r.id === resetId)?.email}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="password"
              placeholder="New password"
              value={resetPass}
              onChange={(e) => setResetPass(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void resetPassword(resetId)}
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              Save password
            </button>
            <button
              type="button"
              onClick={() => setResetId(null)}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
