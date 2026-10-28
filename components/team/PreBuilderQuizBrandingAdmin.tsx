"use client";

import type PocketBase from "pocketbase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { optimizeFileForUpload } from "@/lib/optimizeUploadClient";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import type { PbBrandingUiItem } from "@/lib/pocketbase/client";
import { uploadToVps } from "@/lib/vpsUploadClient";
import {
  brandingSlotWebUrl,
  preEliteCardSlot,
  preEliteSlidePosterSlot,
  preEliteSlideSlot,
} from "@/lib/brandingImageSlots";
import {
  PRE_ELITE_BRANDING_CATEGORY,
  PRE_ELITE_QUIZ_SECTIONS,
  preEliteBrandingKey,
  preEliteMediaVersion,
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
  slide3Title: string;
  slide3Caption: string;
  mediaFile: File | null;
  posterFile: File | null;
  slide3File: File | null;
  cardFile: File | null;
  mediaPosterFile: File | null;
  slide2PosterFile: File | null;
  slide3PosterFile: File | null;
  mediaPreview: string;
  posterPreview: string;
  slide3Preview: string;
  cardPreview: string;
  mediaPosterPreview: string;
  slide2PosterPreview: string;
  slide3PosterPreview: string;
};

function emptyDraft(
  optionId: string,
  title: string,
  description: string
): OptionDraft {
  const story = getStoryExplanation(optionId);
  const s1 = story?.slides[0];
  const s2 = story?.slides[1];
  const s3 = story?.slides[2];
  return {
    recordId: null,
    title,
    subtitle: description,
    slide1Title: s1?.title || "",
    slide1Caption: s1?.caption || "",
    slide2Title: s2?.title || "",
    slide2Caption: s2?.caption || "",
    slide3Title: s3?.title || "Moment 3",
    slide3Caption:
      s3?.caption ||
      "A closer look at how this choice shapes your Japan days.",
    mediaFile: null,
    posterFile: null,
    slide3File: null,
    cardFile: null,
    mediaPosterFile: null,
    slide2PosterFile: null,
    slide3PosterFile: null,
    mediaPreview: s1?.videoUrl || s1?.imageUrl || "",
    posterPreview: s2?.videoUrl || s2?.imageUrl || "",
    slide3Preview: s3?.videoUrl || s3?.imageUrl || "",
    cardPreview: "",
    mediaPosterPreview: s1?.imageUrl && !s1?.videoUrl ? "" : s1?.imageUrl || "",
    slide2PosterPreview: "",
    slide3PosterPreview: "",
  };
}

/** Stable-slot preview URL (+ record-version cache-buster). */
function slotPreview(slot: string, version?: string): string {
  const url = brandingSlotWebUrl(slot);
  const v = String(version || "").trim();
  return v ? `${url}?v=${encodeURIComponent(v)}` : url;
}

function draftFromRow(
  optionId: string,
  fallbackTitle: string,
  fallbackDesc: string,
  row: PbBrandingUiItem | undefined
): OptionDraft {
  const base = emptyDraft(optionId, fallbackTitle, fallbackDesc);
  const version = preEliteMediaVersion(row);
  // Slot-only previews: the stable branding slot
  // (/uploads/branding/preelite-…) is the one source of truth
  // (numbered placeholder until replaced). Legacy PocketBase
  // videos/files in these spaces are retired and never previewed.
  const previews = {
    mediaPreview: slotPreview(preEliteSlideSlot(optionId, 1), version),
    posterPreview: slotPreview(preEliteSlideSlot(optionId, 2), version),
    slide3Preview: slotPreview(preEliteSlideSlot(optionId, 3), version),
    cardPreview: slotPreview(preEliteCardSlot(optionId), version),
    mediaPosterPreview: slotPreview(
      preEliteSlidePosterSlot(optionId, 1),
      version
    ),
    slide2PosterPreview: slotPreview(
      preEliteSlidePosterSlot(optionId, 2),
      version
    ),
    slide3PosterPreview: slotPreview(
      preEliteSlidePosterSlot(optionId, 3),
      version
    ),
  };
  if (!row) return { ...base, ...previews };
  return {
    recordId: row.id,
    title: row.title?.trim() || base.title,
    subtitle: row.subtitle?.trim() || base.subtitle,
    slide1Title: row.cta_primary?.trim() || base.slide1Title,
    slide1Caption: row.inclusion_body?.trim() || base.slide1Caption,
    slide2Title: row.cta_secondary?.trim() || base.slide2Title,
    slide2Caption: row.credit_body?.trim() || base.slide2Caption,
    slide3Title: row.inclusion_title?.trim() || base.slide3Title,
    slide3Caption: row.credit_title?.trim() || base.slide3Caption,
    mediaFile: null,
    posterFile: null,
    slide3File: null,
    cardFile: null,
    mediaPosterFile: null,
    slide2PosterFile: null,
    slide3PosterFile: null,
    ...previews,
  };
}

