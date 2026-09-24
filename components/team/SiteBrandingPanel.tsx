"use client";

import type PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  DEFAULT_SITE_BRANDING,
  brandingHeroUrl,
  brandingLogoUrl,
  brandingUiMediaUrl,
  fetchPublicBrandAssets,
  type PbBrandingUiItem,
  type PbSiteBranding,
  type PublicBrandAssets,
} from "@/lib/pocketbase/client";
import { BrandingUiCardsAdmin } from "@/components/team/BrandingUiCardsAdmin";
import { PreBuilderQuizBrandingAdmin } from "@/components/team/PreBuilderQuizBrandingAdmin";
import { BRAND_LOGO, LOCAL_FONTS } from "@/lib/brand";
import {
  SINGLE_DAY_BUILDER_CONFIG,
  SINGLE_DAY_BUILDER_HERO_KEY,
  SINGLE_DAY_HERO_PUBLIC_FALLBACK,
  writeBuilderSHeroLocalCache,
} from "@/config/mediaConfig";
import { BUILDER_S_HERO_CONFIG } from "@/config/teamConfig";
import { BRANDING_UI_FALLBACKS, isVideoFilename } from "@/lib/brandingUi";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

type PbClient = PocketBase;

const H1_OPTIONS = [LOCAL_FONTS.h1] as const;
const H2_OPTIONS = [LOCAL_FONTS.h2] as const;
const BODY_OPTIONS = [LOCAL_FONTS.body] as const;

const SD_FALLBACK = BRANDING_UI_FALLBACKS[SINGLE_DAY_BUILDER_HERO_KEY];

function coerceLocal(
  role: "h1" | "h2" | "body",
  value: string | undefined
): string {
  const v = (value || "").trim().toLowerCase();
  if (role === "h1") {
    if (v.includes("godiva")) return LOCAL_FONTS.h1;
    return LOCAL_FONTS.h1;
  }
  if (role === "h2") {
    if (v.includes("hanson") || v.includes("anton")) return LOCAL_FONTS.h2;
    return LOCAL_FONTS.h2;
  }
  if (v.includes("futura")) return LOCAL_FONTS.body;
  return LOCAL_FONTS.body;
}

