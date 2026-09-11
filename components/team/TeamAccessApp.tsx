"use client";

import type PocketBase from "pocketbase";
import { useEffect, useMemo, useState } from "react";
import {
  COLLECTIONS,
  type CollectionDef,
  type CollectionKey,
} from "@/lib/pocketbase/admin-schema";
import {
  DEFAULT_APP_SETTINGS,
  ensureDefaultRules,
  pbFileUrl,
  type PbAppSetting,
  type PbCity,
} from "@/lib/pocketbase/client";
import { useTeamAuth } from "@/store/useTeamAuth";
import { AppShell } from "@/components/layout/AppShell";

type PbClient = PocketBase;

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
              Sign in with PocketBase admin credentials to manage Source of Truth
              and Rules of Logic.
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
  const [category, setCategory] = useState<CollectionKey>("cities");
  const def = COLLECTIONS.find((c) => c.id === category)!;
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
        setCities(
          await pb.collection("cities").getFullList<PbCity>({ sort: "name" })
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const subtitle = (row: Record<string, unknown>) => {
    if (row.price_per_person != null) return `$${row.price_per_person}/person`;
    if (row.min_price_per_night != null)
      return `$${row.min_price_per_night}–$${row.max_price_per_night}/night`;
    if (row.price_per_day != null) return `$${row.price_per_day}/day`;
    if (row.base_pickup_fee != null)
      return `pickup $${row.base_pickup_fee} · drop $${row.base_dropoff_fee}`;
    if (row.is_active === false) return "Inactive";
    if (row.tier) return String(row.tier);
    return "";
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

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-[#8A8278]">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#EEE8DF] text-xs uppercase tracking-wider text-[#8A8278]">
                  <th className="pb-2 font-medium">Record</th>
                  <th className="pb-2 font-medium">Details</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)} className="border-b border-[#F5F0E8]">
                    <td className="py-3 pr-3 font-medium text-[#0B1F3A]">
                      {String(row[def.titleKey] ?? row.name ?? row.title ?? row.id)}
                    </td>
                    <td className="py-3 pr-3 text-[#8A8278]">{subtitle(row)}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        className="mr-3 text-[#C4A35A]"
                        onClick={() => {
                          setEditing(row);
                          setCreating(false);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(creating || editing) && (
          <RecordForm
            def={def}
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
  def,
  cities,
  initial,
  onCancel,
  onSaved,
  getClient,
}: {
  def: CollectionDef;
  cities: PbCity[];
  initial: Record<string, unknown> | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  getClient: () => PbClient;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const f of def.fields) {
      if (f.type === "file") continue;
      const v = initial?.[f.key];
      if (f.type === "bool") {
        base[f.key] =
          v === false || v === "false" ? "false" : "true";
      } else {
        base[f.key] = v == null ? "" : String(v);
      }
    }
    return base;
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      for (const f of def.fields) {
        if (f.type === "file") {
          const file = files[f.key];
          if (file) fd.append(f.key, file);
          continue;
        }
        const val = form[f.key] ?? "";
        if (f.type === "bool") {
          fd.append(f.key, val === "true" ? "true" : "false");
        } else if (f.type === "number") {
          if (val !== "") fd.append(f.key, val);
        } else if (f.required || val) {
          fd.append(f.key, val);
        }
      }

      if (initial?.id) {
        await pb.collection(def.id).update(String(initial.id), fd);
      } else {
        await pb.collection(def.id).create(fd);
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 rounded-2xl border border-[#C4A35A]/40 bg-[#FBF8F2] p-4">
      <h3 className="mb-3 font-display text-xl">
        {initial ? "Edit record" : "New record"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {def.fields.map((f) => {
          if (f.type === "file") {
            const existing =
              initial?.[f.key] && initial?.id
                ? pbFileUrl(
                    String(initial.collectionId ?? def.id),
                    String(initial.id),
                    String(initial[f.key]),
                    "200x200"
                  )
                : "";
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
                    if (file) setFiles((s) => ({ ...s, [f.key]: file }));
                  }}
                >
                  {existing && !files[f.key] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={existing}
                      alt=""
                      className="mx-auto mb-2 h-20 w-20 rounded-xl object-cover"
                    />
                  ) : null}
                  <p className="text-sm text-[#5C6570]">
                    {files[f.key]?.name ||
                      "Drag & drop image, or choose a file"}
                  </p>
                  <input
                    type="file"
                    accept={f.accept || "image/*"}
                    className="mt-2 block w-full text-sm"
                    onChange={(e) =>
                      setFiles((s) => ({
                        ...s,
                        [f.key]: e.target.files?.[0] ?? null,
                      }))
                    }
                  />
                </div>
              </div>
            );
          }

          const span =
            f.type === "textarea" || f.type === "city" ? "sm:col-span-2" : "";

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
                      {v === "true" ? "Yes" : "No"}
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
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="w-full rounded-xl border border-[#D9D2C7] bg-white px-3 py-2 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>

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
  const [rows, setRows] = useState<PbAppSetting[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const pb = getClient();
      await ensureDefaultRules(pb);
      const list = await pb
        .collection("app_settings")
        .getFullList<PbAppSetting>({ sort: "key" });
      setRows(list);
      setDraft(Object.fromEntries(list.map((r) => [r.key, String(r.value)])));
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
      setMsg(e instanceof Error ? e.message : "Save failed");
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
