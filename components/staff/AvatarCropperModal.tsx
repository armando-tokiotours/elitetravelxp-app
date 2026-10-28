"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

// react-easy-crop v6 auto-injects its required styles into the document
// head on mount (see package README), so no CSS import is needed here.

type AvatarCropperModalProps = {
  imageSrc: string;
  onCancel: () => void;
  onSaveCrop: (croppedAreaPixels: Area) => void;
  saving?: boolean;
};

export function AvatarCropperModal({
  imageSrc,
  onCancel,
  onSaveCrop,
  saving = false,
}: AvatarCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Position Photo"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0D141C] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-widest text-white uppercase">
            Position Photo
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
            className="rounded-md p-1 text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="relative mt-4 h-72 w-full overflow-hidden rounded-xl bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
          />
        </div>

        <label className="mt-4 block text-xs tracking-wider text-zinc-500 uppercase">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={saving}
            className="mt-2 w-full accent-[#0080A3]"
          />
        </label>

        <button
          type="button"
          disabled={saving || !croppedAreaPixels}
          onClick={() => {
            if (croppedAreaPixels) onSaveCrop(croppedAreaPixels);
          }}
          className="mt-4 w-full rounded-lg bg-[#0080A3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#006d8a] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Profile Photo"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
