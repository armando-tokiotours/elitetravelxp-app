"use client";

import type PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  brandingUiIconUrl,
  type PbBrandingUiItem,
} from "@/lib/pocketbase/client";
import {
  BRANDING_ICON_ACCEPT,
  BRANDING_ICON_DEFS,
  BRANDING_ICON_GROUPS,
  validateBrandingIconFile,
  type BrandingIconDef,
} from "@/lib/brandingIcons";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

type PbClient = PocketBase;

/**
 * Site Branding → ICONS (CARD BACKGROUNDS).
 * Storage: `icon` file field on the existing `branding_ui_items` row for
 * each key (`pre_elite_*` / `pace_*`) — see lib/brandingIcons.ts.
 * Uploads are full card-background cover photos for the Travel Brief /
 * Pre-Builder widgets (rendered `object-cover` via SplitImageBackground).
 */
export function SiteBrandingIcons({ getClient }: { getClient: () => PbClient }) {
  const [rowsByKey, setRowsByKey] = useState<Record<string, PbBrandingUiItem>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Optimistic local previews keyed by brandingKey (object URL or "").
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const pb = getClient();
      const list = await pb
        .collection("branding_ui_items")
        .getFullList<PbBrandingUiItem>({ sort: "sort_order,key" });
      const byKey = new Map(list.map((r) => [r.key, r]));
      // Ensure a row exists for every managed icon (same ensure-pattern
      // as BrandingUiKeysAdmin) so uploads always have a home.
      for (const def of BRANDING_ICON_DEFS) {
        if (!byKey.has(def.brandingKey)) {
          const created = (await pb.collection("branding_ui_items").create({
            key: def.brandingKey,
            category: def.brandingKey.startsWith("pace_") ? "pace" : "pre_elite",
            title: def.label,
            subtitle: "",
            sort_order: 99,
          })) as unknown as PbBrandingUiItem;
          byKey.set(def.brandingKey, created);
        }
      }
      setRowsByKey(Object.fromEntries(byKey));
      setPreviews({});
    } catch (e) {
      setLoadError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconUrlFor = (def: BrandingIconDef): string =>
    previews[def.brandingKey] ??
    brandingUiIconUrl(rowsByKey[def.brandingKey]);

  const replaceIcon = async (def: BrandingIconDef, file: File | null) => {
    if (!file) return;
    const invalid = validateBrandingIconFile(file);
    if (invalid) {
      setErrors((p) => ({ ...p, [def.brandingKey]: invalid }));
      return;
    }
    const row = rowsByKey[def.brandingKey];
    if (!row) return;
    setErrors((p) => ({ ...p, [def.brandingKey]: "" }));
    setMsg(null);
    setBusyKey(def.brandingKey);
    const objectUrl = URL.createObjectURL(file);
    setPreviews((p) => ({ ...p, [def.brandingKey]: objectUrl }));
    try {
      const fd = new FormData();
      fd.append("icon", file);
      const saved = (await getClient()
        .collection("branding_ui_items")
        .update(row.id, fd)) as unknown as PbBrandingUiItem;
      setRowsByKey((p) => ({ ...p, [def.brandingKey]: saved }));
      setPreviews((p) => ({
        ...p,
        [def.brandingKey]: brandingUiIconUrl(saved),
      }));
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });
      setMsg(`Background saved for ${def.context}. Travel Brief picks it up on next load.`);
    } catch (e) {
      setPreviews((p) => {
        const next = { ...p };
        delete next[def.brandingKey];
        return next;
      });
      setErrors((p) => ({ ...p, [def.brandingKey]: formatPbError(e) }));
    } finally {
      URL.revokeObjectURL(objectUrl);
      setBusyKey(null);
    }
  };

  const removeIcon = async (def: BrandingIconDef) => {
    const row = rowsByKey[def.brandingKey];
    if (!row) return;
    setBusyKey(def.brandingKey);
    setErrors((p) => ({ ...p, [def.brandingKey]: "" }));
    try {
      const saved = (await getClient()
        .collection("branding_ui_items")
        .update(row.id, { icon: null })) as unknown as PbBrandingUiItem;
      setRowsByKey((p) => ({ ...p, [def.brandingKey]: saved }));
      setPreviews((p) => {
        const next = { ...p };
        delete next[def.brandingKey];
        return next;
      });
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });
      setMsg(`Background removed for ${def.context} — emoji fallback restored.`);
    } catch (e) {
      setErrors((p) => ({ ...p, [def.brandingKey]: formatPbError(e) }));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
        <h2 className="font-display text-2xl text-zinc-100">CARD BACKGROUNDS</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Background cover photos for the Travel Brief / Pre-Builder widgets.
          Each uploaded photo fills its widget card as a full background cover;
          with no upload, the emoji fallback stays in place.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold tracking-wider text-[#F6A724] uppercase">
          <span className="rounded-full border border-[#F6A724]/40 bg-[#F6A724]/10 px-3 py-1.5">
            Format: JPG or WebP
          </span>
          <span className="rounded-full border border-[#F6A724]/40 bg-[#F6A724]/10 px-3 py-1.5">
            Size: 800×400px (2:1 landscape)
          </span>
          <span className="rounded-full border border-[#F6A724]/40 bg-[#F6A724]/10 px-3 py-1.5">
            Max: 300KB
          </span>
        </div>
        {loadError ? <p className="mt-3 text-sm text-red-400">{loadError}</p> : null}
        {msg ? <p className="mt-3 text-sm text-emerald-400">{msg}</p> : null}
        {loading ? <p className="mt-3 text-sm text-zinc-500">Loading backgrounds…</p> : null}
      </div>

      {BRANDING_ICON_GROUPS.map((group) => (
        <section
          key={group}
          className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"
        >
          <h3 className="text-xs font-bold tracking-[0.18em] text-[#F6A724] uppercase">
            {group}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BRANDING_ICON_DEFS.filter((d) => d.group === group).map((def) => {
              const url = iconUrlFor(def);
              const busy = busyKey === def.brandingKey;
              const err = errors[def.brandingKey];
              return (
                <article
                  key={def.brandingKey}
                  className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex aspect-[2/1] w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-3xl leading-none" aria-hidden>
                          {def.emoji}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold break-words text-zinc-100">
                        {def.label}
                      </p>
                      <p className="text-xs text-zinc-500">{def.context}</p>
                      <p className="mt-1 font-mono text-[10px] break-all text-zinc-600">
                        {def.brandingKey}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {url
                      ? "Uploaded background in use — shown as the full card cover."
                      : `No uploaded background — emoji fallback (${def.emoji}) is currently used in the Travel Brief.`}
                  </p>
                  <label className="block text-[10px] tracking-wider text-zinc-500 uppercase">
                    Replace background
                    <input
                      type="file"
                      accept={BRANDING_ICON_ACCEPT}
                      disabled={busy}
                      className="mt-1 block w-full text-xs text-zinc-400 disabled:opacity-50"
                      onChange={(e) => {
                        void replaceIcon(def, e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {busy ? (
                    <p className="text-[11px] text-[#F6A724]">Saving…</p>
                  ) : null}
                  {err ? (
                    <p className="text-[11px] text-red-400" role="alert">
                      {err}
                    </p>
                  ) : null}
                  {url ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeIcon(def)}
                      className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase hover:text-white disabled:opacity-50"
                    >
                      Remove (restore emoji)
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