export function SiteBrandingPanel({ getClient }: { getClient: () => PbClient }) {
  const [record, setRecord] = useState<PbSiteBranding | null>(null);
  const [publicAssets, setPublicAssets] = useState<PublicBrandAssets>({});
  const [main, setMain] = useState<string>(DEFAULT_SITE_BRANDING.hero_title_main);
  const [highlight, setHighlight] = useState<string>(
    DEFAULT_SITE_BRANDING.hero_title_highlight
  );
  const [subtitle, setSubtitle] = useState<string>(
    DEFAULT_SITE_BRANDING.hero_subtitle
  );
  const [fontH1, setFontH1] = useState<string>(DEFAULT_SITE_BRANDING.font_h1);
  const [fontH2, setFontH2] = useState<string>(DEFAULT_SITE_BRANDING.font_h2);
  const [fontBody, setFontBody] = useState<string>(
    DEFAULT_SITE_BRANDING.font_body
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [saveHeroToPublic, setSaveHeroToPublic] = useState(true);
  const [saveLogoToPublic, setSaveLogoToPublic] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const [heroPreview, setHeroPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // —— Builder S (single-day) hero via branding_ui_items ——
  const [sdRecord, setSdRecord] = useState<PbBrandingUiItem | null>(null);
  const [sdScript, setSdScript] = useState(
    SD_FALLBACK?.title || BUILDER_S_HERO_CONFIG.scriptAccent
  );
  const [sdPrefix, setSdPrefix] = useState(
    SD_FALLBACK?.ctaPrimary || BUILDER_S_HERO_CONFIG.mainTitlePrefix
  );
  const [sdSubtitle, setSdSubtitle] = useState(
    SD_FALLBACK?.subtitle || BUILDER_S_HERO_CONFIG.tagline
  );
  const [sdFile, setSdFile] = useState<File | null>(null);
  const [sdPreview, setSdPreview] = useState("");
  const [saveSdToPublic, setSaveSdToPublic] = useState(true);
  const [sdSaving, setSdSaving] = useState(false);
  const [sdMsg, setSdMsg] = useState<string | null>(null);
  const [sdError, setSdError] = useState<string | null>(null);
  const [brandingTab, setBrandingTab] = useState<"heroes" | "prebuilder">(
    "heroes"
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    setSdError(null);
    try {
      const pb = getClient();
      let rows = await pb
        .collection("site_branding")
        .getFullList<PbSiteBranding>();
      if (rows.length === 0) {
        const created = await pb.collection("site_branding").create({
          ...DEFAULT_SITE_BRANDING,
        });
        rows = [created as unknown as PbSiteBranding];
      }
      const row = rows[0];
      const assets = await fetchPublicBrandAssets();
      setPublicAssets(assets);
      setRecord(row);
      setMain(row.hero_title_main || DEFAULT_SITE_BRANDING.hero_title_main);
      setHighlight(
        row.hero_title_highlight || DEFAULT_SITE_BRANDING.hero_title_highlight
      );
      setSubtitle(row.hero_subtitle || DEFAULT_SITE_BRANDING.hero_subtitle);
      setFontH1(coerceLocal("h1", row.font_h1));
      setFontH2(coerceLocal("h2", row.font_h2));
      setFontBody(coerceLocal("body", row.font_body));
      setLogoPreview(brandingLogoUrl(row, assets));
      setHeroPreview(brandingHeroUrl(row, assets));
      setLogoFile(null);
      setHeroFile(null);

      // Single-day hero row
      let sdRows = await pb
        .collection("branding_ui_items")
        .getFullList<PbBrandingUiItem>({
          filter: `key = "${SINGLE_DAY_BUILDER_HERO_KEY}"`,
        });
      if (sdRows.length === 0) {
        const created = (await pb.collection("branding_ui_items").create({
          key: SINGLE_DAY_BUILDER_HERO_KEY,
          category: "builder",
          title: BUILDER_S_HERO_CONFIG.scriptAccent,
          subtitle: BUILDER_S_HERO_CONFIG.tagline,
          cta_primary: BUILDER_S_HERO_CONFIG.mainTitlePrefix,
          sort_order: 0,
        })) as unknown as PbBrandingUiItem;
        sdRows = [created];
      }
      const sd = sdRows[0];
      setSdRecord(sd);
      setSdScript(
        sd.title?.trim() ||
          SD_FALLBACK?.title ||
          BUILDER_S_HERO_CONFIG.scriptAccent
      );
      setSdPrefix(
        sd.cta_primary?.trim() ||
          SD_FALLBACK?.ctaPrimary ||
          BUILDER_S_HERO_CONFIG.mainTitlePrefix
      );
      setSdSubtitle(
        sd.subtitle?.trim() ||
          SD_FALLBACK?.subtitle ||
          BUILDER_S_HERO_CONFIG.tagline
      );
      const sdMedia =
        brandingUiMediaUrl(sd) ||
        assets.hero_single ||
        SINGLE_DAY_BUILDER_CONFIG.hero.fallbackImage ||
        SINGLE_DAY_HERO_PUBLIC_FALLBACK;
      setSdPreview(sdMedia);
      setSdFile(null);
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

  useEffect(() => {
    // Google Fonts injection disabled — TOKIOTOURS uses self-hosted faces only.
    for (const id of [
      "elite-admin-google-fonts",
      "tokio-google-fonts",
      "elite-google-fonts",
    ]) {
      document.getElementById(id)?.remove();
    }
  }, []);

  const savePublicAsset = async (
    kind: "hero" | "logo" | "hero_single",
    file: File
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch("/api/branding/public-asset", {
      method: "POST",
      body: fd,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      path?: string;
      error?: string;
      absolute?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || `Failed to save ${kind} to public/brand`);
    }
    return data;
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      fd.append("hero_title_main", main);
      fd.append("hero_title_highlight", highlight);
      fd.append("hero_subtitle", subtitle);
      fd.append("font_h1", coerceLocal("h1", fontH1));
      fd.append("font_h2", coerceLocal("h2", fontH2));
      fd.append("font_body", coerceLocal("body", fontBody));
      fd.append("google_fonts_url", "");
      if (logoFile) fd.append("logo_image", logoFile);
      if (heroFile) fd.append("hero_background_image", heroFile);

      let saved: PbSiteBranding;
      if (record?.id) {
        saved = (await pb
          .collection("site_branding")
          .update(record.id, fd)) as unknown as PbSiteBranding;
      } else {
        saved = (await pb
          .collection("site_branding")
          .create(fd)) as unknown as PbSiteBranding;
      }

      const notes: string[] = [];
      let nextAssets = { ...publicAssets };

      if (heroFile && saveHeroToPublic) {
        const result = await savePublicAsset("hero", heroFile);
        if (result.path) {
          nextAssets = { ...nextAssets, hero: result.path };
          notes.push(`Hero also saved to ${result.absolute || result.path}`);
        }
      }
      if (logoFile && saveLogoToPublic) {
        const result = await savePublicAsset("logo", logoFile);
        if (result.path) {
          nextAssets = { ...nextAssets, logo: result.path };
          notes.push(`Logo also saved to ${result.absolute || result.path}`);
        }
      }

      setPublicAssets(nextAssets);
      setRecord(saved);
      setLogoPreview(brandingLogoUrl(saved, nextAssets));
      setHeroPreview(brandingHeroUrl(saved, nextAssets));
      setLogoFile(null);
      setHeroFile(null);
      setMsg(
        [
          "Branding saved. Refresh the site to see typography updates.",
          ...notes,
        ].join(" ")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const saveSingleDayHero = async () => {
    setSdSaving(true);
    setSdMsg(null);
    setSdError(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      fd.append("title", sdScript);
      fd.append("cta_primary", sdPrefix);
      fd.append("subtitle", sdSubtitle);
      fd.append("key", SINGLE_DAY_BUILDER_HERO_KEY);
      fd.append("category", "builder");
      if (sdFile) fd.append("media", sdFile);

      let saved: PbBrandingUiItem;
      if (sdRecord?.id) {
        saved = (await pb
          .collection("branding_ui_items")
          .update(sdRecord.id, fd)) as unknown as PbBrandingUiItem;
      } else {
        fd.append("sort_order", "0");
        saved = (await pb
          .collection("branding_ui_items")
          .create(fd)) as unknown as PbBrandingUiItem;
      }

      const notes: string[] = [];
      let nextAssets = { ...publicAssets };
      if (
        sdFile &&
        saveSdToPublic &&
        !isVideoFilename(sdFile.name)
      ) {
        const result = await savePublicAsset("hero_single", sdFile);
        if (result.path) {
          nextAssets = { ...nextAssets, hero_single: result.path };
          notes.push(
            `Single-day hero also saved to ${result.absolute || result.path}`
          );
        }
      } else if (sdFile && saveSdToPublic && isVideoFilename(sdFile.name)) {
        notes.push(
          "Video kept in PocketBase only (public/brand accepts images)."
        );
      }

      setPublicAssets(nextAssets);
      setSdRecord(saved);
      const resolvedMedia =
        brandingUiMediaUrl(saved) ||
        nextAssets.hero_single ||
        SINGLE_DAY_BUILDER_CONFIG.hero.fallbackImage;
      setSdPreview(resolvedMedia);
      setSdFile(null);
      writeBuilderSHeroLocalCache({
        scriptAccent: sdScript,
        mainTitlePrefix: sdPrefix,
        tagline: sdSubtitle,
        mediaUrl: resolvedMedia || undefined,
      });
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });
      setSdMsg(["Builder S hero saved.", ...notes].join(" "));
    } catch (e) {
      setSdError(e instanceof Error ? e.message : formatPbError(e));
    } finally {
      setSdSaving(false);
    }
  };

  if (loading && brandingTab === "heroes") {
    return <p className="text-sm text-zinc-400">Loading site branding…</p>;
  }

  const sdPreviewIsVideo =
    (sdFile && isVideoFilename(sdFile.name)) || isVideoFilename(sdPreview);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4">
        <button
          type="button"
          onClick={() => setBrandingTab("heroes")}
          className={
            brandingTab === "heroes"
              ? "rounded-full border border-[#1CA67F]/60 bg-[#1CA67F]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6ee7b7]"
              : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
          }
        >
          Global &amp; Heroes
        </button>
        <button
          type="button"
          onClick={() => setBrandingTab("prebuilder")}
          className={
            brandingTab === "prebuilder"
              ? "rounded-full border border-[#075473] bg-[#075473]/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7dd3fc]"
              : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
          }
        >
          Pre-Builder Match Quiz
        </button>
      </div>

      {brandingTab === "prebuilder" ? (
        <PreBuilderQuizBrandingAdmin getClient={getClient} />
      ) : (
        <>
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-zinc-100">Site Branding</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Controls the builder navbar logo and Multi-Day / Single-Day hero
          sections. One active site_branding record plus Builder S UI card.
        </p>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}

        <div className="mt-6">
          <UploadField
            label="Logo image"
            hint="Navbar logo (PNG/SVG recommended)"
            preview={logoPreview}
            previewClass="h-16 w-auto max-w-full object-contain"
            onFile={(f) => {
              setLogoFile(f);
              if (f) setLogoPreview(URL.createObjectURL(f));
            }}
            publicOption={{
              checked: saveLogoToPublic,
              onChange: setSaveLogoToPublic,
              pathHint: publicAssets.logo
                ? `Current public file: ${publicAssets.logo}`
                : "Saves a copy to public/brand/site-logo.*",
            }}
          />
        </div>
      </div>

      {/* —— MULTI-DAY HERO (BUILDER M) —— */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl text-zinc-100">
            Multi-Day Hero (Builder M)
          </h2>
          <span className="rounded-md border border-[#075473]/50 bg-[#075473]/15 px-2 py-0.5 font-geosans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#075473]">
            Builder M
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Full-bleed hero background and copy on the multi-day trip builder.
        </p>

        <div className="mt-6">
          <UploadField
            label="Hero background"
            hint="Wide landscape · ideal 2400×1400 JPG/WebP"
            preview={heroPreview}
            previewClass="aspect-[16/9] w-full object-cover"
            onFile={(f) => {
              setHeroFile(f);
              if (f) setHeroPreview(URL.createObjectURL(f));
            }}
            publicOption={{
              checked: saveHeroToPublic,
              onChange: setSaveHeroToPublic,
              pathHint: publicAssets.hero
                ? `Current public file: ${publicAssets.hero}`
                : "Saves a copy to public/brand/hero-background.*",
            }}
          />
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Main title (navy / white)
            <input
              type="text"
              value={main}
              onChange={(e) => setMain(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Highlighted title (gold)
            <input
              type="text"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Subtitle
            <textarea
              rows={2}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
        </div>
      </div>

      {/* —— SINGLE-DAY HERO (BUILDER S) —— */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl text-zinc-100 sm:text-2xl">
            BUILDER S (SINGLE-DAY TOUR) HERO CONFIGURATION
          </h2>
          <span className="rounded-md border border-[#1CA67F]/50 bg-[#1CA67F]/15 px-2 py-0.5 font-geosans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#1CA67F]">
            Builder S Active
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Upload and swap the Single-Day hero media + copy for{" "}
          <code className="text-zinc-300">/builder-single</code>. Saves to
          PocketBase{" "}
          <code className="text-zinc-300">branding_ui_items</code> key{" "}
          <code className="text-zinc-300">{SINGLE_DAY_BUILDER_HERO_KEY}</code>{" "}
          and mirrors to localStorage for instant live updates.
        </p>

        {sdError ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {sdError}
          </p>
        ) : null}
        {sdMsg ? <p className="mt-3 text-sm text-emerald-700">{sdMsg}</p> : null}

        <div className="mt-6">
          <UploadField
            label="Hero media"
            hint="Landscape photo (.jpg, .webp) or video (.mp4) · ideal 2400×1400"
            preview={sdPreview}
            previewClass="aspect-[16/9] w-full object-cover"
            accept="image/*,video/mp4,video/webm,video/quicktime,.m4v"
            previewIsVideo={sdPreviewIsVideo}
            onFile={(f) => {
              setSdFile(f);
              if (f) setSdPreview(URL.createObjectURL(f));
            }}
            publicOption={{
              checked: saveSdToPublic,
              onChange: setSaveSdToPublic,
              label:
                "Also save to project public assets (/brand/hero-single-day.jpg)",
              pathHint: publicAssets.hero_single
                ? `Current public file: ${publicAssets.hero_single}`
                : "Images only · video stays in PocketBase",
            }}
          />
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Script overlay text
            <input
              type="text"
              value={sdScript}
              onChange={(e) => setSdScript(e.target.value)}
              placeholder='e.g. "Day Tour!" or "Japan!"'
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-beauty text-lg text-[#E11D48]"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Main title prefix (Godiva · UPPERCASE)
            <input
              type="text"
              value={sdPrefix}
              onChange={(e) => setSdPrefix(e.target.value)}
              placeholder='e.g. "YOUR DAY IN"'
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-godiva text-sm uppercase tracking-wider text-zinc-100"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Subtitle / tagline description
            <textarea
              rows={2}
              value={sdSubtitle}
              onChange={(e) => setSdSubtitle(e.target.value)}
              placeholder='e.g. "Discover Japan in 1 Day — Curated Experiences & Private Transit."'
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={sdSaving}
          onClick={() => void saveSingleDayHero()}
          className="mt-6 rounded-full bg-[#1CA67F] px-6 py-3 text-sm font-semibold text-zinc-100 shadow-sm transition hover:bg-[#178f6d] disabled:opacity-50"
        >
          {sdSaving ? "Saving…" : "Save Builder S Hero"}
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-zinc-100">
          Typography Settings
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Locked to self-hosted TOKIOTOURS faces in{" "}
          <code className="text-zinc-300">public/fonts</code>. Google Fonts are
          disabled.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FontSelect
            label="H1 Font Family (Main Titles)"
            value={fontH1}
            options={H1_OPTIONS}
            onChange={setFontH1}
          />
          <FontSelect
            label="H2 Font Family (Subtitles)"
            value={fontH2}
            options={H2_OPTIONS}
            onChange={setFontH2}
          />
          <FontSelect
            label="Body Font Family"
            value={fontBody}
            options={BODY_OPTIONS}
            onChange={setFontBody}
          />
          <LockedFontField
            label="Caption Font Family"
            value={LOCAL_FONTS.caption}
          />
          <LockedFontField
            label={`Display Keyword ("Japan")`}
            value={LOCAL_FONTS.beauty}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="mb-3 font-geosans text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[#075473]">
            Live preview
          </p>
          <p className="font-godiva text-3xl text-zinc-100">
            Heading 1 — {LOCAL_FONTS.h1}
          </p>
          <p className="mt-2 font-hanson text-2xl text-zinc-100">
            Heading 2 — {LOCAL_FONTS.h2}
          </p>
          <p className="mt-3 font-futura text-sm leading-relaxed text-zinc-300">
            Body text — {LOCAL_FONTS.body}. Design every detail. We&apos;ll take
            care of the rest.
          </p>
          <p className="mt-2 font-geosans text-xs text-zinc-500">
            Caption — {LOCAL_FONTS.caption}
          </p>
          <p className="mt-3 text-2xl text-[#E11D48]">
            <span className="japan-keyword">{LOCAL_FONTS.beauty}</span>
            <span className="ml-2 font-futura text-sm text-zinc-400">
              styles “Japan”
            </span>
          </p>
          <div className="mt-4 flex items-center gap-3 border-t border-zinc-800 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_LOGO}
              alt="TOKIOTOURS"
              className="h-12 w-12 rounded-full object-cover"
            />
            <p className="font-geosans text-xs text-zinc-500">
              Brand emblem · tokiotours-logo.png
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-full bg-[#1CA67F] px-6 py-3 text-sm font-semibold text-zinc-100 shadow-sm transition hover:bg-[#178f6d] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Branding Updates"}
      </button>

      <div className="rounded-2xl border border-[#075473]/35 bg-[#075473]/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#075473]">
          Promote · Value Proposition
        </p>
        <p className="mt-2 text-sm text-zinc-300">
          Edit &quot;The TOKIOTOURS Difference&quot; card below (header, core
          hook, bullets, Why Book copy, and self-guided vs Elite comparison
          lines). It surfaces on Builder Tours, experience detail modals, and
          the Budget Planner.
        </p>
      </div>

      <div className="rounded-2xl border border-[#075473]/35 bg-[#075473]/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#075473]">
          Promote · Budget Planner
        </p>
        <p className="mt-2 text-sm text-zinc-300">
          Use the Budget Planner card below to set eyebrow, headline, subtitle,
          and hero image shown on{" "}
          <a
            href="/budget-planner"
            target="_blank"
            rel="noreferrer"
            className="text-[#075473] underline-offset-2 hover:underline"
          >
            /budget-planner
          </a>
          . Link this page from campaigns when guests have a fixed spend limit.
        </p>
      </div>

      <BrandingUiCardsAdmin getClient={getClient} />
        </>
      )}
    </div>
  );
}

function FontSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs uppercase tracking-wider text-zinc-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function LockedFontField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-xs uppercase tracking-wider text-zinc-400">
      {label}
      <input
        type="text"
        value={value}
        readOnly
        className="mt-1 w-full cursor-not-allowed rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-300"
      />
    </label>
  );
}

function UploadField({
  label,
  hint,
  preview,
  previewClass,
  onFile,
  publicOption,
  accept = "image/*",
  previewIsVideo = false,
}: {
  label: string;
  hint: string;
  preview: string;
  previewClass: string;
  onFile: (f: File | null) => void;
  publicOption?: {
    checked: boolean;
    onChange: (v: boolean) => void;
    pathHint: string;
    /** Override the default “Also save to project public assets” label */
    label?: string;
  };
  accept?: string;
  previewIsVideo?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p className="mb-2 text-xs text-[#A39A8E]">{hint}</p>
      <div className="overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-4">
        {preview ? (
          previewIsVideo ? (
            <video
              src={preview}
              className={`mx-auto rounded-xl ${previewClass}`}
              muted
              playsInline
              controls
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className={`mx-auto rounded-xl ${previewClass}`}
            />
          )
        ) : (
          <div className="flex h-28 items-center justify-center text-sm text-zinc-400">
            No media yet
          </div>
        )}
        <input
          type="file"
          accept={accept}
          className="mt-3 block w-full text-sm text-zinc-300"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {publicOption ? (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-zinc-100">
            <input
              type="checkbox"
              checked={publicOption.checked}
              onChange={(e) => publicOption.onChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-700 accent-[#075473]"
            />
            <span>
              <span className="font-medium">
                {publicOption.label ||
                  "Also save to project public assets"}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-400">
                {publicOption.pathHint}
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </div>
  );
}
