"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import type { EmailTemplateConfig } from "@/config/emailDefaults";

const OPTIMAL = {
  header: { maxKb: 80, label: "≤80 KB · JPG/WebP · ~1200px wide" },
  footer: { maxKb: 40, label: "≤40 KB · PNG/WebP · ~1200px wide" },
} as const;

function formatKb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  return `${(bytes / 1024).toFixed(bytes >= 100 * 1024 ? 0 : 1)} KB`;
}

/**
 * Email Template extras — banner uploads with weight, PDF attachment preview.
 */
export function EmailTemplateAssetsPanel({
  template,
  onChange,
}: {
  template: EmailTemplateConfig;
  onChange: (patch: Partial<EmailTemplateConfig>) => void;
}) {
  const [headerBytes, setHeaderBytes] = useState(0);
  const [footerBytes, setFooterBytes] = useState(0);
  const [busy, setBusy] = useState<"header" | "footer" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bust, setBust] = useState(0);

  const probe = useCallback(async (path: string) => {
    try {
      const res = await fetch(path, { method: "HEAD", cache: "no-store" });
      const len = Number(res.headers.get("content-length") || 0);
      if (len > 0) return len;
      const full = await fetch(path, { cache: "no-store" });
      const buf = await full.arrayBuffer();
      return buf.byteLength;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, f] = await Promise.all([
        probe(template.headerImagePath || "/brand/email-1.jpg"),
        probe(template.footerImagePath || "/brand/email-2.png"),
      ]);
      if (!cancelled) {
        setHeaderBytes(h);
        setFooterBytes(f);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [template.headerImagePath, template.footerImagePath, probe, bust]);

  const upload = async (kind: "email_header" | "email_footer", file: File) => {
    setBusy(kind === "email_header" ? "header" : "footer");
    setErr(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const res = await fetch("/api/branding/public-asset", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const path = String(data.path || "");
      if (!path) throw new Error("No path returned");
      if (kind === "email_header") onChange({ headerImagePath: path });
      else onChange({ footerImagePath: path });
      setBust((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-5 sm:p-6">
      <div>
        <h3 className="text-sm font-semibold text-white">Email banners</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Top header + footer images. Check weight vs optimal for fast inboxes.
        </p>
      </div>

      <AssetRow
        label="Header / top of email"
        path={template.headerImagePath || "/brand/email-1.jpg"}
        bytes={headerBytes}
        optimal={OPTIMAL.header}
        busy={busy === "header"}
        bust={bust}
        onPick={(f) => void upload("email_header", f)}
      />
      <AssetRow
        label="Footer banner"
        path={template.footerImagePath || "/brand/email-2.png"}
        bytes={footerBytes}
        optimal={OPTIMAL.footer}
        busy={busy === "footer"}
        bust={bust}
        onPick={(f) => void upload("email_footer", f)}
      />

      {err ? <p className="text-xs text-[#E60F43]">{err}</p> : null}

      <p className="border-t border-[#2C2C2E] pt-3 text-[11px] text-zinc-500">
        PDF attach format (Dossier / Invoice · phone view) lives in the{" "}
        <span className="text-[#7dd3fc]">PDF</span> tab.
      </p>

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={template.includeWalletCta === true}
          onChange={(e) => onChange({ includeWalletCta: e.target.checked })}
          className="rounded border-zinc-600"
        />
        Show “Download Japan Pass” button in email
      </label>
    </div>
  );
}

function AssetRow({
  label,
  path,
  bytes,
  optimal,
  busy,
  bust,
  onPick,
}: {
  label: string;
  path: string;
  bytes: number;
  optimal: { maxKb: number; label: string };
  busy: boolean;
  bust: number;
  onPick: (file: File) => void;
}) {
  const kb = bytes / 1024;
  const heavy = kb > optimal.maxKb;
  const src = `${path}${path.includes("?") ? "&" : "?"}v=${bust}`;

  return (
    <div className="rounded-xl border border-[#2C2C2E] bg-[#121212] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">{label}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
            {path}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 hover:border-[#075473]">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Replace
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="mt-2 flex gap-3">
        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = "0.2";
            }}
          />
          <ImageIcon className="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-zinc-600" />
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-zinc-500">Current</dt>
          <dd className={heavy ? "font-semibold text-[#E60F43]" : "text-white"}>
            {formatKb(bytes)}
          </dd>
          <dt className="text-zinc-500">Optimal</dt>
          <dd className="text-[#6ee7b7]">{optimal.label}</dd>
        </dl>
      </div>
    </div>
  );
}
