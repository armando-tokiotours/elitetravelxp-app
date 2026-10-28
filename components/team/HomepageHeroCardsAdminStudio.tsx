"use client";

import type PocketBase from "pocketbase";
import { useCallback, useEffect, useRef, useState } from "react";
import { optimizeFileForUpload } from "@/lib/optimizeUploadClient";
import { uploadToVps } from "@/lib/vpsUploadClient";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  DEFAULT_HOMEPAGE_HERO_INTRO,
  fetchSiteBranding,
  parseVideoEmbed,
  resolveHomepageHeroIntro,
  serializeHomepageHeroIntroConfig,
  HOMEPAGE_HERO_GRID_PANEL_IDS,
  type HomepageHeroCardId,
  type HomepageHeroCardConfig,
  type HomepageHeroCardMediaType,
  type HomepageHeroGridPanelId,
  type HomepageHeroGridPanelMedia,
  type HomepageHeroIntroTextId,
  type HomepageHeroTextSlot,
  type PbSiteBranding,
} from "@/lib/pocketbase/client";

type PbClient = PocketBase;

type CardDraft = Omit<HomepageHeroCardConfig, "route" | "tripType"> & {
  photoFile: File | null;
  videoFile: File | null;
  removeVideo: boolean;
};

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;


const CARD_LABELS: Record<HomepageHeroCardId, string> = {
  single: "1-Day Express Pass",
  experience: "VIP Tickets & Local Access",
  multiday: "Grand Japan Journey",
};

const CARD_ORDER: HomepageHeroCardId[] = [
  "single",
  "experience",
  "multiday",
];


const VIDEO_FIELD: Record<HomepageHeroCardId, string> = {
  single: "hero_card_single_video",
  experience: "hero_card_experience_video",
  multiday: "hero_card_multiday_video",
};

type PanelDraft = HomepageHeroGridPanelMedia & {
  imageFile: File | null;
  videoFile: File | null;
  removeImage: boolean;
  removeVideo: boolean;
};

const PANEL_LABELS: Record<HomepageHeroGridPanelId, string> = {
  p1: "Panel 1 · Sky (top-left) — built-in 5.webp",
  p2: "Panel 2 · Fuji (center) — built-in 4.webp",
  p3: "Panel 3 · Character (right) — built-in 2.webp",
  p4: "Panel 4 · Purple text panel (background) — built-in purple",
  p5: "Panel 5 · Garden path — built-in 7.webp",
  p6: "Panel 6 · Torii gate — built-in 8.webp",
};

/** Built-in artwork per panel (same paths the homepage hero renders). */
const PANEL_BUILT_IN: Record<HomepageHeroGridPanelId, string> = {
  p1: "/assets/base4/processed/5.webp",
  p2: "/assets/base4/processed/4.webp",
  p3: "/assets/base4/processed/2.webp",
  p4: "",
  p5: "/assets/base4/processed/7.webp",
  p6: "/assets/base4/processed/8.webp",
};

/**
 * Panel media lives OUTSIDE PocketBase in stable per-panel slots:
 * /uploads/hero-panels/hero-panel-p{n}[.ext] (image) and
 * hero-panel-p{n}-video[.ext] (video). Re-uploads overwrite the same
 * file, so the URL stored in hero_intro_config JSON never changes.
 */
const PANEL_IMAGE_STABLE_KEY = (id: HomepageHeroGridPanelId) =>
  `hero-panel-${id}`;
const PANEL_VIDEO_STABLE_KEY = (id: HomepageHeroGridPanelId) =>
  `hero-panel-${id}-video`;

function panelDraftsFromIntro(
  gridPanels: Record<HomepageHeroGridPanelId, HomepageHeroGridPanelMedia>
): Record<HomepageHeroGridPanelId, PanelDraft> {
  const next = {} as Record<HomepageHeroGridPanelId, PanelDraft>;
  for (const id of HOMEPAGE_HERO_GRID_PANEL_IDS) {
    const p = gridPanels[id];
    next[id] = {
      mediaType: p?.mediaType ?? "image",
      mediaEmbedUrl: p?.mediaEmbedUrl ?? "",
      mediaImageUrl: p?.mediaImageUrl ?? "",
      mediaVideoUrl: p?.mediaVideoUrl ?? "",
      mediaImageVersion: p?.mediaImageVersion ?? "",
      mediaVideoVersion: p?.mediaVideoVersion ?? "",
      imageFile: null,
      videoFile: null,
      removeImage: false,
      removeVideo: false,
    };
  }
  return next;
}

