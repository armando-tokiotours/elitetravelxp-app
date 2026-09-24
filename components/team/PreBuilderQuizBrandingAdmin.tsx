"use client";

import type PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { isVideoFilename } from "@/lib/brandingUi";
import {
  brandingUiMediaUrl,
  brandingUiPosterUrl,
  type PbBrandingUiItem,
} from "@/lib/pocketbase/client";
import {
  PRE_ELITE_BRANDING_CATEGORY,
  PRE_ELITE_QUIZ_SECTIONS,
  preEliteBrandingKey,
  writePreEliteQuizLocalEntry,
  type PreEliteQuizSectionId,
} from "@/lib/preEliteBranding";
import { getStoryExplanation } from "@/lib/preEliteStories";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

type PbClient = PocketBase;

type OptionDraft = {
  recordId: string | null;
  title: string;
  subtitle: string;
  slide1Title: string;
  slide1Caption: string;
  slide2Title: string;
  slide2Caption: string;
  mediaFile: File | null;
  posterFile: File | null;
  mediaPreview: string;
  posterPreview: string;
};

function emptyDraft(optionId: string, title: string, description: string): OptionDraft {
  const story = getStoryExplanation(optionId);
  const s1 = story?.slides[0];
  const s2 = story?.slides[1];
  return {
    recordId: null,
    title,
    subtitle: description,
    slide1Title: s1?.title || "",
    slide1Caption: s1?.caption || "",
    slide2Title: s2?.title || "",
    slide2Caption: s2?.caption || "",
    mediaFile: null,
    posterFile: null,
    mediaPreview: s1?.videoUrl || s1?.imageUrl || "",
    posterPreview: s2?.videoUrl || s2?.imageUrl || "",
  };
}

function draftFromRow(
  optionId: string,
  fallbackTitle: string,
  fallbackDesc: string,
  row: PbBrandingUiItem | undefined
): OptionDraft {
  const base = emptyDraft(optionId, fallbackTitle, fallbackDesc);
  if (!row) return base;
  const media = brandingUiMediaUrl(row) || base.mediaPreview;
  const poster = brandingUiPosterUrl(row) || base.posterPreview;
  return {
    recordId: row.id,
    title: row.title?.trim() || base.title,
    subtitle: row.subtitle?.trim() || base.subtitle,
    slide1Title: row.cta_primary?.trim() || base.slide1Title,
    slide1Caption: row.inclusion_body?.trim() || base.slide1Caption,
    slide2Title: row.cta_secondary?.trim() || base.slide2Title,
    slide2Caption: row.credit_body?.trim() || base.slide2Caption,
    mediaFile: null,
    posterFile: null,
    mediaPreview: media,
    posterPreview: poster,
  };
}

