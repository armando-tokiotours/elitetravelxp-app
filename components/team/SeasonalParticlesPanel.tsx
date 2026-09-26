"use client";

import type PocketBase from "pocketbase";
import { useCallback, useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  pbFileUrl,
  type PbSeasonalParticle,
} from "@/lib/pocketbase/client";
import {
  PARTICLE_ICON_SPECS,
  PARTICLE_SEASON_OPTIONS,
  setSeasonalParticleRules,
} from "@/lib/seasonality";
import { useSeasonalFxStore } from "@/store/useSeasonalFxStore";

type PbClient = PocketBase;

type Draft = {
  id?: string;
  season: "sakura" | "snow" | "momiji";
  label: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  is_active: boolean;
  sort_order: number;
  iconFile: File | null;
  clearIcon: boolean;
};

const emptyDraft = (): Draft => ({
  season: "sakura",
  label: "Sakura Peak Season Detected",
  start_month: 3,
  start_day: 1,
  end_month: 5,
  end_day: 31,
  is_active: true,
  sort_order: 0,
  iconFile: null,
  clearIcon: false,
});

const MONTH_NUMS = Array.from({ length: 12 }, (_, i) => i + 1);

function monthName(m: number): string {
  return (
    [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][m - 1] || String(m)
  );
}

