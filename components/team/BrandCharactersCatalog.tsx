"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BrandCharacterCategory } from "@/lib/brandCharacters";

type CharacterRow = {
  id: string;
  label: string;
  path: string;
  category: BrandCharacterCategory;
  usedOn: string[];
  exists: boolean;
  bytes: number | null;
  bytesLabel: string;
  width: number | null;
  height: number | null;
  format: string | null;
  mtime: string | null;
  status: "ok" | "heavy" | "missing";
  currentLabel: string;
  optimalLabel: string;
  optimal: { maxEdgePx: number; maxKb: number; formatHint: string };
};

type Summary = { total: number; heavy: number; missing: number; ok: number };

const CATEGORY_LABEL: Record<BrandCharacterCategory, string> = {
  pre_elite: "Pre-Elite",
  builder_timeline: "Timeline",
  itinerary: "Itinerary",
  system: "System",
  guest_party: "Guest party",
  season: "Season",
  hero: "Heroes",
};

/**
 * Team Access — character / hero asset catalog with current vs optimal weight.
 */
export function BrandCharactersCatalog({
  categoryFilter,
}: {
  /** If set, only show this category (e.g. heroes tab). */
  categoryFilter?: BrandCharacterCategory | BrandCharacterCategory[];
}) {
  const [items, setItems] = useState<CharacterRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | BrandCharacterCategory>("all");
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [bust, setBust] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/brand-characters", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.items || []);
      setSummary(data.summary || null);
      setBust(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 3200);
    return () => window.clearTimeout(t);
  }, [msg]);

  const lockedFilter = useMemo(() => {
    if (!categoryFilter) return null;
    return Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
  }, [categoryFilter]);

  const visible = useMemo(() => {
    let list = items;
    if (lockedFilter) {
      list = list.filter((i) => lockedFilter.includes(i.category));
    } else if (filter !== "all") {
      list = list.filter((i) => i.category === filter);
    }
    return list;
  }, [items, filter, lockedFilter]);

  const onReplace = async (id: string, file: File | null) => {
    if (!file) return;
    setReplacingId(id);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("file", file);
      const res = await fetch("/api/admin/brand-characters", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Replace failed");
      if (data.item) {
        setItems((prev) =>
          prev.map((row) => (row.id === id ? { ...row, ...data.item } : row))
        );
      } else {
        await load();
      }
      setBust(Date.now());
      setMsg(`Saved ${id} — refresh live pages to see the new file.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replace failed");
    } finally {
      setReplacingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-white sm:text-3xl">
          {lockedFilter?.includes("hero") && lockedFilter.length === 1
            ? "Hero assets"
            : "Characters"}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Characters ship as <span className="text-emerald-400">WebP</span> for
          fast VPS loads. Upload PNG/JPG — the server converts to WebP (q90 ·
          max edge from Optimal). Current row shows format so you can verify.
        </p>
        {summary ? (
          <p className="mt-2 text-xs text-zinc-500">
            {summary.ok} ok ·{" "}
            <span className="text-amber-400">{summary.heavy} heavy</span> ·{" "}
            {summary.missing} missing · {summary.total} total
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

      {!lockedFilter ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
          />
          {(Object.keys(CATEGORY_LABEL) as BrandCharacterCategory[]).map(
            (c) => (
              <FilterChip
                key={c}
                active={filter === c}
                onClick={() => setFilter(c)}
                label={CATEGORY_LABEL[c]}
              />
            )
          )}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading assets…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((row) => (
            <article
              key={row.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60"
            >
              <div className="relative flex h-40 items-end justify-center bg-zinc-950/80 p-3">
                {row.exists ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${row.path}?v=${bust}`}
                    alt=""
                    className="max-h-full max-w-full object-contain drop-shadow-lg"
                  />
                ) : (
                  <p className="text-sm text-zinc-600">File missing</p>
                )}
                <StatusPill status={row.status} />
                {row.format ? (
                  <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-emerald-300">
                    {row.format}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div>
                  <h3 className="font-semibold text-zinc-100">{row.label}</h3>
                  <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">
                    {CATEGORY_LABEL[row.category]} · {row.id}
                  </p>
                </div>
                <p className="text-xs text-zinc-400">
                  {row.usedOn.join(" · ")}
                </p>
                <dl className="mt-1 space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                  <div>
                    <dt className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
                      Current
                    </dt>
                    <dd
                      className={
                        row.status === "heavy"
                          ? "font-medium text-amber-300"
                          : row.status === "missing"
                            ? "text-red-300"
                            : "text-zinc-200"
                      }
                    >
                      {row.currentLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
                      Optimal
                    </dt>
                    <dd className="text-[#6ee7b7]">{row.optimalLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">
                      Path
                    </dt>
                    <dd className="break-all font-mono text-[0.65rem] text-zinc-400">
                      {row.path}
                    </dd>
                  </div>
                </dl>
                <label className="mt-auto block pt-2">
                  <span className="sr-only">Replace {row.label}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={replacingId === row.id}
                    className="block w-full text-xs text-zinc-300 file:mr-2 file:rounded-lg file:border-0 file:bg-[#075473] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      void onReplace(row.id, f);
                    }}
                  />
                  {replacingId === row.id ? (
                    <p className="mt-1 text-[0.65rem] text-zinc-500">
                      Saving…
                    </p>
                  ) : (
                    <p className="mt-1 text-[0.65rem] text-zinc-500">
                      PNG/JPG → auto WebP · keeps {row.path.split("/").pop()}
                    </p>
                  )}
                </label>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-[#075473] bg-[#075473]/25 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#7dd3fc]"
          : "rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-zinc-400 hover:border-zinc-500"
      }
    >
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: "ok" | "heavy" | "missing" }) {
  const label =
    status === "ok" ? "OK" : status === "heavy" ? "Heavy" : "Missing";
  const cls =
    status === "ok"
      ? "bg-emerald-500/90 text-white"
      : status === "heavy"
        ? "bg-amber-500 text-zinc-950"
        : "bg-red-600 text-white";
  return (
    <span
      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
