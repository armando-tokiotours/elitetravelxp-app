"use client";

import type PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  DEFAULT_SITE_BRANDING,
  brandingHeroUrl,
  brandingLogoUrl,
  fetchPublicBrandAssets,
  type PbSiteBranding,
  type PublicBrandAssets,
} from "@/lib/pocketbase/client";

type PbClient = PocketBase;

const FONT_PRESETS = [
  "Montserrat ExtraBold",
  "Century Gothic",
  "Century Gothic ExtraBold",
  "Century Gothic Bold",
  "Montserrat Thin",
  "Momo Trust Display",
  "Poppins",
  "Playfair Display",
  "Cinzel",
  "Lato",
  "Montserrat",
] as const;

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
  const [googleUrl, setGoogleUrl] = useState<string>(
    DEFAULT_SITE_BRANDING.google_fonts_url
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

  const load = async () => {
    setLoading(true);
    setError(null);
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
      setFontH1(row.font_h1 || DEFAULT_SITE_BRANDING.font_h1);
      setFontH2(row.font_h2 || DEFAULT_SITE_BRANDING.font_h2);
      setFontBody(row.font_body || DEFAULT_SITE_BRANDING.font_body);
      setGoogleUrl(
        row.google_fonts_url ||
          row.google_fonts_import_url ||
          DEFAULT_SITE_BRANDING.google_fonts_url
      );
      setLogoPreview(brandingLogoUrl(row, assets));
      setHeroPreview(brandingHeroUrl(row, assets));
      setLogoFile(null);
      setHeroFile(null);
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
    const url = googleUrl.trim();
    if (!url) return;
    try {
      const u = new URL(url);
      if (
        u.hostname !== "fonts.googleapis.com" &&
        u.hostname !== "fonts.gstatic.com"
      ) {
        return;
      }
    } catch {
      return;
    }
    const id = "elite-admin-google-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = url;
  }, [googleUrl]);

  const savePublicAsset = async (kind: "hero" | "logo", file: File) => {
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
      fd.append("font_h1", fontH1);
      fd.append("font_h2", fontH2);
      fd.append("font_body", fontBody);
      fd.append("google_fonts_url", googleUrl);
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

  if (loading) {
    return <p className="text-sm text-[#8A8278]">Loading site branding…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 sm:p-6">
        <h2 className="font-display text-2xl text-[#0B1F3A]">Site Branding</h2>
        <p className="mt-1 text-sm text-[#8A8278]">
          Controls the builder navbar logo and hero section. One active record.
        </p>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
          <label className="block text-xs uppercase tracking-wider text-[#8A8278]">
            Main title (navy / white)
            <input
              type="text"
              value={main}
              onChange={(e) => setMain(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-[#8A8278]">
            Highlighted title (gold)
            <input
              type="text"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-[#8A8278]">
            Subtitle
            <textarea
              rows={2}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 sm:p-6">
        <h2 className="font-display text-2xl text-[#0B1F3A]">
          Typography Settings
        </h2>
        <p className="mt-1 text-sm text-[#8A8278]">
          Type &apos;Momo Trust Display&apos; or &apos;Poppins&apos; to use local
          fonts, or type a Google Font name if you provide a URL below.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <FontField
            label="H1 Font Family (Main Titles)"
            value={fontH1}
            onChange={setFontH1}
          />
          <FontField
            label="H2 Font Family (Subtitles)"
            value={fontH2}
            onChange={setFontH2}
          />
          <FontField
            label="Body Font Family"
            value={fontBody}
            onChange={setFontBody}
          />
        </div>
        <datalist id="elite-font-presets">
          {FONT_PRESETS.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>

        <label className="mt-5 block text-xs uppercase tracking-wider text-[#8A8278]">
          Google Fonts Import URL
          <input
            type="url"
            value={googleUrl}
            onChange={(e) => setGoogleUrl(e.target.value)}
            placeholder="https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap"
            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
          />
        </label>
        <p className="mt-1.5 text-xs text-[#A39A8E]">
          Paste the Google Fonts CSS URL here to load external fonts. Leave blank
          to rely on local fonts.
        </p>

        <div className="mt-6 rounded-2xl border border-[#E8E2D9] bg-[#FBF8F2] p-5">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[#C4A35A]">
            Live preview
          </p>
          <p
            className="text-3xl text-[#0B1F3A]"
            style={{ fontFamily: `"${fontH1}", serif` }}
          >
            Heading 1 — {fontH1}
          </p>
          <p
            className="mt-2 text-2xl text-[#0B1F3A]"
            style={{ fontFamily: `"${fontH2}", sans-serif` }}
          >
            Heading 2 — {fontH2}
          </p>
          <p
            className="mt-3 text-sm leading-relaxed text-[#3D4A5C]"
            style={{ fontFamily: `"${fontBody}", sans-serif` }}
          >
            Body text — {fontBody}. Design every detail. We&apos;ll take care of
            the rest.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-full bg-[#C4A35A] px-6 py-3 text-sm font-semibold text-[#0B1F3A] shadow-sm transition hover:bg-[#b8944c] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Branding Updates"}
      </button>
    </div>
  );
}

function FontField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs uppercase tracking-wider text-[#8A8278]">
      {label}
      <input
        type="text"
        list="elite-font-presets"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
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
  };
}) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wider text-[#8A8278]">
        {label}
      </p>
      <p className="mb-2 text-xs text-[#A39A8E]">{hint}</p>
      <div className="overflow-hidden rounded-2xl border border-dashed border-[#D9D2C7] bg-[#FBF8F2] p-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className={`mx-auto rounded-xl ${previewClass}`}
          />
        ) : (
          <div className="flex h-28 items-center justify-center text-sm text-[#8A8278]">
            No image yet
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="mt-3 block w-full text-sm"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {publicOption ? (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-[#0B1F3A]">
            <input
              type="checkbox"
              checked={publicOption.checked}
              onChange={(e) => publicOption.onChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#D9D2C7] accent-[#C4A35A]"
            />
            <span>
              <span className="font-medium">
                Also save to project public assets
              </span>
              <span className="mt-0.5 block text-xs text-[#8A8278]">
                {publicOption.pathHint}
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </div>
  );
}
