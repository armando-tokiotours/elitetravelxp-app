"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTeamAuth } from "@/store/useTeamAuth";
import { formatPbError } from "@/lib/pocketbase/admin-schema";

type WizardSection = "cities" | "tours" | "vehicles";

type ListRow = {
  id: string;
  title: string;
  subtitle?: string;
  audience?: string;
};

const SECTIONS: { id: WizardSection; label: string; hint: string }[] = [
  {
    id: "cities",
    label: "Cities",
    hint: "Cover photo optimal: 1200×800 · under 180KB · webp/jpeg",
  },
  {
    id: "tours",
    label: "Tours & activities",
    hint: "Media optimal: 1600×900 · under 250KB image / keep video short · webp later",
  },
  {
    id: "vehicles",
    label: "Vehicles",
    hint: "Vehicle image optimal: 800×600 · under 120KB · webp/png",
  },
];

/**
 * Full-screen Source-of-Truth wizard — save each entry to PocketBase per step.
 */
export function SourceOfTruthWizard() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [section, setSection] = useState<WizardSection>("cities");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<"agency" | "individual" | "both">(
    "both"
  );
  const [category, setCategory] = useState<"tour" | "activity">("tour");
  const [maxPax, setMaxPax] = useState("7");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      if (section === "cities") {
        const list = await pb.collection("cities").getFullList({
          sort: "sort_order,name",
          requestKey: null,
        });
        setRows(
          list.map((r) => ({
            id: r.id,
            title: String(r.name || r.id),
            subtitle: r.is_active === false ? "Inactive" : "Active",
          }))
        );
      } else if (section === "tours") {
        const list = await pb.collection("tours").getFullList({
          sort: "title",
          requestKey: null,
        });
        setRows(
          list.map((r) => ({
            id: r.id,
            title: String(r.title || r.id),
            subtitle: `${r.category || "tour"} · ${r.audience || "both"}`,
            audience: String(r.audience || "both"),
          }))
        );
      } else {
        const list = await pb.collection("vehicles").getFullList({
          sort: "max_passengers,name",
          requestKey: null,
        });
        setRows(
          list.map((r) => ({
            id: r.id,
            title: String(r.name || r.label || r.id),
            subtitle: `Max ${r.max_passengers ?? "—"} pax`,
          }))
        );
      }
    } catch (e) {
      setError(formatPbError(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getClient, section]);

  useEffect(() => {
    void reload();
    setEditingId(null);
    setName("");
    setDescription("");
    setFile(null);
    setAudience("both");
    setCategory("tour");
  }, [reload]);

  const startEdit = (row: ListRow) => {
    setEditingId(row.id);
    setName(row.title);
    setDescription("");
    if (row.audience === "agency" || row.audience === "individual") {
      setAudience(row.audience);
    } else {
      setAudience("both");
    }
  };

  const saveEntry = async () => {
    const title = name.trim();
    if (!title) {
      setMsg("Name / title is required.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const pb = getClient();
      const form = new FormData();
      if (section === "cities") {
        form.append("name", title);
        if (description.trim()) form.append("description", description.trim());
        form.append("is_active", "true");
        if (file) form.append("cover_photo", file);
        if (editingId) {
          await pb.collection("cities").update(editingId, form);
        } else {
          await pb.collection("cities").create(form);
        }
      } else if (section === "tours") {
        form.append("title", title);
        if (description.trim()) form.append("description", description.trim());
        form.append("category", category);
        form.append("audience", audience);
        form.append("is_active", "true");
        // city_id required — use first city if creating
        if (!editingId) {
          const cities = await pb.collection("cities").getList(1, 1, {
            requestKey: null,
          });
          const cityId = cities.items[0]?.id;
          if (!cityId) {
            setMsg("Add a city first before creating tours.");
            setSaving(false);
            return;
          }
          form.append("city_id", cityId);
          form.append("price_1_pax", "0");
          form.append("price_2_pax", "0");
          form.append("price_3_pax", "0");
          form.append("price_4_pax", "0");
          form.append("price_extra_pax", "0");
        }
        if (file) {
          form.append("cover_photo", file);
          form.append("media_type", "Image");
        }
        if (editingId) {
          await pb.collection("tours").update(editingId, form);
        } else {
          await pb.collection("tours").create(form);
        }
      } else {
        form.append("name", title);
        form.append("max_passengers", String(Number(maxPax) || 4));
        if (file) form.append("vehicle_image", file);
        if (editingId) {
          await pb.collection("vehicles").update(editingId, form);
        } else {
          await pb.collection("vehicles").create(form);
        }
      }
      setMsg(editingId ? "Entry updated." : "Entry saved.");
      setEditingId(null);
      setName("");
      setDescription("");
      setFile(null);
      await reload();
    } catch (e) {
      setMsg(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const hint = SECTIONS.find((s) => s.id === section)?.hint || "";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#04080C] text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#075473] uppercase">
            Source of truth
          </p>
          <h1 className="font-display text-xl sm:text-2xl">Catalog wizard</h1>
        </div>
        <Link
          href="/team-access"
          className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300"
        >
          ← Team Access
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-zinc-800 p-3 lg:w-56 lg:flex-col lg:border-r lg:border-b-0 lg:p-4">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={
                section === s.id
                  ? "rounded-xl border border-[#075473] bg-[#075473]/20 px-3 py-2 text-left text-xs font-bold tracking-wider text-[#7dd3fc] uppercase"
                  : "rounded-xl border border-transparent px-3 py-2 text-left text-xs font-bold tracking-wider text-zinc-500 uppercase hover:text-zinc-300"
              }
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2 lg:p-6">
          <section className="space-y-3">
            <h2 className="font-godiva text-sm tracking-wider uppercase">
              Existing · {section}
            </h2>
            {loading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-zinc-500">No rows yet.</p>
            ) : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto lg:max-h-none">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className={`w-full rounded-xl border px-3 py-2 text-left ${
                        editingId === r.id
                          ? "border-[#075473] bg-[#075473]/15"
                          : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">
                        {r.title}
                      </p>
                      {r.subtitle ? (
                        <p className="text-[11px] text-zinc-500">{r.subtitle}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-5">
            <h2 className="font-godiva text-sm tracking-wider uppercase">
              {editingId ? "Edit entry" : "New entry"}
            </h2>
            <p className="mt-1 text-[11px] text-amber-500/90">{hint}</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-zinc-400">
                Name / title
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-[#075473]"
                />
              </label>
              {section === "tours" ? (
                <>
                  <label className="block text-xs text-zinc-400">
                    Category
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as "tour" | "activity")
                      }
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="tour">Tour</option>
                      <option value="activity">Activity / experience</option>
                    </select>
                  </label>
                  <label className="block text-xs text-zinc-400">
                    Audience
                    <select
                      value={audience}
                      onChange={(e) =>
                        setAudience(
                          e.target.value as "agency" | "individual" | "both"
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="both">Both</option>
                      <option value="agency">Travel agencies only</option>
                      <option value="individual">Individuals only</option>
                    </select>
                  </label>
                </>
              ) : null}
              {section === "vehicles" ? (
                <label className="block text-xs text-zinc-400">
                  Max passengers
                  <input
                    value={maxPax}
                    onChange={(e) => setMaxPax(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              ) : null}
              <label className="block text-xs text-zinc-400">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-[#075473]"
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Image / media (optional — convert to WebP later)
                <input
                  type="file"
                  accept="image/*,video/mp4,video/webm"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-xs text-zinc-400"
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEntry()}
                  className="rounded-xl bg-[#075473] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save entry"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setName("");
                      setDescription("");
                      setFile(null);
                    }}
                    className="rounded-xl border border-zinc-700 px-4 py-2.5 text-xs font-bold tracking-wider text-zinc-300 uppercase"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {msg ? <p className="text-xs text-[#7dd3fc]">{msg}</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
