"use client";

import type PocketBase from "pocketbase";
import { useCallback, useEffect, useState } from "react";
import { optimizeFileForUpload } from "@/lib/optimizeUploadClient";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  DEFAULT_TORII_GATE_LAYOUT,
  fetchSiteBranding,
  resolveToriiPortalBranding,
  type PbSiteBranding,
  type ToriiPortalGateId,
  type ToriiPortalGateLayout,
} from "@/lib/pocketbase/client";

type PbClient = PocketBase;

type GateDraft = ToriiPortalGateLayout & {
  frameFile: File | null;
  imageFile: File | null;
};

const GATE_META: {
  id: ToriiPortalGateId;
  pbKey: "multiday" | "single" | "builder_e";
  label: string;
}[] = [
  {
    id: "multiday",
    pbKey: "multiday",
    label: "Door 1: Multi-Day Journey",
  },
  {
    id: "single",
    pbKey: "single",
    label: "Door 2: Single-Day Tour",
  },
  {
    id: "experience",
    pbKey: "builder_e",
    label: "Door 3: Activities & VIP (Builder E)",
  },
];

function emptyDraft(layout: ToriiPortalGateLayout): GateDraft {
  return { ...layout, frameFile: null, imageFile: null };
}

export function ToriiPortalAdminStudio({
  getClient,
}: {
  getClient: () => PbClient;
}) {
  const [record, setRecord] = useState<PbSiteBranding | null>(null);
  const [gateScale, setGateScale] = useState("1");
  const [orientation, setOrientation] = useState<"HORIZONTAL" | "VERTICAL">(
    "HORIZONTAL"
  );
  const [drafts, setDrafts] = useState<Record<ToriiPortalGateId, GateDraft>>(
    () => {
      const resolved = resolveToriiPortalBranding(null);
      return {
        multiday: emptyDraft(resolved.gates.multiday),
        single: emptyDraft(resolved.gates.single),
        experience: emptyDraft(resolved.gates.experience),
      };
    }
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyRecord = useCallback((row: PbSiteBranding | null) => {
    const resolved = resolveToriiPortalBranding(row);
    setGateScale(String(resolved.gateScale));
    setOrientation(resolved.orientation);
    setDrafts({
      multiday: emptyDraft(resolved.gates.multiday),
      single: emptyDraft(resolved.gates.single),
      experience: emptyDraft(resolved.gates.experience),
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

  const updateGate = <K extends keyof ToriiPortalGateLayout>(
    id: ToriiPortalGateId,
    key: K,
    value: ToriiPortalGateLayout[K]
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  };

  const handleFrameFile = async (id: ToriiPortalGateId, file: File | null) => {
    if (!file) return;
    const { file: optimized } = await optimizeFileForUpload(file);
    const url = URL.createObjectURL(optimized);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], frameFile: optimized, frameUrl: url },
    }));
  };

  const handleImageFile = async (id: ToriiPortalGateId, file: File | null) => {
    if (!file) return;
    const { file: optimized } = await optimizeFileForUpload(file);
    const url = URL.createObjectURL(optimized);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], imageFile: optimized, imageUrl: url },
    }));
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      fd.append("torii_gate_scale", gateScale.trim() || "1");
      fd.append("torii_orientation", orientation);

      for (const meta of GATE_META) {
        const d = drafts[meta.id];
        fd.append(`torii_${meta.pbKey}_mask_x`, String(d.photoOffsetX));
        fd.append(`torii_${meta.pbKey}_mask_y`, String(d.photoOffsetY));
        fd.append(`torii_${meta.pbKey}_mask_w`, String(d.maskWidth));
        fd.append(`torii_${meta.pbKey}_mask_h`, String(d.maskHeight));
        if (d.frameFile) fd.append(`torii_${meta.pbKey}_frame`, d.frameFile);
        if (d.imageFile) fd.append(`torii_${meta.pbKey}_image`, d.imageFile);
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
      setRecord(saved);
      applyRecord(saved);
      setMsg("Main Intro Torii settings saved. Refresh the homepage to verify.");
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
        Loading Torii portal branding…
      </p>
    );
  }

  return (
    <div className="space-y-8 rounded-2xl border border-white/10 bg-[#0D1117] p-5 text-white sm:p-6">
      <div className="border-b border-white/10 pb-4">
        <h3 className="font-godiva text-lg text-[#F6A724]">
          Torii Gate Portal Alignment &amp; Visual Controls
        </h3>
        <p className="mt-1 text-xs text-gray-400">
          Upload custom Torii PNG frames, adjust image portal shapes, tweak
          photo alignments, and configure light effects. Saved to PocketBase{" "}
          <code className="text-zinc-300">site_branding</code>.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-emerald-400">{msg}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Gate scale (0.7 – 1.75)
          <input
            type="number"
            min={0.7}
            max={1.75}
            step={0.05}
            value={gateScale}
            onChange={(e) => setGateScale(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Orientation
          <select
            value={orientation}
            onChange={(e) =>
              setOrientation(
                e.target.value === "VERTICAL" ? "VERTICAL" : "HORIZONTAL"
              )
            }
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100"
          >
            <option value="HORIZONTAL">
              HORIZONTAL (1-line all viewports)
            </option>
            <option value="VERTICAL">
              VERTICAL (desktop stack; mobile stays row)
            </option>
          </select>
        </label>
      </div>

      {GATE_META.map((meta) => {
        const config = drafts[meta.id];
        return (
          <div
            key={meta.id}
            className="space-y-4 rounded-xl border border-white/5 bg-black/40 p-5"
          >
            <h4 className="text-sm font-bold tracking-wider text-cyan-300 uppercase">
              {meta.label}
            </h4>

            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
              <div className="space-y-3 text-xs">
                <div>
                  <label className="mb-1 block font-bold text-gray-300">
                    Torii Gate Frame Asset (PNG)
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/webp,image/svg+xml"
                    onChange={(e) =>
                      void handleFrameFile(
                        meta.id,
                        e.target.files?.[0] ?? null
                      )
                    }
                    className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-gray-300"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-gray-300">
                    Portal Photo Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      void handleImageFile(
                        meta.id,
                        e.target.files?.[0] ?? null
                      )
                    }
                    className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-gray-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-gray-400">
                      Photo X-Offset: {config.photoOffsetX}%
                    </label>
                    <input
                      type="range"
                      min={-30}
                      max={30}
                      value={config.photoOffsetX}
                      onChange={(e) =>
                        updateGate(
                          meta.id,
                          "photoOffsetX",
                          Number(e.target.value)
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400">
                      Photo Y-Offset: {config.photoOffsetY}%
                    </label>
                    <input
                      type="range"
                      min={-30}
                      max={30}
                      value={config.photoOffsetY}
                      onChange={(e) =>
                        updateGate(
                          meta.id,
                          "photoOffsetY",
                          Number(e.target.value)
                        )
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400">
                      Mask Width: {config.maskWidth}%
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={config.maskWidth}
                      onChange={(e) =>
                        updateGate(
                          meta.id,
                          "maskWidth",
                          Number(e.target.value)
                        )
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400">
                      Mask Height: {config.maskHeight}%
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={config.maskHeight}
                      onChange={(e) =>
                        updateGate(
                          meta.id,
                          "maskHeight",
                          Number(e.target.value)
                        )
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDrafts((prev) => ({
                      ...prev,
                      [meta.id]: {
                        ...prev[meta.id],
                        ...DEFAULT_TORII_GATE_LAYOUT,
                      },
                    }));
                  }}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase hover:border-white/25 hover:text-zinc-200"
                >
                  Reset alignment defaults
                </button>
              </div>

              <div className="relative flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-white/10 bg-[#05080C] p-4">
                <span className="absolute top-2 left-2 font-mono text-[10px] text-gray-500 uppercase">
                  Live Alignment Preview
                </span>

                <div className="relative flex h-48 w-36 items-end justify-center">
                  <div
                    className="absolute overflow-hidden rounded-t-full border border-amber-400/40"
                    style={{
                      width: `${config.maskWidth}%`,
                      height: `${config.maskHeight}%`,
                      left: "50%",
                      bottom: "8px",
                      transform: `translate(calc(-50% + ${config.photoOffsetX}%), ${config.photoOffsetY}%)`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={config.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={config.frameUrl}
                    alt=""
                    className="pointer-events-none relative z-10 h-full w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="w-full rounded-xl bg-[#075473] py-3 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition-colors hover:bg-[#075473]/80 disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : "Save Main Intro Torii Settings to PocketBase"}
      </button>
    </div>
  );
}