export function SeasonalParticlesPanel({
  getClient,
}: {
  getClient: () => PbClient;
}) {
  const [rows, setRows] = useState<PbSeasonalParticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const triggerSeason = useSeasonalFxStore((s) => s.triggerSeason);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getClient()
        .collection("seasonal_particles")
        .getFullList<PbSeasonalParticle>({
          sort: "sort_order,start_month,start_day",
        });
      setRows(list);
      setSeasonalParticleRules(list.filter((r) => r.is_active !== false));
    } catch (e) {
      setError(
        formatPbError(e) ||
          "Could not load seasonal_particles. Run PocketBase migrations."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      fd.set("season", editing.season);
      fd.set("label", editing.label.trim() || editing.season);
      fd.set("start_month", String(editing.start_month));
      fd.set("start_day", String(editing.start_day));
      fd.set("end_month", String(editing.end_month));
      fd.set("end_day", String(editing.end_day));
      fd.set("is_active", editing.is_active ? "true" : "false");
      fd.set("sort_order", String(editing.sort_order || 0));
      if (editing.iconFile) {
        fd.set("icon", editing.iconFile);
      } else if (editing.clearIcon && editing.id) {
        fd.set("icon", "");
      }

      if (editing.id) {
        await pb.collection("seasonal_particles").update(editing.id, fd);
      } else {
        await pb.collection("seasonal_particles").create(fd);
      }
      setMsg("Particle season saved.");
      setEditing(null);
      await load();
    } catch (e) {
      setError(formatPbError(e) || "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this particle season window?")) return;
    try {
      await getClient().collection("seasonal_particles").delete(id);
      setMsg("Deleted.");
      await load();
    } catch (e) {
      setError(formatPbError(e) || "Delete failed.");
    }
  };

  const preview = (row: PbSeasonalParticle) => {
    const icon =
      row.icon &&
      pbFileUrl(row.collectionId || "seasonal_particles", row.id, row.icon);
    triggerSeason(row.season, {
      badge: row.label,
      iconUrl: icon || null,
    });
  };

  const startEdit = (row: PbSeasonalParticle) => {
    setEditing({
      id: row.id,
      season: row.season,
      label: row.label || "",
      start_month: Number(row.start_month) || 1,
      start_day: Number(row.start_day) || 1,
      end_month: Number(row.end_month) || 12,
      end_day: Number(row.end_day) || 31,
      is_active: row.is_active !== false,
      sort_order: Number(row.sort_order) || 0,
      iconFile: null,
      clearIcon: false,
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Particle Seasons</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Date windows that trigger sakura / snow / momiji ambient FX when
            guests pick travel dates. Optional custom glyph per season.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(emptyDraft())}
          className="rounded-full bg-[#075473] px-4 py-2 text-sm font-semibold text-zinc-100"
        >
          + Add particle window
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-[#F6A724]/30 bg-[#F6A724]/10 px-4 py-3 text-xs leading-relaxed text-zinc-200">
        <p className="font-semibold uppercase tracking-wider text-[#F6A724]">
          Icon size before upload
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-zinc-300">
          <li>{PARTICLE_ICON_SPECS.preferred}</li>
          <li>{PARTICLE_ICON_SPECS.canvas}</li>
          <li>{PARTICLE_ICON_SPECS.safe}</li>
          <li>{PARTICLE_ICON_SPECS.maxSvg}</li>
          <li>{PARTICLE_ICON_SPECS.maxPng}</li>
        </ul>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {msg ? <p className="mb-3 text-sm text-emerald-400">{msg}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading seasonal_particles…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No particle windows yet. Click + Add, or restart PocketBase so the
          migration seeds sakura / snow / momiji.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                <th className="pb-2 font-medium">Season</th>
                <th className="pb-2 font-medium">Window</th>
                <th className="pb-2 font-medium">Badge</th>
                <th className="pb-2 font-medium">Icon</th>
                <th className="pb-2 font-medium">Active</th>
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const icon =
                  row.icon &&
                  pbFileUrl(
                    row.collectionId || "seasonal_particles",
                    row.id,
                    row.icon
                  );
                return (
                  <tr key={row.id} className="border-b border-zinc-800/80">
                    <td className="py-3 font-semibold capitalize text-white">
                      {row.season}
                    </td>
                    <td className="py-3 text-zinc-300">
                      {monthName(row.start_month)} {row.start_day} →{" "}
                      {monthName(row.end_month)} {row.end_day}
                    </td>
                    <td className="max-w-[12rem] truncate py-3 text-zinc-400">
                      {row.label}
                    </td>
                    <td className="py-3">
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={icon}
                          alt=""
                          className="h-8 w-8 rounded object-contain bg-black/40"
                        />
                      ) : (
                        <span className="text-xs text-zinc-500">Default</span>
                      )}
                    </td>
                    <td className="py-3 text-zinc-400">
                      {row.is_active === false ? "Off" : "On"}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => preview(row)}
                          className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(row.id)}
                          className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <div className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-950/80 p-4">
          <h3 className="font-display text-lg text-white">
            {editing.id ? "Edit particle window" : "Add particle window"}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Season
              <select
                value={editing.season}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    season: e.target.value as Draft["season"],
                  })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {PARTICLE_SEASON_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Badge label
              <input
                value={editing.label}
                onChange={(e) =>
                  setEditing({ ...editing, label: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Start month
              <select
                value={editing.start_month}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    start_month: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {MONTH_NUMS.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Start day
              <input
                type="number"
                min={1}
                max={31}
                value={editing.start_day}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    start_day: Number(e.target.value) || 1,
                  })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              End month
              <select
                value={editing.end_month}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    end_month: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {MONTH_NUMS.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              End day
              <input
                type="number"
                min={1}
                max={31}
                value={editing.end_day}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    end_day: Number(e.target.value) || 1,
                  })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Sort order
              <input
                type="number"
                value={editing.sort_order}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    sort_order: Number(e.target.value) || 0,
                  })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) =>
                  setEditing({ ...editing, is_active: e.target.checked })
                }
              />
              Active
            </label>
            <label className="block text-xs text-zinc-400 sm:col-span-2">
              Custom icon (optional — see size rules above)
              <input
                type="file"
                accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
                className="mt-1 block w-full text-sm text-zinc-300"
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    iconFile: e.target.files?.[0] ?? null,
                    clearIcon: false,
                  })
                }
              />
            </label>
            {editing.id ? (
              <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editing.clearIcon}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      clearIcon: e.target.checked,
                      iconFile: e.target.checked ? null : editing.iconFile,
                    })
                  }
                />
                Remove current icon (use built-in glyph)
              </label>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-full bg-[#075473] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
