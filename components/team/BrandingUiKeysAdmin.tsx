"use client";

import type PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  BRANDING_UI_FALLBACKS,
  isVideoFilename,
  type BrandingUiFallback,
} from "@/lib/brandingUi";
import {
  brandingUiMediaUrl,
  brandingUiPosterUrl,
  type PbBrandingUiItem,
} from "@/lib/pocketbase/client";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

type PbClient = PocketBase;

export type BrandingKeyFieldMode = "card" | "explanation" | "full";

type Draft = {
  title: string;
  subtitle: string;
  description: string;
  file: File | null;
  posterFile: File | null;
  preview: string;
  posterPreview: string;
};

function draftFromRow(row: PbBrandingUiItem): Draft {
  const fb = BRANDING_UI_FALLBACKS[row.key];
  const media = brandingUiMediaUrl(row) || fb?.mediaFallback || "";
  const poster = brandingUiPosterUrl(row) || "";
  return {
    title: row.title || fb?.title || "",
    subtitle: row.subtitle || fb?.subtitle || "",
    description: row.description || fb?.description || "",
    file: null,
    posterFile: null,
    preview: media,
    posterPreview: poster,
  };
}

async function ensureKey(
  pb: PbClient,
  key: string,
  existing: Map<string, PbBrandingUiItem>
): Promise<PbBrandingUiItem> {
  const found = existing.get(key);
  if (found) return found;
  const fb: BrandingUiFallback | undefined = BRANDING_UI_FALLBACKS[key];
  const created = (await pb.collection("branding_ui_items").create({
    key,
    category: fb?.category || "builder",
    title: fb?.title || key,
    subtitle: fb?.subtitle || "",
    description: fb?.description || "",
    sort_order: fb?.sortOrder ?? 99,
    cta_primary: fb?.ctaPrimary || "",
    cta_secondary: fb?.ctaSecondary || "",
  })) as unknown as PbBrandingUiItem;
  existing.set(key, created);
  return created;
}

/**
 * Focused editor for a fixed list of `branding_ui_items` keys.
 * Used by Site Branding Transport / Pace / Explanations tabs.
 */
export function BrandingUiKeysAdmin({
  getClient,
  keys,
  title,
  description,
  fieldMode = "full",
  accent = "#075473",
}: {
  getClient: () => PbClient;
  keys: readonly string[];
  title: string;
  description?: string;
  fieldMode?: BrandingKeyFieldMode;
  accent?: string;
}) {
  const [rows, setRows] = useState<PbBrandingUiItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showCard =
    fieldMode === "card" || fieldMode === "full";
  const showExplanation =
    fieldMode === "explanation" || fieldMode === "full";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const list = await pb
        .collection("branding_ui_items")
        .getFullList<PbBrandingUiItem>({ sort: "sort_order,key" });
      const byKey = new Map(list.map((r) => [r.key, r]));
      const ensured: PbBrandingUiItem[] = [];
      for (const key of keys) {
        ensured.push(await ensureKey(pb, key, byKey));
      }
      setRows(ensured);
      const next: Record<string, Draft> = {};
      for (const row of ensured) next[row.id] = draftFromRow(row);
      setDrafts(next);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join("|")]);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const saveRow = async (row: PbBrandingUiItem) => {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingKey(row.key);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      fd.append("title", draft.title);
      fd.append("subtitle", draft.subtitle);
      if (showExplanation) {
        fd.append("description", draft.description);
      }
      if (showCard) {
        if (draft.file) fd.append("media", draft.file);
        if (draft.posterFile) fd.append("poster", draft.posterFile);
      }

      const saved = (await pb
        .collection("branding_ui_items")
        .update(row.id, fd)) as unknown as PbBrandingUiItem;

      setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setDrafts((prev) => ({
        ...prev,
        [saved.id]: draftFromRow(saved),
      }));
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });
      setMsg(`Saved “${saved.key}”.`);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div>
        <h3 className="font-display text-lg text-zinc-100">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

      <div
        className={`grid gap-4 ${
          fieldMode === "explanation"
            ? "lg:grid-cols-1"
            : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {rows.map((row) => {
          const draft = drafts[row.id];
          if (!draft) return null;
          const fb = BRANDING_UI_FALLBACKS[row.key];
          const previewIsVideo =
            (draft.file && isVideoFilename(draft.file.name)) ||
            isVideoFilename(draft.preview);

          return (
            <article
              key={row.id}
              className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: accent }}
              >
                {row.key.replace(/_/g, " ")}
              </p>

              {showCard ? (
                <>
                  <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                    {draft.preview ? (
                      previewIsVideo ? (
                        <video
                          src={draft.preview}
                          poster={draft.posterPreview || undefined}
                          className="aspect-[3/4] w-full object-cover"
                          muted
                          playsInline
                          controls
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={draft.preview}
                          alt=""
                          className="aspect-[3/4] w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center text-xs text-zinc-600">
                        {fb?.mediaFallback
                          ? `Fallback: ${fb.mediaFallback}`
                          : "No image"}
                      </div>
                    )}
                  </div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                    Photo / video
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm,video/quicktime,.m4v"
                      className="mt-1 block w-full text-xs text-zinc-400"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        updateDraft(row.id, {
                          file: f,
                          preview: f
                            ? URL.createObjectURL(f)
                            : draftFromRow(row).preview,
                        });
                      }}
                    />
                  </label>
                  {previewIsVideo ? (
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                      Poster image
                      <input
                        type="file"
                        accept="image/*"
                        className="mt-1 block w-full text-xs text-zinc-400"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          updateDraft(row.id, {
                            posterFile: f,
                            posterPreview: f
                              ? URL.createObjectURL(f)
                              : draft.posterPreview,
                          });
                        }}
                      />
                    </label>
                  ) : null}
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                    Title
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) =>
                        updateDraft(row.id, { title: e.target.value })
                      }
                      placeholder={fb?.title}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                    Subtitle on card
                    <input
                      type="text"
                      value={draft.subtitle}
                      onChange={(e) =>
                        updateDraft(row.id, { subtitle: e.target.value })
                      }
                      placeholder={fb?.subtitle}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-white"
                    />
                  </label>
                </>
              ) : null}

              {showExplanation ? (
                <>
                  {fieldMode === "explanation" ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2">
                      <p className="font-display text-base text-white">
                        {draft.title || fb?.title || row.key}
                      </p>
                      {draft.subtitle || fb?.subtitle ? (
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {draft.subtitle || fb?.subtitle}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                    Explanation (detail page)
                    <textarea
                      rows={fieldMode === "explanation" ? 8 : 5}
                      value={draft.description}
                      onChange={(e) =>
                        updateDraft(row.id, { description: e.target.value })
                      }
                      placeholder={fb?.description}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm leading-relaxed text-white"
                    />
                  </label>
                </>
              ) : null}

              <button
                type="button"
                disabled={savingKey === row.key}
                onClick={() => void saveRow(row)}
                className="w-full rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {savingKey === row.key ? "Saving…" : "Save"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
