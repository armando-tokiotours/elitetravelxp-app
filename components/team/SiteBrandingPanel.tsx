"use client";

import type PocketBase from "pocketbase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  DEFAULT_SITE_BRANDING,
  brandingLogoUrl,
  fetchPublicBrandAssets,
  type PbBrandingUiItem,
  type PbSiteBranding,
  type PublicBrandAssets,
} from "@/lib/pocketbase/client";
import { DEFAULT_CONCIERGE_ESTIMATE_COPY } from "@/lib/conciergeEstimateFlow";
import { BrandingUiCardsAdmin } from "@/components/team/BrandingUiCardsAdmin";
import { HomepageHeroCardsAdminStudio } from "@/components/team/HomepageHeroCardsAdminStudio";
import { PreBuilderQuizBrandingAdmin } from "@/components/team/PreBuilderQuizBrandingAdmin";
import { TransportCardsBrandingAdmin } from "@/components/team/TransportCardsBrandingAdmin";
import { BrandingUiKeysAdmin } from "@/components/team/BrandingUiKeysAdmin";
import { MultiTransportExplainersAdmin } from "@/components/team/MultiTransportExplainersAdmin";
import { SiteBrandingIcons } from "@/components/team/SiteBrandingIcons";
import { BRAND_LOGO, BRAND_DESCRIPTION, BRAND_TITLE, LOCAL_FONTS } from "@/lib/brand";
import {
  SINGLE_DAY_BUILDER_HERO_KEY,
  writeBuilderSHeroLocalCache,
} from "@/config/mediaConfig";
import { BUILDER_S_HERO_CONFIG } from "@/config/teamConfig";
import { BRANDING_UI_FALLBACKS } from "@/lib/brandingUi";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { uploadToVps } from "@/lib/vpsUploadClient";
import {
  BUILDER_ACTIVITIES_HERO_KEY,
  brandingSlotVersionedUrl,
  brandingSlotWebUrl,
  builderHeroSlot,
} from "@/lib/brandingImageSlots";
import { preEliteMediaVersion } from "@/lib/preEliteBranding";

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
  const [documentTitle, setDocumentTitle] = useState<string>(
    DEFAULT_SITE_BRANDING.document_title
  );
  const [documentDescription, setDocumentDescription] = useState<string>(
    DEFAULT_SITE_BRANDING.document_description
  );
  const [fontH1, setFontH1] = useState<string>(DEFAULT_SITE_BRANDING.font_h1);
  const [fontH2, setFontH2] = useState<string>(DEFAULT_SITE_BRANDING.font_h2);
  const [fontBody, setFontBody] = useState<string>(
    DEFAULT_SITE_BRANDING.font_body
  );
  const [estimateTitle, setEstimateTitle] = useState(
    DEFAULT_CONCIERGE_ESTIMATE_COPY.estimateModalTitle
  );
  const [estimateSub, setEstimateSub] = useState(
    DEFAULT_CONCIERGE_ESTIMATE_COPY.estimatePerDaySubtext
  );
  const [feeAmount, setFeeAmount] = useState(
    String(DEFAULT_CONCIERGE_ESTIMATE_COPY.feeAmountEur)
  );
  const [feePolicy, setFeePolicy] = useState(
    DEFAULT_CONCIERGE_ESTIMATE_COPY.feePolicyText
  );
  const [feeModalTitle, setFeeModalTitle] = useState(
    DEFAULT_CONCIERGE_ESTIMATE_COPY.feeModalTitle
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [saveLogoToPublic, setSaveLogoToPublic] = useState(false);
  const [saveFaviconToPublic, setSaveFaviconToPublic] = useState(true);
  const [logoPreview, setLogoPreview] = useState("");
  const [heroPreview, setHeroPreview] = useState("");
  const [faviconPreview, setFaviconPreview] = useState("");
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
  const [sdSaving, setSdSaving] = useState(false);
  const [sdMsg, setSdMsg] = useState<string | null>(null);
  const [sdError, setSdError] = useState<string | null>(null);
  // —— Activities hero (Builder E) via branding_ui_items + slot ——
  const [actRecord, setActRecord] = useState<PbBrandingUiItem | null>(null);
  const [actFile, setActFile] = useState<File | null>(null);
  const [actPreview, setActPreview] = useState(() =>
    brandingSlotWebUrl(builderHeroSlot("activities"))
  );
  const [actSaving, setActSaving] = useState(false);
  const [actMsg, setActMsg] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [brandingTab, setBrandingTab] = useState<
    | "heroes"
    | "torii"
    | "prebuilder"
    | "transport"
    | "pace"
    | "explanations"
    | "icons"
  >("heroes");
  const [heroesSubTab, setHeroesSubTab] = useState<
    "site" | "multiday" | "singleday" | "activities" | "typography" | "value"
  >("site");
  const [transportSubTab, setTransportSubTab] = useState<
    "cards" | "movement"
  >("cards");
  const [explanationsSubTab, setExplanationsSubTab] = useState<
    "movement" | "pace" | "multi"
  >("movement");

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
      setDocumentTitle(
        row.document_title?.trim() ||
          DEFAULT_SITE_BRANDING.document_title ||
          BRAND_TITLE
      );
      setDocumentDescription(
        row.document_description?.trim() ||
          DEFAULT_SITE_BRANDING.document_description ||
          BRAND_DESCRIPTION
      );
      setFontH1(coerceLocal("h1", row.font_h1));
      setFontH2(coerceLocal("h2", row.font_h2));
      setFontBody(coerceLocal("body", row.font_body));
      setEstimateTitle(
        row.estimate_modal_title ||
          DEFAULT_CONCIERGE_ESTIMATE_COPY.estimateModalTitle
      );
      setEstimateSub(
        row.estimate_per_day_subtext ||
          DEFAULT_CONCIERGE_ESTIMATE_COPY.estimatePerDaySubtext
      );
      setFeeAmount(
        row.concierge_fee_amount ||
          String(DEFAULT_CONCIERGE_ESTIMATE_COPY.feeAmountEur)
      );
      setFeePolicy(
        row.concierge_fee_policy_text ||
          DEFAULT_CONCIERGE_ESTIMATE_COPY.feePolicyText
      );
      setFeeModalTitle(
        row.concierge_fee_modal_title ||
          DEFAULT_CONCIERGE_ESTIMATE_COPY.feeModalTitle
      );
      setLogoPreview(brandingLogoUrl(row, assets));
      // Multi-Day hero: the ONE slot (no media_version source on
      // site_branding, so bare slot URL — replaces overwrite in place).
      setHeroPreview(brandingSlotWebUrl(builderHeroSlot("multiday")));
      setFaviconPreview(assets.favicon || "/brand/favicon.png");
      setLogoFile(null);
      setHeroFile(null);
      setFaviconFile(null);

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
      setSdPreview(
        brandingSlotVersionedUrl(
          builderHeroSlot("single"),
          preEliteMediaVersion(sd)
        )
      );
      setSdFile(null);
      // Activities hero row (created on first save if missing)
      const actRows = await pb
        .collection("branding_ui_items")
        .getFullList<PbBrandingUiItem>({
          filter: `key = "${BUILDER_ACTIVITIES_HERO_KEY}"`,
        });
      const act = actRows[0] || null;
      setActRecord(act);
      setActPreview(
        brandingSlotVersionedUrl(
          builderHeroSlot("activities"),
          preEliteMediaVersion(act)
        )
      );
      setActFile(null);
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
    kind: "hero" | "logo" | "hero_single" | "favicon",
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
      fd.append(
        "document_title",
        documentTitle.trim() || DEFAULT_SITE_BRANDING.document_title
      );
      fd.append(
        "document_description",
        documentDescription.trim() ||
          DEFAULT_SITE_BRANDING.document_description
      );
      fd.append("font_h1", coerceLocal("h1", fontH1));
      fd.append("font_h2", coerceLocal("h2", fontH2));
      fd.append("font_body", coerceLocal("body", fontBody));
      fd.append("google_fonts_url", "");
      fd.append("estimate_modal_title", estimateTitle);
      fd.append("estimate_per_day_subtext", estimateSub);
      fd.append("concierge_fee_amount", feeAmount);
      fd.append("concierge_fee_policy_text", feePolicy);
      fd.append("concierge_fee_modal_title", feeModalTitle);
      if (logoFile) fd.append("logo_image", logoFile);
      // Hero image → the ONE multiday slot (never a PB binary / public/brand copy)
      if (heroFile) {
        await uploadToVps(heroFile, "branding", pb.authStore.token || "", {
          stableKey: builderHeroSlot("multiday"),
        });
      }

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

      if (heroFile) {
        notes.push(
          `Multi-Day hero saved to slot ${builderHeroSlot("multiday")} (/uploads/branding/${builderHeroSlot("multiday")}.webp)`
        );
      }
      if (logoFile && saveLogoToPublic) {
        const result = await savePublicAsset("logo", logoFile);
        if (result.path) {
          nextAssets = { ...nextAssets, logo: result.path };
          notes.push(`Logo also saved to ${result.absolute || result.path}`);
        }
      }
      if (faviconFile && saveFaviconToPublic) {
        const result = await savePublicAsset("favicon", faviconFile);
        if (result.path) {
          nextAssets = { ...nextAssets, favicon: result.path };
          notes.push(`Favicon saved to ${result.absolute || result.path}`);
        }
      }

      setPublicAssets(nextAssets);
      setRecord(saved);
      setLogoPreview(brandingLogoUrl(saved, nextAssets));
      setHeroPreview(
        heroFile
          ? `${brandingSlotWebUrl(builderHeroSlot("multiday"))}?v=${Date.now()}`
          : brandingSlotWebUrl(builderHeroSlot("multiday"))
      );
      setFaviconPreview(nextAssets.favicon || "/brand/favicon.png");
      setLogoFile(null);
      setHeroFile(null);
      setFaviconFile(null);
      if (typeof document !== "undefined") {
        const nextTitle =
          documentTitle.trim() || DEFAULT_SITE_BRANDING.document_title;
        document.title = nextTitle;
      }
      setMsg(
        [
          "Branding saved. Tab title updates immediately; refresh for other live pages.",
          ...notes,
        ].join(" ")
      );
    } catch (e) {
      setError(formatPbError(e));
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
      // Image → the ONE single-day slot; clear PB media + stamp version
      const stamp = sdFile ? String(Date.now()) : "";
      if (sdFile) {
        await uploadToVps(sdFile, "branding", pb.authStore.token || "", {
          stableKey: builderHeroSlot("single"),
        });
      }
      const fd = new FormData();
      fd.append("title", sdScript);
      fd.append("cta_primary", sdPrefix);
      fd.append("subtitle", sdSubtitle);
      fd.append("key", SINGLE_DAY_BUILDER_HERO_KEY);
      fd.append("category", "builder");
      if (sdFile) {
        fd.append("media", "");
        fd.append("poster", "");
        fd.append("media_version", stamp);
      }

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

      const resolvedMedia = brandingSlotVersionedUrl(
        builderHeroSlot("single"),
        stamp || preEliteMediaVersion(saved)
      );
      setSdRecord(saved);
      setSdPreview(resolvedMedia);
      setSdFile(null);
      writeBuilderSHeroLocalCache({
        scriptAccent: sdScript,
        mainTitlePrefix: sdPrefix,
        tagline: sdSubtitle,
        mediaUrl: resolvedMedia || undefined,
      });
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });
      setSdMsg(
        `Builder S hero saved to slot ${builderHeroSlot("single")} (/uploads/branding/${builderHeroSlot("single")}.webp).`
      );
    } catch (e) {
      setSdError(formatPbError(e));
    } finally {
      setSdSaving(false);
    }
  };

  const saveActivitiesHero = async () => {
    setActSaving(true);
    setActMsg(null);
    setActError(null);
    try {
      const pb = getClient();
      const stamp = actFile ? String(Date.now()) : "";
      if (actFile) {
        await uploadToVps(actFile, "branding", pb.authStore.token || "", {
          stableKey: builderHeroSlot("activities"),
        });
      }
      const fd = new FormData();
      fd.append("key", BUILDER_ACTIVITIES_HERO_KEY);
      fd.append("category", "builder");
      fd.append("title", "VIP Tickets");
      fd.append("subtitle", "VIP Tickets & Local Access");
      if (actFile) {
        fd.append("media", "");
        fd.append("media_version", stamp);
      }
      let saved: PbBrandingUiItem;
      if (actRecord?.id) {
        saved = (await pb
          .collection("branding_ui_items")
          .update(actRecord.id, fd)) as unknown as PbBrandingUiItem;
      } else {
        fd.append("sort_order", "0");
        saved = (await pb
          .collection("branding_ui_items")
          .create(fd)) as unknown as PbBrandingUiItem;
      }
      setActRecord(saved);
      setActPreview(
        brandingSlotVersionedUrl(
          builderHeroSlot("activities"),
          stamp || preEliteMediaVersion(saved)
        )
      );
      setActFile(null);
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });
      setActMsg(
        `Activities hero saved to slot ${builderHeroSlot("activities")} (/uploads/branding/${builderHeroSlot("activities")}.webp).`
      );
    } catch (e) {
      setActError(formatPbError(e));
    } finally {
      setActSaving(false);
    }
  };

  if (loading && brandingTab === "heroes") {
    return <p className="text-sm text-zinc-400">Loading site branding…</p>;
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 overflow-x-auto border-b border-zinc-800 pb-4">
        {(
          [
            ["heroes", "Global & Heroes"],
            ["torii", "Main Intro"],
            ["prebuilder", "Pre-Builder Match Quiz"],
            ["transport", "Transport"],
            ["pace", "Travel Pace"],
            ["explanations", "Explanations"],
            ["icons", "ICONS"],
          ] as const
        ).map(([id, label]) => {
          const active = brandingTab === id;
          const activeClass =
            id === "heroes"
              ? "rounded-full border border-[#1CA67F]/60 bg-[#1CA67F]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6ee7b7]"
              : id === "torii"
                ? "rounded-full border border-cyan-400 bg-[#075473] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                : id === "transport"
                  ? "rounded-full border border-[#F6A724]/70 bg-[#F6A724]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F6A724]"
                  : id === "pace"
                    ? "rounded-full border border-[#DC6E8A]/70 bg-[#DC6E8A]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f9a8c0]"
                    : id === "explanations"
                      ? "rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                      : id === "icons"
                        ? "rounded-full border border-[#F6A724]/70 bg-[#F6A724]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F6A724]"
                        : "rounded-full border border-[#075473] bg-[#075473]/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7dd3fc]";
          return (
            <button
              key={id}
              type="button"
              onClick={() => setBrandingTab(id)}
              className={
                active
                  ? activeClass
                  : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {brandingTab === "icons" ? (
        <SiteBrandingIcons getClient={getClient} />
      ) : brandingTab === "prebuilder" ? (
        <PreBuilderQuizBrandingAdmin getClient={getClient} />
      ) : brandingTab === "torii" ? (
        <HomepageHeroCardsAdminStudio getClient={getClient} />
      ) : brandingTab === "transport" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <h2 className="font-display text-2xl text-zinc-100">Transport</h2>
            <p className="mt-1 text-sm text-zinc-400">
              In-city + Inter-city arrangement cards (separate keys) and
              Single-day Preferred Movement (Walking / Subway / Private Driver).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 overflow-x-auto border-b border-zinc-800 pb-4">
            {(
              [
                ["cards", "Transport Cards"],
                ["movement", "Preferred Movement"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTransportSubTab(id)}
                className={
                  transportSubTab === id
                    ? "rounded-full border border-[#F6A724]/70 bg-[#F6A724]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F6A724]"
                    : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
                }
              >
                {label}
              </button>
            ))}
          </div>
          {transportSubTab === "cards" ? (
            <TransportCardsBrandingAdmin getClient={getClient} />
          ) : (
            <BrandingUiKeysAdmin
              getClient={getClient}
              keys={[
                "transit_subway",
                "transit_private_driver",
                "transit_mix",
                "transit_walk",
              ]}
              title="Single-day · Preferred movement"
              description="Photo, title, and subtitle on the three boxes in Builder S Transport. Detail-page copy is under Explanations."
              fieldMode="card"
              accent="#075473"
            />
          )}
        </div>
      ) : brandingTab === "pace" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <h2 className="font-display text-2xl text-zinc-100">Travel Pace</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Control the photo, title, and subtitle for each pace box (Fast /
              Moderate / Relaxed) used in Multi and Single Party &amp; Pace.
            </p>
          </div>
          <BrandingUiKeysAdmin
            getClient={getClient}
            keys={["pace_fast", "pace_moderate", "pace_relaxed"]}
            title="Pace boxes"
            description="One card per pace. Explanations (detail page body) live in the Explanations tab."
            fieldMode="card"
            accent="#DC6E8A"
          />
        </div>
      ) : brandingTab === "explanations" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
            <h2 className="font-display text-2xl text-zinc-100">Explanations</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Longer copy shown when a guest opens a transport or pace detail
              page. Keep card photos/titles in Transport and Travel Pace tabs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 overflow-x-auto border-b border-zinc-800 pb-4">
            {(
              [
                ["movement", "Movement Details"],
                ["pace", "Pace Details"],
                ["multi", "Multi Transport"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setExplanationsSubTab(id)}
                className={
                  explanationsSubTab === id
                    ? "rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
                    : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
                }
              >
                {label}
              </button>
            ))}
          </div>
          {explanationsSubTab === "movement" ? (
            <BrandingUiKeysAdmin
              getClient={getClient}
              keys={[
                "transit_subway",
                "transit_private_driver",
                "transit_mix",
                "transit_walk",
              ]}
              title="Single-day · Movement detail pages"
              description="Body text on Walking / Subway / Private Driver detail modals."
              fieldMode="explanation"
              accent="#075473"
            />
          ) : explanationsSubTab === "pace" ? (
            <BrandingUiKeysAdmin
              getClient={getClient}
              keys={["pace_fast", "pace_moderate", "pace_relaxed"]}
              title="Travel Pace · Detail pages"
              description="Body text on Fast / Moderate / Relaxed pace detail modals."
              fieldMode="explanation"
              accent="#DC6E8A"
            />
          ) : (
            <MultiTransportExplainersAdmin getClient={getClient} />
          )}
        </div>
      ) : (
        <>
      <div className="flex flex-wrap gap-2 overflow-x-auto border-b border-zinc-800 pb-4">
        {(
          [
            ["site", "Site Branding"],
            ["multiday", "Builder M Hero"],
            ["singleday", "Builder S Hero"],
            ["activities", "Activities Hero"],
            ["typography", "Typography"],
            ["value", "Value Proposition"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setHeroesSubTab(id)}
            className={
              heroesSubTab === id
                ? "rounded-full border border-[#1CA67F]/60 bg-[#1CA67F]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6ee7b7]"
                : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {heroesSubTab === "site" ? (
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-zinc-100">Site Branding</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Controls the builder navbar logo and Multi-Day / Single-Day hero
          sections. One active site_branding record plus Builder S UI card.
        </p>
        <Link
          href="/team-access/layout-builder?tab=heroes"
          className="mt-4 inline-flex rounded-xl border border-[#075473] bg-[#075473]/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7dd3fc] transition hover:bg-[#075473]/35"
        >
          Layout &amp; characters →
        </Link>
        <Link
          href="/team-access/layout-builder?tab=hi_bubble"
          className="mt-3 ml-2 inline-flex rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-300 transition hover:border-[#075473] hover:text-[#7dd3fc]"
        >
          HI bubble →
        </Link>

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
          <div className="mt-6 space-y-3 rounded-xl border border-[#F6A724]/25 bg-[#F6A724]/5 p-4">
            <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
              Estimate &amp; €60 Deposit copy
            </p>
            <label className="block text-xs text-zinc-400">
              Estimate modal title
              <input
                value={estimateTitle}
                onChange={(e) => setEstimateTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Per-day subtext (use {"{pax}"}, {"{days}"}, {"{total}"})
              <input
                value={estimateSub}
                onChange={(e) => setEstimateSub(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Concierge fee amount (EUR)
              <input
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Fee modal title
              <input
                value={feeModalTitle}
                onChange={(e) => setFeeModalTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Fee policy text
              <textarea
                value={feePolicy}
                onChange={(e) => setFeePolicy(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              Browser tab title
            </p>
            <p className="text-xs text-zinc-500">
              Shown in the browser tab and social previews. Empty fields use the
              defaults.
            </p>
            <label className="block text-xs text-zinc-400">
              Tab title
              <input
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder={BRAND_TITLE}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Meta description
              <textarea
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                placeholder={BRAND_DESCRIPTION}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
              />
            </label>
          </div>
          <div className="mt-6">
            <UploadField
              label="Tab icon (favicon)"
              hint="Browser tab icon · square PNG recommended (uses Tokio cat mark by default)"
              preview={faviconPreview}
              previewClass="h-12 w-12 object-contain"
              onFile={(f) => {
                setFaviconFile(f);
                if (f) setFaviconPreview(URL.createObjectURL(f));
              }}
              publicOption={{
                checked: saveFaviconToPublic,
                onChange: setSaveFaviconToPublic,
                pathHint: publicAssets.favicon
                  ? `Current: ${publicAssets.favicon}`
                  : "Saves to public/brand/favicon.png",
              }}
            />
          </div>
        </div>
      </div>
      ) : null}

      {heroesSubTab === "multiday" ? (
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
            hint={`Slot ${builderHeroSlot("multiday")} · /uploads/branding/${builderHeroSlot("multiday")}.webp · wide landscape · image only — numbered placeholder until you upload`}
            preview={heroPreview}
            previewClass="aspect-[16/9] w-full object-cover"
            accept="image/*"
            onFile={(f) => {
              setHeroFile(f);
              if (f) setHeroPreview(URL.createObjectURL(f));
            }}
          />
          <p className="mt-2 text-[11px] text-zinc-500">
            Slot ID: {builderHeroSlot("multiday")} — this same image is edited
            in Layout &amp; Characters → Heroes. One image, one ID, everywhere.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="mt-6 rounded-full bg-[#1CA67F] px-6 py-3 text-sm font-semibold text-zinc-100 shadow-sm transition hover:bg-[#178f6d] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Multi-Day Hero"}
        </button>

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
      ) : null}

      {heroesSubTab === "singleday" ? (
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
            hint={`Slot ${builderHeroSlot("single")} · /uploads/branding/${builderHeroSlot("single")}.webp · landscape photo · image only — numbered placeholder until you upload. Same image in Layout & Characters → Heroes.`}
            preview={sdPreview}
            previewClass="aspect-[16/9] w-full object-cover"
            accept="image/*"
            onFile={(f) => {
              setSdFile(f);
              if (f) setSdPreview(URL.createObjectURL(f));
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
      ) : null}

      {heroesSubTab === "activities" ? (
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl text-zinc-100 sm:text-2xl">
            Activities Hero (Builder E)
          </h2>
          <span className="rounded-md border border-[#F6A724]/50 bg-[#F6A724]/15 px-2 py-0.5 font-geosans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#F6A724]">
            Builder E
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Photo hero on <code className="text-zinc-300">/builder-e</code>.
          Slot {builderHeroSlot("activities")} ·{" "}
          <code className="text-zinc-300">
            /uploads/branding/{builderHeroSlot("activities")}.webp
          </code>{" "}
          — numbered placeholder until you upload. Same image in Layout
          &amp; Characters → Heroes.
        </p>
        {actError ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actError}
          </p>
        ) : null}
        {actMsg ? <p className="mt-3 text-sm text-emerald-700">{actMsg}</p> : null}
        <div className="mt-6">
          <UploadField
            label="Hero background"
            hint="Wide landscape · image only"
            preview={actPreview}
            previewClass="aspect-[16/9] w-full object-cover"
            accept="image/*"
            onFile={(f) => {
              setActFile(f);
              if (f) setActPreview(URL.createObjectURL(f));
            }}
          />
        </div>
        <button
          type="button"
          disabled={actSaving}
          onClick={() => void saveActivitiesHero()}
          className="mt-6 rounded-full bg-[#F6A724] px-6 py-3 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-[#e0951a] disabled:opacity-50"
        >
          {actSaving ? "Saving…" : "Save Activities Hero"}
        </button>
      </div>
      ) : null}

      {heroesSubTab === "typography" ? (
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
      ) : null}

      {heroesSubTab === "value" ? (
      <>
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
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-full bg-[#1CA67F] px-6 py-3 text-sm font-semibold text-zinc-100 shadow-sm transition hover:bg-[#178f6d] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Branding Updates"}
      </button>
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