export function PreBuilderQuizBrandingAdmin({
  getClient,
}: {
  getClient: () => PbClient;
}) {
  const [section, setSection] = useState<PreEliteQuizSectionId>("travel_style");
  const [optionBySection, setOptionBySection] = useState<
    Partial<Record<PreEliteQuizSectionId, string>>
  >({});
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
      fd.append("inclusion_title", draft.slide3Title);
      fd.append("credit_title", draft.slide3Caption);
      // IMAGES go OUTSIDE PocketBase into stable branding slots
      // (/uploads/branding/preelite-{optionId}-…): same ID on every
      // replace, web + mobile WebP generated server-side, no orphans.
      // Videos keep the legacy PocketBase file fields for now.
      const token = pb.authStore.token || "";
      const uploaded: Record<string, string> = {};
      const upImage = async (
        file: File | null,
        slot: string,
        field: string
      ) => {
        if (!file || !file.type.startsWith("image/")) return false;
        const opt = await optimizeFileForUpload(file);
        const saved = await uploadToVps(opt.file, "branding", token, {
          stableKey: slot,
        });
        uploaded[field] = saved.url;
        return true;
      };
      await upImage(draft.mediaFile, preEliteSlideSlot(optionId, 1), "mediaUrl");
      await upImage(
        draft.mediaPosterFile,
        preEliteSlidePosterSlot(optionId, 1),
        "mediaPosterUrl"
      );
      await upImage(draft.posterFile, preEliteSlideSlot(optionId, 2), "posterUrl");
      await upImage(
        draft.slide2PosterFile,
        preEliteSlidePosterSlot(optionId, 2),
        "slide2PosterUrl"
      );
      await upImage(draft.slide3File, preEliteSlideSlot(optionId, 3), "slide3Url");
      await upImage(
        draft.slide3PosterFile,
        preEliteSlidePosterSlot(optionId, 3),
        "slide3PosterUrl"
      );
      await upImage(draft.cardFile, preEliteCardSlot(optionId), "cardUrl");

      // Image now lives in its stable slot → clear the legacy
      // PocketBase file field so PocketBase deletes the old binary:
      // no orphan files, and the old photo can never resurface.
      const PB_FIELD_BY_UPLOAD: Record<string, string> = {
        mediaUrl: "media",
        posterUrl: "poster",
        slide3Url: "slide3",
        cardUrl: "card",
        mediaPosterUrl: "media_poster",
        slide2PosterUrl: "slide2_poster",
        slide3PosterUrl: "slide3_poster",
      };
      for (const [field, pbField] of Object.entries(PB_FIELD_BY_UPLOAD)) {
        if (uploaded[field]) fd.append(pbField, "");
      }
      // Bump the media version stamp: slot IDs never change, so this
      // stamp (media_version field) is what makes guests/admin fetch
      // the replaced photo instead of the cache.
      if (Object.keys(uploaded).length) {
        fd.append("media_version", String(Date.now()));
      }

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

      // Images always resolve to their stable slot — never PocketBase.
      const mediaUrl = brandingSlotWebUrl(preEliteSlideSlot(optionId, 1));
      const posterUrl = brandingSlotWebUrl(preEliteSlideSlot(optionId, 2));
      const slide3Url = brandingSlotWebUrl(preEliteSlideSlot(optionId, 3));
      const cardUrl = brandingSlotWebUrl(preEliteCardSlot(optionId));
      const cardPosterUrl = "";
      const mediaPosterUrl = brandingSlotWebUrl(
        preEliteSlidePosterSlot(optionId, 1)
      );
      const slide2PosterUrl = brandingSlotWebUrl(
        preEliteSlidePosterSlot(optionId, 2)
      );
      const slide3PosterUrl = brandingSlotWebUrl(
        preEliteSlidePosterSlot(optionId, 3)
      );
      writePreEliteQuizLocalEntry(optionId, {
        title: draft.title,
        subtitle: draft.subtitle,
        mediaUrl,
        posterUrl,
        slide3Url,
        cardUrl,
        cardPosterUrl: cardPosterUrl || undefined,
        mediaPosterUrl: mediaPosterUrl || undefined,
        slide2PosterUrl: slide2PosterUrl || undefined,
        slide3PosterUrl: slide3PosterUrl || undefined,
        slide1Title: draft.slide1Title,
        slide1Caption: draft.slide1Caption,
        slide2Title: draft.slide2Title,
        slide2Caption: draft.slide2Caption,
        slide3Title: draft.slide3Title,
        slide3Caption: draft.slide3Caption,
      });
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });

      // Slot URLs never change on replace, so bust the browser cache
      // for the admin previews — the new image shows immediately.
      const bust = (u: string) =>
        u.startsWith("/uploads/branding/")
          ? `${u}${u.includes("?") ? "&" : "?"}v=${Date.now()}`
          : u;
      patchDraft(optionId, {
        recordId: saved.id,
        mediaFile: null,
        posterFile: null,
        slide3File: null,
        cardFile: null,
        mediaPosterFile: null,
        slide2PosterFile: null,
        slide3PosterFile: null,
        mediaPreview: bust(mediaUrl),
        posterPreview: bust(posterUrl),
        slide3Preview: bust(slide3Url),
        cardPreview: bust(cardUrl),
        mediaPosterPreview: bust(mediaPosterUrl),
        slide2PosterPreview: bust(slide2PosterUrl),
        slide3PosterPreview: bust(slide3PosterUrl),
      });
      setMsg(
        `Saved “${draft.title}”. Card + slides + fast preload posters update on Pre-Builder.`
      );
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-zinc-400">Loading Pre-Builder quiz branding…</p>
    );
  }

  const activeSection =
    PRE_ELITE_QUIZ_SECTIONS.find((s) => s.id === section) ||
    PRE_ELITE_QUIZ_SECTIONS[0];
  const activeOptionId =
    optionBySection[activeSection.id] &&
    activeSection.options.some(
      (o) => o.id === optionBySection[activeSection.id]
    )
      ? (optionBySection[activeSection.id] as string)
      : activeSection.options[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-zinc-100">
            Pre-Builder Match Quiz
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Upload a{" "}
            <strong className="font-semibold text-zinc-200">card photo</strong>{" "}
            (shown when that option is selected) plus{" "}
            <strong className="font-semibold text-zinc-200">3 story slides</strong>
            . Images save OUTSIDE PocketBase to a stable ID
            (<code className="text-zinc-300">/uploads/branding/preelite-…</code>,
            web + mobile versions, replaced in place — same ID forever).
            Videos are no longer used in these spaces (old PocketBase videos
            stay stored but unused). Text saves to PocketBase and updates{" "}
            <code className="text-zinc-300">/pre-elite-builder</code> live.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/team-access/layout-builder"
            className="rounded-xl border border-[#075473] bg-[#075473]/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7dd3fc] transition hover:bg-[#075473]/35"
          >
            Layout &amp; characters →
          </Link>
          <Link
            href="/team-access/source-wizard"
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-300 transition hover:bg-amber-500/20"
          >
            Source wizard →
          </Link>
        </div>
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
        <div className="mt-4 flex flex-wrap gap-2 overflow-x-auto border-b border-zinc-800 pb-4">
          {activeSection.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() =>
                setOptionBySection((prev) => ({
                  ...prev,
                  [activeSection.id]: opt.id,
                }))
              }
              className={
                activeOptionId === opt.id
                  ? "rounded-full border border-[#075473] bg-[#075473]/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7dd3fc]"
                  : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
              }
            >
              {opt.title}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-6">
          {activeSection.options
            .filter((opt) => opt.id === activeOptionId)
            .map((opt) => {
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
                  key · {preEliteBrandingKey(opt.id)} · card + 3 slides
                </p>

                <div className="mt-4">
                  <MediaSlot
                    label="Card photo (selected on Pre-Builder)"
                    variant="card"
                    preview={d.cardPreview}
                    pendingFile={d.cardFile}
                    onFile={(f) => {
                      patchDraft(opt.id, {
                        cardFile: f,
                        cardPreview: f
                          ? URL.createObjectURL(f)
                          : d.cardPreview,
                      });
                    }}
                  />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="space-y-3">
                    <MediaSlot
                      label="Slide 1 / 3"
                      variant="story"
                      preview={d.mediaPreview}
                      pendingFile={d.mediaFile}
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
                      label="Fast preload poster · slide 1"
                      variant="still"
                      preview={d.mediaPosterPreview}
                      pendingFile={d.mediaPosterFile}
                      onFile={(f) => {
                        patchDraft(opt.id, {
                          mediaPosterFile: f,
                          mediaPosterPreview: f
                            ? URL.createObjectURL(f)
                            : d.mediaPosterPreview,
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-3">
                    <MediaSlot
                      label="Slide 2 / 3"
                      variant="story"
                      preview={d.posterPreview}
                      pendingFile={d.posterFile}
                      onFile={(f) => {
                        patchDraft(opt.id, {
                          posterFile: f,
                          posterPreview: f
                            ? URL.createObjectURL(f)
                            : d.posterPreview,
                        });
                      }}
                    />
                    <MediaSlot
                      label="Fast preload poster · slide 2"
                      variant="still"
                      preview={d.slide2PosterPreview}
                      pendingFile={d.slide2PosterFile}
                      onFile={(f) => {
                        patchDraft(opt.id, {
                          slide2PosterFile: f,
                          slide2PosterPreview: f
                            ? URL.createObjectURL(f)
                            : d.slide2PosterPreview,
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-3">
                    <MediaSlot
                      label="Slide 3 / 3"
                      variant="story"
                      preview={d.slide3Preview}
                      pendingFile={d.slide3File}
                      onFile={(f) => {
                        patchDraft(opt.id, {
                          slide3File: f,
                          slide3Preview: f
                            ? URL.createObjectURL(f)
                            : d.slide3Preview,
                        });
                      }}
                    />
                    <MediaSlot
                      label="Fast preload poster · slide 3"
                      variant="still"
                      preview={d.slide3PosterPreview}
                      pendingFile={d.slide3PosterFile}
                      onFile={(f) => {
                        patchDraft(opt.id, {
                          slide3PosterFile: f,
                          slide3PosterPreview: f
                            ? URL.createObjectURL(f)
                            : d.slide3PosterPreview,
                        });
                      }}
                    />
                  </div>
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
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["slide1Title", "Slide 1 title", d.slide1Title],
                        ["slide2Title", "Slide 2 title", d.slide2Title],
                        ["slide3Title", "Slide 3 title", d.slide3Title],
                      ] as const
                    ).map(([key, label, value]) => (
                      <label
                        key={key}
                        className="block text-xs uppercase tracking-wider text-zinc-400"
                      >
                        {label}
                        <input
                          type="text"
                          value={value}
                          onChange={(e) =>
                            patchDraft(opt.id, { [key]: e.target.value })
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["slide1Caption", "Slide 1 caption", d.slide1Caption],
                        ["slide2Caption", "Slide 2 caption", d.slide2Caption],
                        ["slide3Caption", "Slide 3 caption", d.slide3Caption],
                      ] as const
                    ).map(([key, label, value]) => (
                      <label
                        key={key}
                        className="block text-xs uppercase tracking-wider text-zinc-400"
                      >
                        {label}
                        <textarea
                          rows={2}
                          value={value}
                          onChange={(e) =>
                            patchDraft(opt.id, { [key]: e.target.value })
                          }
                          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                        />
                      </label>
                    ))}
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
  pendingFile,
  onFile,
  variant = "story",
}: {
  label: string;
  preview: string;
  pendingFile?: File | null;
  onFile: (f: File | null) => void;
  /** card = wide Pre-Builder row · story = tall 9:16 · still = image-only poster */
  variant?: "card" | "story" | "still";
}) {
  const isVideo = false;
  void pendingFile;
  const isCard = variant === "card";
  const isStill = variant === "still";
  const hint = isStill
    ? "Still image only · fast preload still for this slide"
    : isCard
      ? "Image only · landscape 16:9 (≈1600×900) — matches selected card strip"
      : "Image only · portrait 9:16 (1080×1920) — matches story window";
  const accept = "image/*";

  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-3">
        {isCard ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            {preview ? (
              isVideo ? (
                <video
                  src={preview}
                  className="aspect-[16/7] w-full max-h-36 object-cover"
                  muted
                  playsInline
                  controls
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="aspect-[16/7] w-full max-h-36 object-cover"
                />
              )
            ) : (
              <div className="flex aspect-[16/7] max-h-36 w-full items-center justify-center text-xs text-zinc-500">
                No media yet
              </div>
            )}
          </div>
        ) : isStill ? (
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="aspect-[9/16] max-h-40 w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[9/16] max-h-40 w-full items-center justify-center px-2 text-center text-[10px] text-zinc-500">
                Optional still · auto frame if empty
              </div>
            )}
          </div>
        ) : (
          /* Phone-shaped story preview — same ratio as StoryExplanationModal */
          <div className="flex justify-center">
            <div className="relative w-full max-w-[10.5rem] overflow-hidden rounded-[1.25rem] border border-white/15 bg-black shadow-lg ring-1 ring-black/40">
              <div className="absolute left-2 right-2 top-2 z-10 flex gap-0.5">
                <div className="h-0.5 flex-1 rounded-full bg-[#075473]" />
                <div className="h-0.5 flex-1 rounded-full bg-white/25" />
                <div className="h-0.5 flex-1 rounded-full bg-white/25" />
              </div>
              {preview ? (
                isVideo ? (
                  <video
                    src={preview}
                    className="aspect-[9/16] w-full object-cover"
                    muted
                    playsInline
                    controls
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt=""
                    className="aspect-[9/16] w-full object-cover"
                  />
                )
              ) : (
                <div className="flex aspect-[9/16] w-full items-center justify-center text-[11px] text-zinc-500">
                  No media yet
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2.5 pt-8">
                <p className="truncate text-center text-[9px] font-semibold uppercase tracking-wider text-white/90">
                  Story preview
                </p>
              </div>
            </div>
          </div>
        )}
        <input
          type="file"
          accept={accept}
          className="mt-3 block w-full text-xs text-zinc-300"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1.5 text-[10px] text-zinc-500">{hint}</p>
      </div>
    </div>
  );
}
