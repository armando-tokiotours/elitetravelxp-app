"use client";

import type PocketBase from "pocketbase";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SYSTEM_RULES,
  ensureDefaultRules,
  pbFileUrl,
  type PbCity,
  type PbSystemRule,
} from "@/lib/pocketbase/client";
import { useTeamAuth } from "@/store/useTeamAuth";
import { AppShell } from "@/components/layout/AppShell";

type PbClient = PocketBase;

type Category =
  | "cities"
  | "vehicles"
  | "tours"
  | "accommodations"
  | "transfers";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "cities", label: "Cities" },
  { id: "tours", label: "Tours" },
  { id: "vehicles", label: "Vehicles" },
  { id: "accommodations", label: "Hotels" },
  { id: "transfers", label: "Transfers" },
];

export function TeamAccessApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"truth" | "rules">("truth");
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
              Sign in with your PocketBase admin credentials to manage Source of
              Truth and Rules of Logic.
            </p>
            <form
              className="mt-6 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthLoading(true);
                setAuthError(null);
                try {
                  await login(emailInput.trim(), password);
                } catch {
                  setAuthError("Invalid email or password.");
                } finally {
                  setAuthLoading(false);
                }
              }}
            >
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-[#8A8278]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm outline-none focus:border-[#C4A35A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-[#8A8278]">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm outline-none focus:border-[#C4A35A]"
                />
              </div>
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

        <div className="mb-6 inline-flex rounded-full border border-[#D9D2C7] bg-white p-1">
          <TabButton active={tab === "truth"} onClick={() => setTab("truth")}>
            Source of Truth
          </TabButton>
          <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>
            Rules of Logic
          </TabButton>
        </div>

        {tab === "truth" ? (
          <SourceOfTruthPanel getClient={getClient} />
        ) : (
          <RulesOfLogicPanel getClient={getClient} />
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

function SourceOfTruthPanel({ getClient }: { getClient: () => PbClient }) {
  const [category, setCategory] = useState<Category>("cities");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cities, setCities] = useState<PbCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const list = await pb.collection(category).getFullList({ sort: "-created" });
      setRows(list as unknown as Record<string, unknown>[]);
      if (category === "tours") {
        const c = await pb
          .collection("cities")
          .getFullList<PbCity>({ sort: "name" });
        setCities(c);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
      <aside className="flex flex-row flex-wrap gap-2 lg:flex-col">
        {CATEGORIES.map((c) => (
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
          <h2 className="font-display text-2xl capitalize">{category}</h2>
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

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-[#8A8278]">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={String(row.id)}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#F0EBE3] px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#0B1F3A]">
                    {String(
                      row.name ??
                        row.title ??
                        row.location ??
                        row.room_type ??
                        row.id
                    )}
                  </p>
                  <p className="truncate text-xs text-[#8A8278]">
                    {row.price != null
                      ? `$${row.price}`
                      : row.min_price != null
                        ? `$${row.min_price}–$${row.max_price}`
                        : row.price_per_day != null
                          ? `$${row.price_per_day}/day`
                          : row.base_price != null
                            ? `base $${row.base_price}`
                            : row.tier
                              ? String(row.tier)
                              : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="text-sm text-[#C4A35A]"
                    onClick={() => {
                      setEditing(row);
                      setCreating(false);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-sm text-red-600"
                    onClick={async () => {
                      if (!confirm("Delete this record?")) return;
                      await getClient()
                        .collection(category)
                        .delete(String(row.id));
                      await load();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(creating || editing) && (
          <RecordForm
            category={category}
            cities={cities}
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

function RecordForm({
  category,
  cities,
  initial,
  onCancel,
  onSaved,
  getClient,
}: {
  category: Category;
  cities: PbCity[];
  initial: Record<string, unknown> | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  getClient: () => PbClient;
}) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initial ?? {}).map(([k, v]) => [
        k,
        v == null ? "" : String(v),
      ])
    )
  );
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const fields = useMemo(() => {
    switch (category) {
      case "cities":
        return [
          ["name", "Name", "text"],
          ["description", "Description", "textarea"],
          ["base_price", "Base price", "number"],
          ["base_price_modifier", "Price modifier", "number"],
          ["sort_order", "Sort order", "number"],
        ] as const;
      case "tours":
        return [
          ["title", "Title", "text"],
          ["description", "Description", "textarea"],
          ["price", "Price", "number"],
          ["city_id", "City", "city"],
        ] as const;
      case "vehicles":
        return [
          ["name", "Name", "text"],
          ["type", "Type (legacy)", "text"],
          ["max_passengers", "Max passengers", "number"],
          ["price_per_day", "Price per day", "number"],
        ] as const;
      case "accommodations":
        return [
          ["tier", "Tier (4-star / 5-star)", "text"],
          ["room_type", "Room type", "text"],
          ["min_price", "Min price", "number"],
          ["max_price", "Max price", "number"],
        ] as const;
      case "transfers":
        return [
          ["location", "Location", "text"],
          ["pickup_fee", "Pickup fee", "number"],
          ["dropoff_fee", "Dropoff fee", "number"],
        ] as const;
      default:
        return [] as const;
    }
  }, [category]);

  const supportsImage = category === "cities" || category === "tours";

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      for (const [key, , type] of fields) {
        const val = form[key] ?? "";
        if (type === "number") {
          if (val !== "") fd.append(key, val);
        } else if (key === "city_id" || val) {
          fd.append(key, val);
        }
      }
      if (supportsImage && file) fd.append("image", file);

      if (initial?.id) {
        await pb.collection(category).update(String(initial.id), fd);
      } else {
        await pb.collection(category).create(fd);
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const existingImage =
    supportsImage && initial?.image && initial?.id
      ? pbFileUrl(
          String(initial.collectionId ?? category),
          String(initial.id),
          String(initial.image),
          "200x200"
        )
      : "";

  return (
    <div className="mt-5 rounded-2xl border border-[#C4A35A]/40 bg-[#FBF8F2] p-4">
      <h3 className="mb-3 font-display text-xl">
        {initial ? "Edit record" : "New record"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([key, label, type]) => (
          <div
            key={key}
            className={
              type === "textarea" || type === "city" ? "sm:col-span-2" : ""
            }
          >
            <label className="mb-1 block text-xs uppercase tracking-wider text-[#8A8278]">
              {label}
            </label>
            {type === "textarea" ? (
              <textarea
                rows={3}
                value={form[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
              />
            ) : type === "city" ? (
              <select
                value={form[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
              >
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={type === "number" ? "number" : "text"}
                value={form[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {supportsImage ? (
        <div
          className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition ${
            dragOver
              ? "border-[#C4A35A] bg-[#F3EBD9]"
              : "border-[#D9D2C7] bg-white"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
        >
          {existingImage && !file ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={existingImage}
              alt=""
              className="mx-auto mb-3 h-24 w-24 rounded-xl object-cover"
            />
          ) : null}
          <p className="text-sm text-[#5C6570]">
            {file ? file.name : "Drag & drop a cover photo, or choose a file"}
          </p>
          <input
            type="file"
            accept="image/*"
            className="mt-3 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      ) : null}

      {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-full bg-[#0B1F3A] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[#D9D2C7] px-5 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RulesOfLogicPanel({ getClient }: { getClient: () => PbClient }) {
  const [rules, setRules] = useState<PbSystemRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const pb = getClient();
      await ensureDefaultRules(pb);
      const rows = await pb
        .collection("system_rules")
        .getFullList<PbSystemRule>({ sort: "group,key" });
      setRules(rows);
      setDraft(Object.fromEntries(rows.map((r) => [r.key, r.value])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAll = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const pb = getClient();
      for (const rule of rules) {
        const next = draft[rule.key] ?? rule.value;
        if (next !== rule.value) {
          await pb.collection("system_rules").update(rule.id, { value: next });
        }
      }
      setMsg("Rules saved. Builder will use them on next load.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const byGroup = useMemo(() => {
    const map = new Map<string, PbSystemRule[]>();
    for (const r of rules) {
      const g = r.group || "general";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    }
    return map;
  }, [rules]);

  if (loading) {
    return <p className="text-sm text-[#8A8278]">Loading rules…</p>;
  }

  return (
    <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5">
      <h2 className="font-display text-2xl">Rules of Logic</h2>
      <p className="mt-1 text-sm text-[#8A8278]">
        These values power vehicle allocation, tour availability, and pricing
        multipliers in the Trip Builder.
      </p>

      <div className="mt-6 space-y-8">
        {[...byGroup.entries()].map(([group, items]) => (
          <div key={group}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
              {group}
            </h3>
            <div className="space-y-4">
              {items.map((rule) => {
                const meta =
                  DEFAULT_SYSTEM_RULES.find((d) => d.key === rule.key) ?? rule;
                const isBool = rule.key === "allow_tours_on_travel_days";
                return (
                  <div
                    key={rule.id}
                    className="flex flex-col gap-2 border-b border-[#F0EBE3] pb-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-[#0B1F3A]">
                        {meta.label || rule.key}
                      </p>
                      <p className="text-xs text-[#8A8278]">{rule.key}</p>
                    </div>
                    {isBool ? (
                      <div className="inline-flex rounded-full border border-[#D9D2C7] bg-[#F7F3EC] p-1">
                        {["true", "false"].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({ ...d, [rule.key]: v }))
                            }
                            className={`rounded-full px-4 py-1.5 text-sm ${
                              (draft[rule.key] ?? rule.value) === v
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
                        type="number"
                        step="any"
                        value={draft[rule.key] ?? rule.value}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [rule.key]: e.target.value,
                          }))
                        }
                        className="w-full max-w-[10rem] rounded-xl border border-[#D9D2C7] px-3 py-2 text-sm sm:text-right"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