function draftsFromIntro(
  cards: HomepageHeroCardConfig[]
): Record<HomepageHeroCardId, CardDraft> {
  const next = {} as Record<HomepageHeroCardId, CardDraft>;
  for (const id of CARD_ORDER) {
    const c =
      cards.find((x) => x.id === id) ||
      DEFAULT_HOMEPAGE_HERO_INTRO.cards.find((x) => x.id === id)!;
    next[id] = {
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      japaneseText: c.japaneseText,
      japaneseTextPosition: c.japaneseTextPosition,
      overlay: { ...c.overlay },
      heroPhotoUrl: c.heroPhotoUrl,
      mediaType: c.mediaType ?? "image",
      mediaVideoUrl: c.mediaVideoUrl ?? "",
      mediaEmbedUrl: c.mediaEmbedUrl ?? "",
      order: c.order,
      photoFile: null,
      videoFile: null,
      removeVideo: false,
    };
  }
  return next;
}

function cloneTextLayouts(
  layouts: Record<HomepageHeroIntroTextId, HomepageHeroTextSlot>
) {
  return {
    mainTitle: { ...layouts.mainTitle },
    scriptTitle: { ...layouts.scriptTitle },
    tagline: { ...layouts.tagline },
  };
}

export function HomepageHeroCardsAdminStudio({
  getClient,
}: {
  getClient: () => PbClient;
}) {
  const [record, setRecord] = useState<PbSiteBranding | null>(null);
  const [mainTitle, setMainTitle] = useState(
    DEFAULT_HOMEPAGE_HERO_INTRO.mainTitle
  );
  const [scriptTitle, setScriptTitle] = useState(
    DEFAULT_HOMEPAGE_HERO_INTRO.scriptTitle
  );
  const [panelColor, setPanelColor] = useState(
    DEFAULT_HOMEPAGE_HERO_INTRO.panelColor
  );
  const [panelText, setPanelText] = useState(
    DEFAULT_HOMEPAGE_HERO_INTRO.panelText
  );
  const [tagline, setTagline] = useState(DEFAULT_HOMEPAGE_HERO_INTRO.tagline);
  const [textLayouts, setTextLayouts] = useState(() =>
    cloneTextLayouts(DEFAULT_HOMEPAGE_HERO_INTRO.textLayouts)
  );
  const [drafts, setDrafts] = useState(() =>
    draftsFromIntro(DEFAULT_HOMEPAGE_HERO_INTRO.cards)
  );
  const [panelDrafts, setPanelDrafts] = useState(() =>
    panelDraftsFromIntro(DEFAULT_HOMEPAGE_HERO_INTRO.gridPanels)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const autosaveTimer = useRef<number | null>(null);
  const skipNextAutosave = useRef(true);
  const textEditingRef = useRef(false);
  const saveGenRef = useRef(0);
  const snapshotRef = useRef({
    record,
    mainTitle,
    scriptTitle,
    panelColor,
    panelText,
    tagline,
    textLayouts,
    drafts,
    panelDrafts,
  });
  snapshotRef.current = {
    record,
    mainTitle,
    scriptTitle,
    panelColor,
    panelText,
    tagline,
    textLayouts,
    drafts,
    panelDrafts,
  };

  const applyRecord = useCallback((row: PbSiteBranding | null) => {
    const intro = resolveHomepageHeroIntro(row);
    setMainTitle(intro.mainTitle);
    setScriptTitle(intro.scriptTitle);
    setPanelColor(intro.panelColor);
    setPanelText(intro.panelText);
    setTagline(intro.tagline);
    setTextLayouts(cloneTextLayouts(intro.textLayouts));
    setDrafts(draftsFromIntro(intro.cards));
    setPanelDrafts(panelDraftsFromIntro(intro.gridPanels));
  }, []);

  /** After save: keep local copy; only refresh photo/video URLs from the server. */
  const mergePhotosFromRecord = useCallback((row: PbSiteBranding | null) => {
    if (!row) return;
    const intro = resolveHomepageHeroIntro(row);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of CARD_ORDER) {
        const serverCard = intro.cards.find((c) => c.id === id);
        const serverUrl = serverCard?.heroPhotoUrl;
        if (serverUrl && !prev[id].photoFile) {
          next[id] = { ...next[id], heroPhotoUrl: serverUrl, photoFile: null };
        }
        // Video file was just persisted (or removed) — adopt server URL.
        if (prev[id].videoFile || prev[id].removeVideo) {
          next[id] = {
            ...next[id],
            mediaVideoUrl: serverCard?.mediaVideoUrl ?? "",
            videoFile: null,
            removeVideo: false,
          };
        }
      }
      return next;
    });
    setPanelDrafts((prev) => {
      const next = { ...prev };
      for (const id of HOMEPAGE_HERO_GRID_PANEL_IDS) {
        const server = intro.gridPanels[id];
        const d = prev[id];
        let merged = { ...d };
        if (d.imageFile || d.removeImage) {
          merged = {
            ...merged,
            mediaImageUrl: server?.mediaImageUrl ?? "",
            mediaImageVersion: server?.mediaImageVersion ?? "",
            imageFile: null,
            removeImage: false,
          };
        }
        if (d.videoFile || d.removeVideo) {
          merged = {
            ...merged,
            mediaVideoUrl: server?.mediaVideoUrl ?? "",
            mediaVideoVersion: server?.mediaVideoVersion ?? "",
            videoFile: null,
            removeVideo: false,
          };
        }
        next[id] = merged;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await fetchSiteBranding();
        if (cancelled) return;
        setRecord(row);
        applyRecord(row);
        skipNextAutosave.current = true;
      } catch (e) {
        if (!cancelled) setError(formatPbError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRecord]);

  const persist = useCallback(async () => {
    const snap = snapshotRef.current;
    const gen = ++saveGenRef.current;
    setSaving(true);
    setSaveStatus("saving");
    setError(null);
    setMsg(null);
    try {
      // Validate embed URLs before saving (empty = gradient/photo fallback).
      for (const id of CARD_ORDER) {
        const d = snap.drafts[id];
        if (
          d.mediaType === "youtube_link" &&
          (d.mediaEmbedUrl || "").trim() &&
          !parseVideoEmbed(d.mediaEmbedUrl)
        ) {
          setError(
            `${CARD_LABELS[id]}: video link must be a YouTube (watch / youtu.be / embed / shorts), Vimeo, or direct .mp4/.webm URL.`
          );
          setSaveStatus("error");
          setSaving(false);
          return;
        }
      }
      for (const id of HOMEPAGE_HERO_GRID_PANEL_IDS) {
        const d = snap.panelDrafts[id];
        if (
          d.mediaType === "youtube_link" &&
          (d.mediaEmbedUrl || "").trim() &&
          !parseVideoEmbed(d.mediaEmbedUrl)
        ) {
          setError(
            `${PANEL_LABELS[id]}: video link must be a YouTube (watch / youtu.be / embed / shorts), Vimeo, or direct .mp4/.webm URL.`
          );
          setSaveStatus("error");
          setSaving(false);
          return;
        }
      }
      const pb = getClient();
      const token0 = pb.authStore.token || "";
      // Card cover photos → stable branding slots OUTSIDE PocketBase
      // (/uploads/branding/home-card-{id}.webp + --mobile): same ID on
      // every replace, URL stored in hero_intro_config JSON below.
      const uploadedPhoto = {} as Record<
        HomepageHeroCardId,
        { url?: string; version?: string }
      >;
      for (const id of CARD_ORDER) {
        uploadedPhoto[id] = {};
        const file = snap.drafts[id].photoFile;
        if (file) {
          const saved = await uploadToVps(file, "branding", token0, {
            stableKey: `home-card-${id}`,
          });
          uploadedPhoto[id] = {
            url: saved.url,
            version: String(Date.now()),
          };
        }
      }
      const cards = CARD_ORDER.map((id) => {
        const d = snap.drafts[id];
        return {
          id: d.id,
          title: d.title,
          subtitle: d.subtitle,
          japaneseText: d.japaneseText,
          japaneseTextPosition: d.japaneseTextPosition,
          overlay: d.overlay,
          order: d.order,
          mediaType: d.mediaType ?? "image",
          mediaEmbedUrl: d.mediaEmbedUrl ?? "",
          heroPhotoUrl: uploadedPhoto[id].url ?? d.heroPhotoUrl ?? "",
          heroPhotoVersion:
            uploadedPhoto[id].version ?? d.heroPhotoVersion ?? "",
        };
      });
      // Panel media → external VPS storage (public/uploads/hero-panels),
      // NEVER PocketBase files. Each panel has ONE stable slot
      // (hero-panel-p{n} / hero-panel-p{n}-video): re-uploads overwrite
      // the same file, the stored URL never changes, and a fresh version
      // stamp busts browser/CDN caches at display time.
      const token = pb.authStore.token || "";
      const uploaded = {} as Record<
        HomepageHeroGridPanelId,
        { imageUrl?: string; imageVersion?: string; videoUrl?: string; videoVersion?: string }
      >;
      for (const id of HOMEPAGE_HERO_GRID_PANEL_IDS) {
        const d = snap.panelDrafts[id];
        uploaded[id] = {};
        if (d.imageFile) {
          const saved = await uploadToVps(d.imageFile, "hero-panels", token, {
            stableKey: PANEL_IMAGE_STABLE_KEY(id),
          });
          uploaded[id].imageUrl = saved.url;
          uploaded[id].imageVersion = String(Date.now());
        }
        if (d.videoFile) {
          const saved = await uploadToVps(d.videoFile, "hero-panels", token, {
            stableKey: PANEL_VIDEO_STABLE_KEY(id),
          });
          uploaded[id].videoUrl = saved.url;
          uploaded[id].videoVersion = String(Date.now());
        }
      }
      const gridPanels = {} as Record<
        HomepageHeroGridPanelId,
        Pick<
          HomepageHeroGridPanelMedia,
          | "mediaType"
          | "mediaEmbedUrl"
          | "mediaImageUrl"
          | "mediaVideoUrl"
          | "mediaImageVersion"
          | "mediaVideoVersion"
        >
      >;
      for (const id of HOMEPAGE_HERO_GRID_PANEL_IDS) {
        const d = snap.panelDrafts[id];
        gridPanels[id] = {
          mediaType: d.mediaType ?? "image",
          mediaEmbedUrl: d.mediaEmbedUrl ?? "",
          mediaImageUrl: d.removeImage
            ? ""
            : (uploaded[id].imageUrl ?? d.mediaImageUrl ?? ""),
          mediaVideoUrl: d.removeVideo
            ? ""
            : (uploaded[id].videoUrl ?? d.mediaVideoUrl ?? ""),
          mediaImageVersion: d.removeImage
            ? ""
            : (uploaded[id].imageVersion ?? d.mediaImageVersion ?? ""),
          mediaVideoVersion: d.removeVideo
            ? ""
            : (uploaded[id].videoVersion ?? d.mediaVideoVersion ?? ""),
        };
      }
      const payload = serializeHomepageHeroIntroConfig({
        mainTitle: snap.mainTitle,
        scriptTitle: snap.scriptTitle,
        panelColor: snap.panelColor,
        panelText: snap.panelText,
        tagline: snap.tagline,
        textLayouts: snap.textLayouts,
        cards,
        gridPanels,
      });
      const fd = new FormData();
      fd.append("hero_intro_config", payload);
      // NOTE: card cover photos are NOT PocketBase files anymore — they
      // were uploaded above to stable /uploads/branding/home-card-{id}
      // slots and their URLs ride in hero_intro_config JSON. Legacy
      // hero_card_*_photo fields keep resolving until re-uploaded.
      for (const id of CARD_ORDER) {
        const d = snap.drafts[id];
        if (d.videoFile) {
          fd.append(VIDEO_FIELD[id], d.videoFile);
        } else if (d.removeVideo && snap.record) {
          // PocketBase file-delete syntax: "<field>-" + existing filename
          const current = String(
            (snap.record as unknown as Record<string, unknown>)[
              VIDEO_FIELD[id]
            ] || ""
          ).trim();
          if (current) fd.append(`${VIDEO_FIELD[id]}-`, current);
        }
      }
      // NOTE: no hero_panel_* files are written to PocketBase anymore —
      // panel media URLs (stable /uploads/hero-panels/… slots) ride in
      // hero_intro_config JSON above. Legacy PB-file panels still resolve
      // via the file-field fallback until an admin re-uploads them.

      let saved: PbSiteBranding;
      if (snap.record?.id) {
        saved = (await pb
          .collection("site_branding")
          .update(snap.record.id, fd)) as unknown as PbSiteBranding;
      } else {
        saved = (await pb
          .collection("site_branding")
          .create(fd)) as unknown as PbSiteBranding;
      }

      // Stale response (newer save already started) — ignore UI overwrite
      if (gen !== saveGenRef.current) return;

      setRecord(saved);
      skipNextAutosave.current = true;
      // Never re-apply copy into inputs while typing — that was wiping edits.
      if (!textEditingRef.current) {
        mergePhotosFromRecord(saved);
      }
      setSaveStatus("saved");
      setMsg("Saved to PocketBase. Homepage updates on refresh / tab focus.");
    } catch (e) {
      if (gen !== saveGenRef.current) return;
      const err = formatPbError(e);
      setError(
        err.includes("_video")
          ? `${err} — apply PocketBase migration 1791300000_site_branding_hero_card_videos first.`
          : err.includes("hero_intro") || err.includes("Unknown field")
            ? `${err} — apply PocketBase migration 1790930000_homepage_hero_cards first.`
            : err
      );
      setSaveStatus("error");
    } finally {
      if (gen === saveGenRef.current) setSaving(false);
    }
  }, [getClient, mergePhotosFromRecord]);

  const scheduleSave = useCallback(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    // Don't autosave mid-keystroke — wait until blur / Save / drag-end
    if (textEditingRef.current) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void persist();
    }, 600);
  }, [persist]);

  // Autosave layout / card draft changes (not while typing titles)
  useEffect(() => {
    if (loading) return;
    scheduleSave();
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [
    loading,
    mainTitle,
    scriptTitle,
    panelColor,
    panelText,
    tagline,
    textLayouts,
    drafts,
    panelDrafts,
    scheduleSave,
  ]);

  const beginTextEdit = () => {
    textEditingRef.current = true;
  };

  const endTextEdit = () => {
    textEditingRef.current = false;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    void persist();
  };
  const updateCard = <K extends keyof CardDraft>(
    id: HomepageHeroCardId,
    key: K,
    value: CardDraft[K]
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  };

  const handlePhoto = async (id: HomepageHeroCardId, file: File | null) => {
    if (!file) return;
    const { file: optimized } = await optimizeFileForUpload(file);
    const url = URL.createObjectURL(optimized);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], photoFile: optimized, heroPhotoUrl: url },
    }));
  };

  const handleVideo = (id: HomepageHeroCardId, file: File | null) => {
    if (!file) return;
    const isVideoType =
      file.type === "video/mp4" ||
      file.type === "video/webm" ||
      /\.(mp4|webm)$/i.test(file.name);
    if (!isVideoType) {
      setError(`${file.name}: only .mp4 / .webm videos are allowed.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(
        `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB — max 50MB.`
      );
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        videoFile: file,
        mediaVideoUrl: url,
        removeVideo: false,
      },
    }));
  };

  const handleRemoveVideo = (id: HomepageHeroCardId) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        videoFile: null,
        mediaVideoUrl: "",
        removeVideo: true,
      },
    }));
  };

  const updatePanel = <K extends keyof PanelDraft>(
    id: HomepageHeroGridPanelId,
    key: K,
    value: PanelDraft[K]
  ) => {
    setPanelDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const handlePanelImage = async (
    id: HomepageHeroGridPanelId,
    file: File | null
  ) => {
    if (!file) return;
    const { file: optimized } = await optimizeFileForUpload(file);
    const url = URL.createObjectURL(optimized);
    setPanelDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        imageFile: optimized,
        mediaImageUrl: url,
        removeImage: false,
      },
    }));
  };

  const handlePanelVideo = (
    id: HomepageHeroGridPanelId,
    file: File | null
  ) => {
    if (!file) return;
    const isVideoType =
      file.type === "video/mp4" ||
      file.type === "video/webm" ||
      /\.(mp4|webm)$/i.test(file.name);
    if (!isVideoType) {
      setError(`${file.name}: only .mp4 / .webm videos are allowed.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(
        `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB — max 50MB.`
      );
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setPanelDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        videoFile: file,
        mediaVideoUrl: url,
        removeVideo: false,
      },
    }));
  };

  if (loading) {
    return (
      <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
        Loading Main Intro hero cards…
      </p>
    );
  }

  return (
    <div className="space-y-8 rounded-2xl border border-white/10 bg-[#0D1117] p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="font-godiva text-lg text-[#F6A724]">
            Homepage Cards &amp; Hero
          </h3>
          <p className="mt-1 text-xs text-gray-400">
            Hero script word and the three homepage booking cards. Edits save
            on <span className="text-zinc-200">blur</span> or{" "}
            <span className="text-zinc-200">Save changes</span>. Homepage
            refreshes on tab focus.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void persist()}
          className="rounded-xl bg-[#075473] px-5 py-2.5 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition hover:bg-[#075473]/80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

      <div className="space-y-4 rounded-xl border border-white/5 bg-black/40 p-4">
        <h4 className="text-xs font-bold tracking-wider text-cyan-400 uppercase">
          Hero script word (purple panel / headline)
        </h4>
        <div className="text-xs">
          <label className="mb-1 block text-gray-400">
            Script word — shown as “&#123;word&#125; — your Japan, your way”
          </label>
          <input
            type="text"
            value={scriptTitle}
            onChange={(e) => setScriptTitle(e.target.value)}
            onFocus={() => beginTextEdit()}
            onBlur={endTextEdit}
            className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-white sm:max-w-sm"
          />
        </div>

        <div className="border-t border-white/5 pt-4 text-xs">
          <p className="mb-2 font-bold tracking-wider text-cyan-400 uppercase">
            Purple panel (bottom-left) — dynamic text &amp; colour
          </p>
          <label className="mb-1 block text-gray-400">
            Panel text — exact words on the purple panel (empty = the script
            line above)
          </label>
          <input
            type="text"
            value={panelText}
            onChange={(e) => setPanelText(e.target.value)}
            onFocus={() => beginTextEdit()}
            onBlur={endTextEdit}
            placeholder={`e.g. DESIGN — YOUR JAPAN, YOUR WAY`}
            className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-white"
          />
          <label className="mt-3 mb-1 block text-gray-400">
            Panel colour — background of the purple panel
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={
                /^#[0-9a-fA-F]{6}$/.test(panelColor) ? panelColor : "#9333EA"
              }
              onChange={(e) => setPanelColor(e.target.value)}
              className="h-10 w-14 shrink-0 cursor-pointer rounded border border-white/10 bg-white/5"
            />
            <input
              type="text"
              value={panelColor}
              onChange={(e) => setPanelColor(e.target.value)}
              onFocus={() => beginTextEdit()}
              onBlur={endTextEdit}
              placeholder="#9333EA"
              spellCheck={false}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-white sm:max-w-[12rem]"
            />
          </div>
          <p className="mt-1 text-gray-500">
            Default #9333EA. Invalid colours fall back to the default.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-black/40 p-4">
        <h4 className="text-xs font-bold tracking-wider text-cyan-400 uppercase">
          HERO GRID PANELS
        </h4>
        <p className="text-[11px] text-zinc-500">
          Replace the built-in artwork of each scrubbed hero panel. Empty =
          built-in artwork. Video / links play only while the panel is on
          screen. Panel 4 media sits behind the purple text panel.
        </p>
        <div className="space-y-4">
          {HOMEPAGE_HERO_GRID_PANEL_IDS.map((panelId) => {
            const panel = panelDrafts[panelId];
            // ── Live preview: mirror exactly what the homepage renders ──
            const builtInSrc = PANEL_BUILT_IN[panelId];
            const pType = panel.mediaType ?? "image";
            const pEmbed =
              pType === "youtube_link"
                ? parseVideoEmbed(panel.mediaEmbedUrl)
                : null;
            const pYtThumb =
              pEmbed?.provider === "youtube"
                ? `https://i.ytimg.com/vi/${(pEmbed.embedUrl.match(/\/embed\/([\w-]{6,})/) || [])[1] || ""}/hqdefault.jpg`
                : "";
            const pVideoSrc =
              pType === "video"
                ? (panel.mediaVideoUrl || "").trim()
                : pEmbed?.provider === "file"
                  ? pEmbed.embedUrl
                  : "";
            const pImgSrc =
              pType === "image"
                ? (panel.mediaImageUrl || "").trim() || builtInSrc
                : builtInSrc;
            const purplePreviewText =
              (panelText || "").trim() ||
              `${scriptTitle || "DESIGN"} — your Japan, your way`;
            const previewCaption = pVideoSrc
              ? "Live preview — your uploaded video"
              : pYtThumb
                ? "Live preview — YouTube link (thumbnail)"
                : pEmbed?.provider === "vimeo"
                  ? "Live preview — Vimeo link (built-in shown here; video plays on the homepage)"
                  : pType === "image" && (panel.mediaImageUrl || "").trim()
                    ? "Live preview — your uploaded image"
                    : panelId === "p4"
                      ? "Live preview — purple panel (colour + text above)"
                      : "Live preview — built-in artwork";
            return (
              <div
                key={panelId}
                className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs"
              >
                <h5 className="font-bold text-amber-400 uppercase">
                  {PANEL_LABELS[panelId]}
                </h5>

                {/* ── Live preview: what visitors see on this panel now ── */}
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <div className="relative aspect-video w-full bg-[#0B1015]">
                    {pVideoSrc ? (
                      <video
                        src={pVideoSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : pYtThumb || pImgSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pYtThumb || pImgSrc}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                    {panelId === "p4" ? (
                      <>
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundColor: panelColor,
                            opacity: pVideoSrc || pYtThumb || pImgSrc ? 0.8 : 1,
                          }}
                          aria-hidden
                        />
                        <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                          <span className="text-sm font-black tracking-tight text-white uppercase">
                            {purplePreviewText}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <p className="bg-black/40 px-2 py-1 text-[10px] text-zinc-400">
                    {previewCaption}
                  </p>
                </div>
                <label className="block text-gray-400">
                  Media
                  <select
                    value={panel.mediaType ?? "image"}
                    onChange={(e) =>
                      updatePanel(
                        panelId,
                        "mediaType",
                        e.target.value as HomepageHeroCardMediaType
                      )
                    }
                    className="mt-1 w-full rounded border border-white/10 bg-[#0A1017] px-3 py-1.5 text-white"
                  >
                    <option value="image">Image Upload</option>
                    <option value="video">Video Upload (.mp4/.webm)</option>
                    <option value="youtube_link">
                      Video Link (YouTube/Vimeo)
                    </option>
                  </select>
                </label>

                {(panel.mediaType ?? "image") === "image" ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        void handlePanelImage(
                          panelId,
                          e.target.files?.[0] ?? null
                        );
                        e.target.value = "";
                      }}
                      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-gray-300"
                    />
                    {panel.mediaImageUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPanelDrafts((prev) => ({
                              ...prev,
                              [panelId]: {
                                ...prev[panelId],
                                imageFile: null,
                                mediaImageUrl: "",
                                removeImage: true,
                              },
                            }))
                          }
                          className="rounded-full border border-red-900/60 px-3 py-1 text-[10px] font-semibold tracking-wider text-red-300 uppercase transition hover:border-red-500"
                        >
                          Remove image
                        </button>
                      </>
                    ) : (
                      <p className="text-[10px] text-zinc-500">
                        No image uploaded — built-in artwork is used.
                      </p>
                    )}
                  </div>
                ) : null}

                {panel.mediaType === "video" ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={(e) => {
                        handlePanelVideo(panelId, e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-gray-300"
                    />
                    {panel.mediaVideoUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPanelDrafts((prev) => ({
                              ...prev,
                              [panelId]: {
                                ...prev[panelId],
                                videoFile: null,
                                mediaVideoUrl: "",
                                removeVideo: true,
                              },
                            }))
                          }
                          className="rounded-full border border-red-900/60 px-3 py-1 text-[10px] font-semibold tracking-wider text-red-300 uppercase transition hover:border-red-500"
                        >
                          Remove video
                        </button>
                      </>
                    ) : (
                      <p className="text-[10px] text-zinc-500">
                        No video uploaded — built-in artwork is used. Max
                        50MB.
                      </p>
                    )}
                  </div>
                ) : null}

                {panel.mediaType === "youtube_link" ? (
                  <div className="space-y-1">
                    <input
                      type="url"
                      value={panel.mediaEmbedUrl ?? ""}
                      placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
                      onChange={(e) =>
                        updatePanel(panelId, "mediaEmbedUrl", e.target.value)
                      }
                      onFocus={() => beginTextEdit()}
                      onBlur={endTextEdit}
                      className="w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-white"
                    />
                    {(panel.mediaEmbedUrl || "").trim() ? (
                      parseVideoEmbed(panel.mediaEmbedUrl) ? (
                        <p className="text-[10px] text-emerald-400">
                          ✓ Valid — plays muted &amp; looped only while this
                          panel is on screen.
                        </p>
                      ) : (
                        <p className="text-[10px] text-red-300">
                          Must be a YouTube (watch / youtu.be / embed /
                          shorts), Vimeo, or direct .mp4/.webm URL.
                        </p>
                      )
                    ) : (
                      <p className="text-[10px] text-zinc-500">
                        Empty = built-in artwork fallback.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        {CARD_ORDER.map((cardKey) => {
          const card = drafts[cardKey];
          return (
            <div
              key={cardKey}
              className="space-y-4 rounded-xl border border-white/5 bg-black/40 p-5 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="font-bold text-amber-400 uppercase">
                  Card: {CARD_LABELS[cardKey]}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Display Order:</span>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={card.order}
                    onChange={(e) =>
                      updateCard(cardKey, "order", Number(e.target.value) || 1)
                    }
                    className="w-12 rounded border border-white/10 bg-white/5 px-2 py-1 text-center text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="mb-1 block text-gray-400">
                    Card Cover Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      void handlePhoto(cardKey, e.target.files?.[0] ?? null)
                    }
                    className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-gray-300"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.heroPhotoUrl}
                    alt=""
                    className="mt-2 aspect-[3/4] w-full max-w-[9rem] rounded-lg border border-white/10 object-cover"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-gray-400">
                    Title &amp; subtitle (mobile: left 1/3 · desktop: below
                    card)
                  </label>
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) =>
                      updateCard(cardKey, "title", e.target.value)
                    }
                    onFocus={() => beginTextEdit()}
                    onBlur={endTextEdit}
                    className="mb-2 w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-white"
                  />
                  <label className="mb-1 block text-gray-400">
                    Subtitle / Details
                  </label>
                  <input
                    type="text"
                    value={card.subtitle}
                    onChange={(e) =>
                      updateCard(cardKey, "subtitle", e.target.value)
                    }
                    onFocus={() => beginTextEdit()}
                    onBlur={endTextEdit}
                    className="w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-gray-400">
                    Japanese tag (expanded panel chip)
                  </label>
                  <input
                    type="text"
                    value={card.japaneseText}
                    onChange={(e) =>
                      updateCard(cardKey, "japaneseText", e.target.value)
                    }
                    onFocus={() => beginTextEdit()}
                    onBlur={endTextEdit}
                    className="mb-2 w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-white"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Shown as the chip on the expanded accordion panel. Click
                    Save changes when done.
                  </p>
                </div>
              </div>

              {/* Per-card accordion media */}
              <div className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <label className="block text-gray-400">
                  Media (expanded accordion panel)
                  <select
                    value={card.mediaType ?? "image"}
                    onChange={(e) =>
                      updateCard(
                        cardKey,
                        "mediaType",
                        e.target.value as HomepageHeroCardMediaType
                      )
                    }
                    className="mt-1 w-full rounded border border-white/10 bg-[#0A1017] px-3 py-1.5 text-white"
                  >
                    <option value="image">Image Upload</option>
                    <option value="video">Video Upload (.mp4/.webm)</option>
                    <option value="youtube_link">
                      Video Link (YouTube/Vimeo)
                    </option>
                  </select>
                </label>

                {(card.mediaType ?? "image") === "image" ? (
                  <p className="text-[10px] text-zinc-500">
                    Uses the Card Cover Photo above (accent gradient when no
                    photo is set).
                  </p>
                ) : null}

                {card.mediaType === "video" ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="video/mp4,video/webm"
                      onChange={(e) => {
                        handleVideo(cardKey, e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-gray-300"
                    />
                    {card.mediaVideoUrl ? (
                      <>
                        <video
                          src={card.mediaVideoUrl}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          className="aspect-video w-full max-w-xs rounded-lg border border-white/10 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveVideo(cardKey)}
                          className="rounded-full border border-red-900/60 px-3 py-1 text-[10px] font-semibold tracking-wider text-red-300 uppercase transition hover:border-red-500"
                        >
                          Remove video
                        </button>
                      </>
                    ) : (
                      <p className="text-[10px] text-zinc-500">
                        No video uploaded — expanded panel falls back to the
                        cover photo / gradient. Max 50MB.
                      </p>
                    )}
                  </div>
                ) : null}

                {card.mediaType === "youtube_link" ? (
                  <div className="space-y-1">
                    <input
                      type="url"
                      value={card.mediaEmbedUrl ?? ""}
                      placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
                      onChange={(e) =>
                        updateCard(cardKey, "mediaEmbedUrl", e.target.value)
                      }
                      onFocus={() => beginTextEdit()}
                      onBlur={endTextEdit}
                      className="w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-white"
                    />
                    {(card.mediaEmbedUrl || "").trim() ? (
                      parseVideoEmbed(card.mediaEmbedUrl) ? (
                        <p className="text-[10px] text-emerald-400">
                          ✓ Valid — plays muted &amp; looped only while this
                          panel is expanded.
                        </p>
                      ) : (
                        <p className="text-[10px] text-red-300">
                          Must be a YouTube (watch / youtu.be / embed /
                          shorts), Vimeo, or direct .mp4/.webm URL.
                        </p>
                      )
                    ) : (
                      <p className="text-[10px] text-zinc-500">
                        Empty = cover photo / gradient fallback.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void persist()}
        className="w-full rounded-xl bg-[#075473] py-3.5 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition-colors hover:bg-[#075473]/80 disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : saveStatus === "saved"
            ? "Saved — Save again"
            : "Save changes to PocketBase"}
      </button>
    </div>
  );
}
