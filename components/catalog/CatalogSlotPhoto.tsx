"use client";

import { useEffect, useRef, useState } from "react";
import {
  catalogMediaMobileUrl,
  catalogMediaSlot,
  catalogMediaSrcSet,
  catalogMediaWebUrl,
} from "@/lib/catalogMedia";
import { uploadToVps } from "@/lib/vpsUploadClient";

/**
 * Guest/catalog photo resolved slot-first by record ID:
 * `/uploads/catalog/{recordId}_1.webp` (+ --mobile srcSet), falling back to
 * `fallbackSrc` (legacy PocketBase file / cover_url), then to nothing —
 * never a broken-image icon. Plain <img> (never next/image: the optimizer
 * 400s on versioned /uploads URLs).
 */
export function CatalogSlotImg({
  recordId,
  index = 1,
  inheritRecordId = "",
  fallbackSrc = "",
  alt = "",
  className = "h-full w-full object-cover",
  emptyClassName = "h-full w-full bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]",
}: {
  recordId: string;
  index?: number;
  /** Tour-family master: its `{masterId}_1` photo is inherited when this
   * record has no photo of its own (variant → master → legacy fallback). */
  inheritRecordId?: string;
  fallbackSrc?: string;
  alt?: string;
  className?: string;
  emptyClassName?: string;
}) {
  // stage 0 own slot → 1 inherited (master) slot → 2 legacy fallback → 3 empty
  const slot = catalogMediaWebUrl(recordId, index);
  const inheritSlot =
    inheritRecordId && inheritRecordId !== recordId
      ? catalogMediaWebUrl(inheritRecordId, index)
      : "";
  const maxStage = fallbackSrc ? 3 : inheritSlot ? 2 : 1;
  const [stage, setStage] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setStage(0);
  }, [slot, inheritSlot, fallbackSrc, recordId, index]);
  // SSR/hydration race: an <img> that 404s before React attaches onError
  // never replays the event — re-check once mounted.
  useEffect(() => {
    const t = setTimeout(() => {
      const el = imgRef.current;
      if (el && el.complete && el.naturalWidth === 0) {
        setStage((s) => Math.min(s + 1, maxStage));
      }
    }, 60);
    return () => clearTimeout(t);
  }, [stage, maxStage]);

  const src =
    stage === 0
      ? slot
      : stage === 1 && inheritSlot
        ? inheritSlot
        : stage <= 2
          ? fallbackSrc
          : "";
  if (!src) {
    return <div aria-hidden className={emptyClassName} title={alt || undefined} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      srcSet={
        stage === 0
          ? catalogMediaSrcSet(recordId, index)
          : stage === 1 && inheritSlot
            ? catalogMediaSrcSet(inheritRecordId, index)
            : undefined
      }
      sizes="(max-width: 768px) 768px, 1600px"
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setStage((s) => Math.min(s + 1, maxStage))}
    />
  );
}

/**
 * Source-of-Truth photo cell: shows the `{recordId}_1` slot thumbnail, or a
 * labelled empty state with the exact expected ID, plus an upload control
 * that writes/replaces THAT slot in place (same ID, no PocketBase write).
 */
export function CatalogSlotCell({
  recordId,
  inheritRecordId = "",
  inheritOnly = false,
  fallbackSrc = "",
  getToken,
  onUploaded,
}: {
  recordId: string;
  /** Family master — its photo displays until this record gets its own. */
  inheritRecordId?: string;
  /** Variant rows: show ONLY the master's photo, read-only — a variant
   * never carries its own picture cell (upload lives on the master). */
  inheritOnly?: boolean;
  fallbackSrc?: string;
  getToken?: () => string;
  onUploaded?: () => void;
}) {
  const slotLabel = catalogMediaSlot(recordId, 1); // e.g. 816a…_1
  const [stage, setStage] = useState(0);
  const [bust, setBust] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const cellImgRef = useRef<HTMLImageElement>(null);
  // stage 0 own slot → 1 inherited master slot → 2 legacy fallback → 3 empty
  const inheritSrc =
    inheritRecordId && inheritRecordId !== recordId
      ? catalogMediaMobileUrl(inheritRecordId, 1)
      : "";
  const nextStage = (s: number) =>
    s === 0 && inheritSrc ? 1 : s <= 1 && fallbackSrc ? 2 : 3;
  useEffect(() => {
    setStage(0);
    setErr("");
  }, [recordId, fallbackSrc]);
  // Same SSR/hydration 404 race as CatalogSlotImg — re-check once mounted.
  useEffect(() => {
    const t = setTimeout(() => {
      const el = cellImgRef.current;
      if (el && el.complete && el.naturalWidth === 0) {
        setStage((s) => nextStage(s));
      }
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, fallbackSrc, recordId, bust, inheritSrc]);

  const slotSrc = bust
    ? `${catalogMediaMobileUrl(recordId, 1)}?v=${bust}`
    : catalogMediaMobileUrl(recordId, 1);

  if (inheritOnly) {
    // Read-only master photo — the one picture for the whole family.
    return (
      <div className="flex items-center gap-2" data-catalog-slot={slotLabel}>
        {inheritSrc && stage < 3 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={inheritSrc}
            alt={slotLabel}
            className="h-10 w-10 shrink-0 rounded-lg object-cover opacity-70"
            onError={() => setStage(3)}
          />
        ) : (
          <div className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 px-1 text-center text-[8px] leading-tight text-zinc-400">
            master
            <br />
            photo
          </div>
        )}
        <span className="text-[9px] leading-tight text-zinc-500">
          same photo as master
          <br />
          <span className="font-mono">
            {inheritRecordId ? catalogMediaSlot(inheritRecordId, 1) : ""}
          </span>
        </span>
      </div>
    );
  }

  const upload = async (f: File | null) => {
    if (!f || !getToken) return;
    setBusy(true);
    setErr("");
    try {
      await uploadToVps(f, "catalog", getToken(), { stableKey: slotLabel });
      setStage(0);
      setBust(Date.now());
      onUploaded?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2" data-catalog-slot={slotLabel}>
      {stage === 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={cellImgRef}
          src={slotSrc}
          alt={slotLabel}
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
          onError={() => setStage((s) => nextStage(s))}
        />
      ) : stage === 1 && inheritSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={cellImgRef}
          src={inheritSrc}
          alt={slotLabel}
          title={`Inherited from family master ${inheritRecordId}_1`}
          className="h-10 w-10 shrink-0 rounded-lg object-cover opacity-70"
          onError={() => setStage((s) => nextStage(s))}
        />
      ) : stage === 2 && fallbackSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={cellImgRef}
          src={fallbackSrc}
          alt={slotLabel}
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
          onError={() => setStage(3)}
        />
      ) : (
        <div
          className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 px-1 text-center text-[8px] leading-tight text-zinc-400"
          title={`${slotLabel} — no photo`}
        >
          {slotLabel}
          <br />
          no photo
        </div>
      )}
      <div className="flex flex-col items-start gap-0.5">
        <span className="font-mono text-[9px] text-zinc-500">{slotLabel}</span>
        {getToken ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="text-[10px] font-semibold text-[#F6A724] disabled:opacity-50"
            >
              {busy ? "Uploading…" : stage >= 2 ? "Upload" : "Replace"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void upload(e.target.files?.[0] ?? null)}
            />
          </>
        ) : null}
        {err ? <span className="text-[9px] text-red-400">{err}</span> : null}
      </div>
    </div>
  );
}
