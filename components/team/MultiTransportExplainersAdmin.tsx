"use client";

import type PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  featureExplainerThumbnailUrl,
  pbFileUrl,
  type PbFeatureExplainer,
} from "@/lib/pocketbase/client";

type Draft = {
  title: string;
  description: string;
  mediaFile: File | null;
  thumbFile: File | null;
  mediaPreview: string;
  thumbPreview: string;
};

const MULTI_KEYS = ["public_transport", "private_chauffeur"] as const;

const FALLBACK_COPY: Record<
  (typeof MULTI_KEYS)[number],
  { title: string; description: string }
> = {
  public_transport: {
    title: "Public Transport",
    description:
      "Complex subway systems, walking between stations — best for light travel days.",
  },
  private_chauffeur: {
    title: "Private Chauffeur",
    description:
      "Door-to-door luxury with luggage handled and direct point-to-point service.",
  },
};

function mediaUrl(row: PbFeatureExplainer): string {
  const file = row.media_file || "";
  if (!file) return "";
  return pbFileUrl(
    String(row.collectionId ?? "feature_explainers"),
    row.id,
    file
  );
}

function draftFromRow(row: PbFeatureExplainer): Draft {
  const key = String(row.feature_key || "") as (typeof MULTI_KEYS)[number];
  const fb = FALLBACK_COPY[key];
  return {
    title: row.title || fb?.title || "",
    description: row.description || fb?.description || "",
    mediaFile: null,
    thumbFile: null,
    mediaPreview: mediaUrl(row),
    thumbPreview: featureExplainerThumbnailUrl(row),
  };
}

/** Multi-city in-city explainer pages (feature_explainers). */
export function MultiTransportExplainersAdmin({
  getClient,
}: {
  getClient: () => PocketBase;
}) {
  const [rows, setRows] = useState<PbFeatureExplainer[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      let list = await pb
        .collection("feature_explainers")
        .getFullList<PbFeatureExplainer>({ requestKey: null });

      const byKey = new Map(
        list.map((r) => [String(r.feature_key || ""), r])
      );
      for (const key of MULTI_KEYS) {
        if (byKey.has(key)) continue;
        const fb = FALLBACK_COPY[key];
        const created = (await pb.collection("feature_explainers").create({
          feature_key: key,
          title: fb.title,
          description: fb.description,
          media_type: "Image",
        })) as unknown as PbFeatureExplainer;
        list = [...list, created];
        byKey.set(key, created);
      }

      const ordered = MULTI_KEYS.map((k) => byKey.get(k)!).filter(Boolean);
      setRows(ordered);
      const next: Record<string, Draft> = {};
      for (const row of ordered) next[row.id] = draftFromRow(row);
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
  }, []);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const saveRow = async (row: PbFeatureExplainer) => {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingId(row.id);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      fd.append("title", draft.title);
      fd.append("description", draft.description);
      if (draft.mediaFile) {
        fd.append("media_file", draft.mediaFile);
        const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(draft.mediaFile.name);
        fd.append("media_type", isVideo ? "Video" : "Image");
      }
      if (draft.thumbFile) fd.append("thumbnail_image", draft.thumbFile);

      const saved = (await pb
        .collection("feature_explainers")
        .update(row.id, fd)) as unknown as PbFeatureExplainer;

      setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setDrafts((prev) => ({
        ...prev,
        [saved.id]: draftFromRow(saved),
      }));
      setMsg(`Saved "${saved.feature_key}".`);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div>
        <h3 className="font-display text-lg text-zinc-100">
          Multi-city · In-city explainers
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Detail pages opened from City Transport (Public / Private). Title,
          body, and media.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading explainers…</p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row) => {
          const draft = drafts[row.id];
          if (!draft) return null;
          return (
            <article
              key={row.id}
              className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#F6A724]">
                {String(row.feature_key || "").replace(/_/g, " ")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                  {draft.thumbPreview || draft.mediaPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.thumbPreview || draft.mediaPreview}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-xs text-zinc-600">
                      No thumb
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                    Thumbnail
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-1 block w-full text-xs text-zinc-400"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        updateDraft(row.id, {
                          thumbFile: f,
                          thumbPreview: f
                            ? URL.createObjectURL(f)
                            : draft.thumbPreview,
                        });
                      }}
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                    Media (image / video)
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="mt-1 block w-full text-xs text-zinc-400"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        updateDraft(row.id, {
                          mediaFile: f,
                          mediaPreview: f
                            ? URL.createObjectURL(f)
                            : draft.mediaPreview,
                        });
                      }}
                    />
                  </label>
                </div>
              </div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                Title
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) =>
                    updateDraft(row.id, { title: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                Explanation body
                <textarea
                  rows={6}
                  value={draft.description}
                  onChange={(e) =>
                    updateDraft(row.id, { description: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm leading-relaxed text-white"
                />
              </label>
              <button
                type="button"
                disabled={savingId === row.id}
                onClick={() => void saveRow(row)}
                className="w-full rounded-lg bg-[#F6A724] py-2 text-xs font-semibold text-[#0A1017] disabled:opacity-50"
              >
                {savingId === row.id ? "Saving…" : "Save explainer"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