export function PreBuilderQuizBrandingAdmin({
  getClient,
}: {
  getClient: () => PbClient;
}) {
  const [section, setSection] = useState<PreEliteQuizSectionId>("travel_style");
  const [drafts, setDrafts] = useState<Record<string, OptionDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const list = await pb
        .collection("branding_ui_items")
        .getFullList<PbBrandingUiItem>({
          filter: `category = "${PRE_ELITE_BRANDING_CATEGORY}"`,
          sort: "sort_order,key",
          requestKey: null,
        });
      const byKey = new Map(list.map((r) => [r.key, r]));
      const next: Record<string, OptionDraft> = {};
      for (const sec of PRE_ELITE_QUIZ_SECTIONS) {
        for (const opt of sec.options) {
          const key = preEliteBrandingKey(opt.id);
          next[opt.id] = draftFromRow(
            opt.id,
            opt.title,
            opt.description,
            byKey.get(key)
          );
        }
      }
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

  const patchDraft = (optionId: string, patch: Partial<OptionDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [optionId]: { ...prev[optionId], ...patch },
    }));
  };

  const saveOption = async (optionId: string) => {
    const draft = drafts[optionId];
    if (!draft) return;
    setSavingId(optionId);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const key = preEliteBrandingKey(optionId);
      const fd = new FormData();
      fd.append("key", key);
      fd.append("category", PRE_ELITE_BRANDING_CATEGORY);
      fd.append("title", draft.title);
      fd.append("subtitle", draft.subtitle);
      fd.append("cta_primary", draft.slide1Title);
      fd.append("inclusion_body", draft.slide1Caption);
      fd.append("cta_secondary", draft.slide2Title);
      fd.append("credit_body", draft.slide2Caption);
      if (draft.mediaFile) fd.append("media", draft.mediaFile);
      if (draft.posterFile) fd.append("poster", draft.posterFile);

      let saved: PbBrandingUiItem;
      if (draft.recordId) {
        saved = (await pb
          .collection("branding_ui_items")
          .update(draft.recordId, fd)) as unknown as PbBrandingUiItem;
      } else {
        fd.append("sort_order", "0");
        saved = (await pb
          .collection("branding_ui_items")
          .create(fd)) as unknown as PbBrandingUiItem;
      }

      const mediaUrl = brandingUiMediaUrl(saved) || draft.mediaPreview;
      const posterUrl = brandingUiPosterUrl(saved) || draft.posterPreview;
      writePreEliteQuizLocalEntry(optionId, {
        title: draft.title,
        subtitle: draft.subtitle,
        mediaUrl,
        posterUrl,
        slide1Title: draft.slide1Title,
        slide1Caption: draft.slide1Caption,
        slide2Title: draft.slide2Title,
        slide2Caption: draft.slide2Caption,
      });
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });

      patchDraft(optionId, {
        recordId: saved.id,
        mediaFile: null,
        posterFile: null,
        mediaPreview: mediaUrl,
        posterPreview: posterUrl,
      });
      setMsg(`Saved “${draft.title}”. Pre-Builder quiz will use the new media.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading Pre-Builder quiz branding…</p>;
  }

  const activeSection =
    PRE_ELITE_QUIZ_SECTIONS.find((s) => s.id === section) ||
    PRE_ELITE_QUIZ_SECTIONS[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-zinc-100">
          Pre-Builder Match Quiz
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Swap story media, titles, and descriptions for each quiz option.
          Saves to PocketBase{" "}
          <code className="text-zinc-300">branding_ui_items</code> (
          <code className="text-zinc-300">pre_elite_*</code>) and mirrors to
          localStorage for instant live updates on{" "}
          <code className="text-zinc-300">/pre-elite-builder</code>.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <div className="flex flex-wrap gap-2">
        {PRE_ELITE_QUIZ_SECTIONS.map((s) => {
          const on = s.id === section;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={
                on
                  ? "rounded-full border border-[#075473] bg-[#075473]/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7dd3fc]"
                  : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 sm:p-6">
        <h3 className="font-geosans text-xs font-semibold uppercase tracking-[0.22em] text-[#075473]">
          {activeSection.label}
        </h3>
        <div className="mt-5 space-y-6">
          {activeSection.options.map((opt) => {
            const d = drafts[opt.id];
            if (!d) return null;
            const busy = savingId === opt.id;
            return (
              <div
                key={opt.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 sm:p-5"
              >
                <p className="font-godiva text-sm tracking-wider text-zinc-200 uppercase">
                  {opt.title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  key · {preEliteBrandingKey(opt.id)}
                </p>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <MediaSlot
                    label="Story slide 1 / 2"
                    preview={d.mediaPreview}
                    onFile={(f) => {
                      patchDraft(opt.id, {
                        mediaFile: f,
                        mediaPreview: f
                          ? URL.createObjectURL(f)
                          : d.mediaPreview,
                      });
                    }}
                  />
                  <MediaSlot
                    label="Story slide 2 / 2"
                    preview={d.posterPreview}
                    onFile={(f) => {
                      patchDraft(opt.id, {
                        posterFile: f,
                        posterPreview: f
                          ? URL.createObjectURL(f)
                          : d.posterPreview,
                      });
                    }}
                  />
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Title
                    <input
                      type="text"
                      value={d.title}
                      onChange={(e) =>
                        patchDraft(opt.id, { title: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-godiva text-sm uppercase tracking-wider text-zinc-100"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Description
                    <textarea
                      rows={2}
                      value={d.subtitle}
                      onChange={(e) =>
                        patchDraft(opt.id, { subtitle: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs uppercase tracking-wider text-zinc-400">
                      Slide 1 title
                      <input
                        type="text"
                        value={d.slide1Title}
                        onChange={(e) =>
                          patchDraft(opt.id, { slide1Title: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                      />
                    </label>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400">
                      Slide 2 title
                      <input
                        type="text"
                        value={d.slide2Title}
                        onChange={(e) =>
                          patchDraft(opt.id, { slide2Title: e.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs uppercase tracking-wider text-zinc-400">
                      Slide 1 caption
                      <textarea
                        rows={2}
                        value={d.slide1Caption}
                        onChange={(e) =>
                          patchDraft(opt.id, {
                            slide1Caption: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                      />
                    </label>
                    <label className="block text-xs uppercase tracking-wider text-zinc-400">
                      Slide 2 caption
                      <textarea
                        rows={2}
                        value={d.slide2Caption}
                        onChange={(e) =>
                          patchDraft(opt.id, {
                            slide2Caption: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveOption(opt.id)}
                  className="mt-4 rounded-full bg-[#075473] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5f84] disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save option"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MediaSlot({
  label,
  preview,
  onFile,
}: {
  label: string;
  preview: string;
  onFile: (f: File | null) => void;
}) {
  const isVideo = isVideoFilename(preview);
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <div className="overflow-hidden rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-3">
        {preview ? (
          isVideo ? (
            <video
              src={preview}
              className="mx-auto aspect-[9/16] max-h-48 w-auto rounded-lg object-cover"
              muted
              playsInline
              controls
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="mx-auto aspect-[9/16] max-h-48 w-auto rounded-lg object-cover"
            />
          )
        ) : (
          <div className="flex h-28 items-center justify-center text-xs text-zinc-500">
            No media yet
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/webp,image/png,video/mp4,video/webm,.jpg,.webp,.mp4"
          className="mt-3 block w-full text-xs text-zinc-300"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
