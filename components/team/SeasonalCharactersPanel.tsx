"use client";

import type PocketBase from "pocketbase";
import { useCallback, useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  pbFileUrl,
  type ClimateSeasonKey,
  type PbSeasonalCharacter,
} from "@/lib/pocketbase/client";
import {
  CLIMATE_MASCOT_SPECS,
  CLIMATE_SEASON_OPTIONS,
  DEFAULT_CLIMATE_MASCOTS,
  setSeasonalCharacterRules,
} from "@/lib/seasonality";

type PbClient = PocketBase;

type Draft = {
  id?: string;
  key: ClimateSeasonKey;
  label: string;
  start_month: number | "";
  start_day: number | "";
  end_month: number | "";
  end_day: number | "";
  is_active: boolean;
  sort_order: number;
  mascotFile: File | null;
  clearMascot: boolean;
};

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

function emptyDraft(key: ClimateSeasonKey = "default"): Draft {
  const opt = CLIMATE_SEASON_OPTIONS.find((o) => o.id === key);
  return {
    key,
    label: opt?.label || key,
    start_month: key === "default" ? "" : 1,
    start_day: key === "default" ? "" : 1,
    end_month: key === "default" ? "" : 12,
    end_day: key === "default" ? "" : 31,
    is_active: true,
    sort_order: 0,
    mascotFile: null,
    clearMascot: false,
  };
}

export function SeasonalCharactersPanel({
  getClient,
}: {
  getClient: () => PbClient;
}) {
  const [rows, setRows] = useState<PbSeasonalCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getClient()
        .collection("seasonal_characters")
        .getFullList<PbSeasonalCharacter>({ sort: "sort_order,key" });
      setRows(list);
      setSeasonalCharacterRules(list.filter((r) => r.is_active !== false));
    } catch (e) {
      setError(
        formatPbError(e) ||
          "Could not load seasonal_characters. Restart PocketBase for migrations."
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
      fd.set("key", editing.key);
      fd.set("label", editing.label.trim() || editing.key);
      fd.set("is_active", editing.is_active ? "true" : "false");
      fd.set("sort_order", String(editing.sort_order || 0));
      if (editing.key === "default") {
        fd.set("start_month", "");
        fd.set("start_day", "");
        fd.set("end_month", "");
        fd.set("end_day", "");
      } else {
        fd.set("start_month", String(editing.start_month || 1));
        fd.set("start_day", String(editing.start_day || 1));
        fd.set("end_month", String(editing.end_month || 12));
        fd.set("end_day", String(editing.end_day || 31));
      }
      if (editing.mascotFile) {
        fd.set("mascot", editing.mascotFile);
      } else if (editing.clearMascot && editing.id) {
        fd.set("mascot", "");
      }

      if (editing.id) {
        await pb.collection("seasonal_characters").update(editing.id, fd);
      } else {
        await pb.collection("seasonal_characters").create(fd);
      }
      setMsg("Character saved.");
      setEditing(null);
      await load();
    } catch (e) {
      setError(formatPbError(e) || "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this season character?")) return;
    try {
      await getClient().collection("seasonal_characters").delete(id);
      setMsg("Deleted.");
      await load();
    } catch (e) {
      setError(formatPbError(e) || "Delete failed.");
    }
  };

  const startEdit = (row: PbSeasonalCharacter) => {
    setEditing({
      id: row.id,
      key: row.key,
      label: row.label || "",
      start_month: row.start_month ?? "",
      start_day: row.start_day ?? "",
      end_month: row.end_month ?? "",
      end_day: row.end_day ?? "",
      is_active: row.is_active !== false,
      sort_order: Number(row.sort_order) || 0,
      mascotFile: null,
      clearMascot: false,
    });
  };

  const previewUrl = (row: PbSeasonalCharacter) => {
    if (row.mascot) {
      return (
        pbFileUrl(
          row.collectionId || "seasonal_characters",
          row.id,
          row.mascot
        ) || DEFAULT_CLIMATE_MASCOTS[row.key]
      );
    }
    return DEFAULT_CLIMATE_MASCOTS[row.key];
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Season Characters</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Mascots on the Seasonality card (single + multi-day). Default shows
            when no date is set or no window matches.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(emptyDraft("winter"))}
          className="rounded-full bg-[#075473] px-4 py-2 text-sm font-semibold text-zinc-100"
        >
          + Add character
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-[#F6A724]/30 bg-[#F6A724]/10 px-4 py-3 text-xs leading-relaxed text-zinc-200">
        <p className="font-semibold uppercase tracking-wider text-[#F6A724]">
          Mascot upload tips
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-zinc-300">
          <li>{CLIMATE_MASCOT_SPECS.preferred}</li>
          <li>{CLIMATE_MASCOT_SPECS.canvas}</li>
          <li>{CLIMATE_MASCOT_SPECS.size}</li>
          <li>{CLIMATE_MASCOT_SPECS.maxFile}</li>
        </ul>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {msg ? <p className="mb-3 text-sm text-emerald-400">{msg}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading seasonal_characters…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No characters yet. Restart PocketBase so the migration seeds default /
          winter / summer / rain.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => {
            const src = previewUrl(row);
            return (
              <div
                key={row.id}
                className="relative overflow-visible rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 pt-12"
              >
                <div className="pointer-events-none absolute -top-2 right-3 z-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="h-24 w-auto object-contain drop-shadow-lg"
                  />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1BA58A]">
                  {row.key}
                </p>
                <p className="mt-1 font-semibold text-white">{row.label}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {row.key === "default"
                    ? "Fallback when season is not fixed"
                    : `${monthName(Number(row.start_month) || 1)} ${row.start_day || 1} → ${monthName(Number(row.end_month) || 12)} ${row.end_day || 31}`}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {row.mascot ? "Custom upload" : "Bundled default"} ·{" "}
                  {row.is_active === false ? "Off" : "On"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <div className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-950/80 p-4">
          <h3 className="font-display text-lg text-white">
            {editing.id ? "Edit character" : "Add character"}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Season key
              <select
                value={editing.key}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    key: e.target.value as ClimateSeasonKey,
                  })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              >
                {CLIMATE_SEASON_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-zinc-400">
              Label
              <input
                value={editing.label}
                onChange={(e) =>
                  setEditing({ ...editing, label: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </label>
            {editing.key !== "default" ? (
              <>
                <label className="block text-xs text-zinc-400">
                  Start month
                  <select
                    value={editing.start_month || 1}
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
                    value={editing.start_day || 1}
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
                    value={editing.end_month || 12}
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
                    value={editing.end_day || 31}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        end_day: Number(e.target.value) || 31,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                  />
                </label>
              </>
            ) : null}
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
              Mascot image (optional — uses bundled default if empty)
              <input
                type="file"
                accept=".png,.webp,.svg,.jpg,.jpeg,image/*"
                className="mt-1 block w-full text-sm text-zinc-300"
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    mascotFile: e.target.files?.[0] ?? null,
                    clearMascot: false,
                  })
                }
              />
            </label>
            {editing.id ? (
              <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={editing.clearMascot}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      clearMascot: e.target.checked,
                      mascotFile: e.target.checked ? null : editing.mascotFile,
                    })
                  }
                />
                Remove upload (use bundled default)
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
