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
import type { PbTour } from "@/lib/pocketbase/client";
import {
  DEFAULT_APP_SETTINGS,
  ensureDefaultRules,
  getPbBaseUrl,
  pbFileUrl,
  type PbAppSetting,
  type PbCity,
} from "@/lib/pocketbase/client";
import { useTeamAuth } from "@/store/useTeamAuth";
import { AppShell } from "@/components/layout/AppShell";
import { SiteBrandingPanel } from "@/components/team/SiteBrandingPanel";

type PbClient = PocketBase;

export function TeamAccessApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"truth" | "rules" | "users" | "branding">(
    "truth"
  );
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
    useTeamAuth.persist.rehydrate();
    hydrateAuth();
    setReady(true);
  }, [hydrateAuth]);

  if (!ready) {
    return (
      <AppShell title="Team Access" hideBottomPad>
        <p className="p-8 text-center text-sm text-[#8A8278]">Loading…</p>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppShell title="Team Access" subtitle="Protected" hideBottomPad>
        <main className="mx-auto max-w-md px-4 py-10">
          <div className="rounded-2xl border border-[#E8E2D9] bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl text-[#0B1F3A]">Team login</h2>
            <p className="mt-2 text-sm text-[#8A8278]">
              Sign in with PocketBase admin credentials to manage Source of Truth,
              Rules of Logic, and team users.
            </p>
            <p className="mt-1 text-[11px] text-[#A39A8E]">
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
                    formatPbError(err) ||
                      `Login failed against ${getPbBaseUrl()}`
                  );
                } finally {
                  setAuthLoading(false);
                }
              }}
            >
              <label className="block text-xs uppercase tracking-wider text-[#8A8278]">
                Email
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm outline-none focus:border-[#C4A35A]"
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-[#8A8278]">
                Password
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm outline-none focus:border-[#C4A35A]"
                />
              </label>
              {authError ? (
                <p className="text-sm text-red-600">{authError}</p>
              ) : null}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {authLoading ? "Signing in…" : "Enter Team Access"}
              </button>
            </form>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell title="Team Access" subtitle="Admin dashboard" hideBottomPad>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#8A8278]">
            Signed in as <span className="text-[#0B1F3A]">{email}</span>
          </p>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-[#D9D2C7] px-4 py-1.5 text-sm"
          >
            Sign out
          </button>
        </div>

        <div className="mb-6 inline-flex flex-wrap rounded-full border border-[#D9D2C7] bg-white p-1">
          <TabButton active={tab === "truth"} onClick={() => setTab("truth")}>
            Source of Truth
          </TabButton>
          <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>
            Rules of Logic
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
        ) : tab === "branding" ? (
          <SiteBrandingPanel getClient={getClient} />
        ) : (
          <UsersPanel getClient={getClient} currentEmail={email} />
        )}
      </main>
    </AppShell>
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
      className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
        active ? "bg-[#0B1F3A] text-white" : "text-[#5C6570]"
      }`}
    >
      {children}
    </button>
  );
}

function rowSubtitle(def: CollectionDef, row: Record<string, unknown>): string {
  if (def.id === "hubs") {
    return [
      row.type ? String(row.type) : null,
      row.pickup_fee != null ? `pickup €${row.pickup_fee}` : null,
      row.dropoff_fee != null ? `drop €${row.dropoff_fee}` : null,
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
    const price = row.price_per_person ?? row.price;
    const hrs = row.duration_hours;
    return [
      price != null ? `€${price}/person` : null,
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
  if (def.id === "accommodations") {
    const min = row.min_price_per_night ?? row.min_price;
    const max = row.max_price_per_night ?? row.max_price;
    return [
      row.tier ? String(row.tier) : null,
      min != null && max != null ? `€${min}–€${max}/night` : null,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setDebug(null);
    try {
      const pb = getClient();
      if (!pb.authStore.isValid) {
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
      if (category === "tours" || category === "seasonal_highlights" || category === "hubs") {
        setCities(
          await pb.collection("cities").getFullList<PbCity>({ sort: "name" })
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
            }}
            className={`rounded-xl px-4 py-2.5 text-left text-sm font-medium ${
              category === c.id
                ? "bg-[#0B1F3A] text-white"
                : "border border-[#E8E2D9] bg-white text-[#0B1F3A]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </aside>

      <section className="rounded-2xl border border-[#E8E2D9] bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{def.label}</h2>
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

        {error ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">{error}</p>
            {debug ? (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-red-600/80">
                {debug}
              </pre>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#8A8278]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#8A8278]">No records yet. Click + Add.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#EEE8DF] text-xs uppercase tracking-wider text-[#8A8278]">
                  <th className="pb-2 pr-2 font-medium">Photo</th>
                  <th className="pb-2 font-medium">Record</th>
                  <th className="pb-2 font-medium">Details</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
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
                      className="border-b border-[#F5F0E8]"
                    >
                      <td className="py-3 pr-2">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F3EDE4] text-[10px] text-[#8A8278]">
                            —
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-medium text-[#0B1F3A]">
                        {rowTitle(def, row)}
                      </td>
                      <td className="py-3 pr-3 text-[#8A8278]">
                        {rowSubtitle(def, row)}
                      </td>
                      <td className="py-3 pr-3">
                        {hasActive ? (
                          <button
                            type="button"
                            onClick={() => void toggleActive(row)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              active
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-[#F3EDE4] text-[#8A8278]"
                            }`}
                          >
                            {active ? "Active" : "Inactive"}
                          </button>
                        ) : (
                          <span className="text-xs text-[#8A8278]">—</span>
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
  initial,
  onCancel,
  onSaved,
  getClient,
}: {
  def: CollectionDef;
  cities: PbCity[];
  tours: PbTour[];
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
      if (f.type === "bool") {
        base[f.key] = v === false || v === "false" ? "false" : "true";
      } else if (f.key === "base_price_modifier" && (v == null || v === "")) {
        base[f.key] = "1";
      } else if (f.key === "type" && (v == null || v === "")) {
        base[f.key] = "Both";
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

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

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

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const pb = getClient();
      if (!pb.authStore.isValid) {
        throw new Error("Admin session expired — please sign in again.");
      }
      const fd = new FormData();
      for (const f of def.fields) {
        if (f.type === "file") {
          const file = files[f.key];
          if (file) {
            fd.append(f.key, file);
            if (f.legacyKey) fd.append(f.legacyKey, file);
          }
          continue;
        }
        const val = form[f.key] ?? "";
        if (f.type === "bool") {
          fd.append(f.key, val === "true" ? "true" : "false");
        } else if (f.type === "number") {
          if (val !== "") {
            fd.append(f.key, val);
            if (f.legacyKey) fd.append(f.legacyKey, val);
          }
        } else if (f.type === "city" || f.type === "tour") {
          // Empty string clears the relation (All Japan / no tour)
          fd.append(f.key, val);
        } else if (f.required || val) {
          fd.append(f.key, val);
          if (f.legacyKey) fd.append(f.legacyKey, val);
        }
      }

      // Vehicles: keep required legacy `type` in sync with name
      if (def.id === "vehicles" && form.name) {
        fd.append("type", form.name);
      }

      if (initial?.id) {
        await pb.collection(def.id).update(String(initial.id), fd);
      } else {
        await pb.collection(def.id).create(fd);
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
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#E8E2D9] bg-[#FBF8F2] p-5 shadow-xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl text-[#0B1F3A]">
            {initial ? `Edit · ${rowTitle(def, initial)}` : `New ${def.label.slice(0, -1)}`}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#D9D2C7] px-3 py-1 text-sm"
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

            const span =
              f.type === "textarea" ||
              f.type === "city" ||
              f.type === "tour"
                ? "sm:col-span-2"
                : "";

            return (
              <div key={f.key} className={span}>
                <label className="mb-1 block text-xs uppercase tracking-wider text-[#8A8278]">
                  {f.label}
                  {f.required ? " *" : ""}
                </label>
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
                ) : f.type === "select" ? (
                  <select
                    value={form[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {(f.options || []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
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
    return <p className="text-sm text-[#8A8278]">Loading app_settings…</p>;
  }

  return (
    <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5">
      <h2 className="font-display text-2xl">Rules of Logic</h2>
      <p className="mt-1 text-sm text-[#8A8278]">
        Stored in <code>app_settings</code> — vehicle allocation, tour days, and
        pricing multipliers.
      </p>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
              className="flex flex-col gap-2 border-b border-[#F0EBE3] pb-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="max-w-md">
                <p className="font-medium text-[#0B1F3A]">{row.key}</p>
                <p className="text-xs text-[#8A8278]">
                  {row.description || info?.description}
                </p>
              </div>
              {isBool ? (
                <div className="inline-flex rounded-full border border-[#D9D2C7] bg-[#F7F3EC] p-1">
                  {["true", "false"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, [row.key]: v }))
                      }
                      className={`rounded-full px-4 py-1.5 text-sm ${
                        (draft[row.key] ?? row.value) === v
                          ? "bg-[#0B1F3A] text-white"
                          : "text-[#5C6570]"
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
                  className="w-full max-w-[12rem] rounded-xl border border-[#D9D2C7] px-3 py-2 text-sm sm:text-right"
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
        className="mt-6 rounded-full bg-[#0B1F3A] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save rules"}
      </button>
      {msg ? <p className="mt-3 text-sm text-[#5C6570]">{msg}</p> : null}
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
    <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5">
      <h2 className="font-display text-2xl">Users</h2>
      <p className="mt-1 text-sm text-[#8A8278]">
        Create and manage PocketBase admin accounts that can open Team Access.
      </p>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}

      <div className="mt-6 rounded-2xl border border-[#EEE8DF] bg-[#FBF8F2] p-4">
        <h3 className="font-medium text-[#0B1F3A]">Create user</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase tracking-wider text-[#8A8278] sm:col-span-2">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
              placeholder="colleague@tokiotours.nl"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-[#8A8278]">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-[#8A8278]">
            Confirm password
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
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
        <h3 className="mb-3 font-medium text-[#0B1F3A]">Existing users</h3>
        {loading ? (
          <p className="text-sm text-[#8A8278]">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#EEE8DF] text-xs uppercase tracking-wider text-[#8A8278]">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#F5F0E8]">
                    <td className="py-3 pr-3 font-medium text-[#0B1F3A]">
                      {row.email}
                      {row.email === currentEmail ? (
                        <span className="ml-2 text-xs font-normal text-[#8A8278]">
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
                        className="text-red-600 disabled:opacity-40"
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
        <div className="mt-5 rounded-2xl border border-[#C4A35A]/40 bg-[#FBF8F2] p-4">
          <h3 className="font-medium text-[#0B1F3A]">
            Reset password · {rows.find((r) => r.id === resetId)?.email}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="password"
              placeholder="New password"
              value={resetPass}
              onChange={(e) => setResetPass(e.target.value)}
              className="rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              className="rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void resetPassword(resetId)}
              className="rounded-full bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save password
            </button>
            <button
              type="button"
              onClick={() => setResetId(null)}
              className="rounded-full border border-[#D9D2C7] px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
