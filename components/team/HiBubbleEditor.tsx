"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HiBubble,
  MascotHiZoom,
  useMascotHiTap,
} from "@/components/branding/MascotHiTap";
import { HI_BUBBLE_PATH } from "@/lib/brandCharacters";

/**
 * Team Access — replace the mascot-tap HI bubble + live preview.
 * Choose file → preview draft; Save → write to public/brand.
 */
export function HiBubbleEditor() {
  const [bust, setBust] = useState(0);
  const [liveSrc, setLiveSrc] = useState(HI_BUBBLE_PATH);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const { showHi, triggerHi } = useMascotHiTap();

  const previewSrc = draftUrl || liveSrc;
  const hasDraft = Boolean(draftFile && draftUrl);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/brand-characters", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      const row = (data.items || []).find(
        (i: { id: string }) => i.id === "hi-bubble"
      );
      if (row) {
        setMeta(row.currentLabel || null);
        setLiveSrc(`${row.path}?v=${Date.now()}`);
        setBust(Date.now());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 3200);
    return () => window.clearTimeout(t);
  }, [msg]);

  useEffect(
    () => () => {
      if (draftUrl) URL.revokeObjectURL(draftUrl);
    },
    [draftUrl]
  );

  const clearDraft = () => {
    if (draftUrl) URL.revokeObjectURL(draftUrl);
    setDraftFile(null);
    setDraftUrl(null);
  };

  const onPickFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    setMsg(null);
    if (draftUrl) URL.revokeObjectURL(draftUrl);
    setDraftFile(file);
    setDraftUrl(URL.createObjectURL(file));
  };

  const onSave = async () => {
    if (!draftFile) return;
    setReplacing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("id", "hi-bubble");
      fd.append("file", draftFile);
      const res = await fetch("/api/admin/brand-characters", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Replace failed");
      setMsg(
        data.note
          ? `Saved — ${data.note}`
          : "Saved. Refresh Pre-Elite / Builders / Itinerary to see it."
      );
      if (data.item?.currentLabel) setMeta(data.item.currentLabel);
      clearDraft();
      const next = `${HI_BUBBLE_PATH}?v=${Date.now()}`;
      setLiveSrc(next);
      setBust(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replace failed");
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          HI bubble
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Shown for 2.5s when guests tap the mascot on Pre-Elite, Pre-Build,
          Builder M/S, and Itinerary. Choose a file to preview, then Save to
          replace the live asset.
        </p>
        <p className="mt-2 font-mono text-[0.65rem] text-zinc-500">
          {HI_BUBBLE_PATH}
          {meta ? ` · ${meta}` : ""}
        </p>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-emerald-400">{msg}</p> : null}
        {hasDraft ? (
          <p className="mt-3 text-sm text-amber-300">
            Draft ready — preview below. Save to apply, or Cancel to discard.
          </p>
        ) : null}

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Choose image
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={replacing}
            className="mt-2 block w-full text-xs text-zinc-300 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              onPickFile(f);
            }}
          />
          <p className="mt-1 text-[0.65rem] text-zinc-500">
            PNG/JPG → auto WebP on Save · keeps hi-bubble.webp
          </p>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasDraft || replacing}
            onClick={() => void onSave()}
            className="rounded-xl bg-[#075473] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {replacing ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={!hasDraft || replacing}
            onClick={clearDraft}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {hasDraft ? "Draft preview" : "Asset"}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={hasDraft ? draftUrl! : bust}
            src={previewSrc}
            alt="HI bubble"
            className="max-h-36 w-auto object-contain drop-shadow-lg"
          />
        </div>

        <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#0A1017] to-zinc-950 p-6">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Tap preview
          </p>
          <button
            type="button"
            aria-label="Say hi"
            onClick={triggerHi}
            className="relative cursor-pointer border-0 bg-transparent p-0"
          >
            <HiBubble
              show={showHi}
              className="-right-1 -top-2"
              srcOverride={previewSrc}
            />
            <MascotHiZoom showHi={showHi} className="pointer-events-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/brand/mascot-look.webp?v=${bust}`}
                alt=""
                className="h-36 w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] sm:h-40"
                draggable={false}
              />
            </MascotHiZoom>
          </button>
          <p className="mt-3 text-xs text-zinc-500">Click the character</p>
        </div>
      </div>
    </div>
  );
}
