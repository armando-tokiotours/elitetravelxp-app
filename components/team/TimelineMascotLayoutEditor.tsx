"use client";

import { useCallback, useEffect, useState } from "react";
import { TimelineProgressMascot } from "@/components/branding/TimelineProgressMascot";
import {
  TIMELINE_MASCOT_LAYOUT_DEFAULTS,
  alignToJustify,
  mergeTimelineMascotLayout,
  writeTimelineMascotLayoutLocal,
  type TimelineMascotAlign,
  type TimelineMascotLayout,
  type TimelineMascotRowLayout,
} from "@/lib/timelineMascotLayout";

type Variant = "multi" | "single";

/**
 * Team Access — tune Builder M / S timeline bar vs mascot slot widths.
 */
export function TimelineMascotLayoutEditor() {
  const [layout, setLayout] = useState<TimelineMascotLayout>(() =>
    structuredClone(TIMELINE_MASCOT_LAYOUT_DEFAULTS)
  );
  const [variant, setVariant] = useState<Variant>("multi");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/timeline-mascot-layout", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      if (data.layout) {
        const next = mergeTimelineMascotLayout(data.layout);
        setLayout(next);
        writeTimelineMascotLayoutLocal(next, { broadcast: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2800);
    return () => window.clearTimeout(t);
  }, [msg]);

  const row = layout[variant];

  const patchRow = (partial: Partial<TimelineMascotRowLayout>) => {
    setLayout((prev) =>
      mergeTimelineMascotLayout({
        ...prev,
        [variant]: { ...prev[variant], ...partial },
      })
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const normalized = mergeTimelineMascotLayout(layout);
      const res = await fetch("/api/admin/timeline-mascot-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      const saved = mergeTimelineMascotLayout(data.layout ?? normalized);
      setLayout(saved);
      writeTimelineMascotLayoutLocal(saved);
      setMsg("Saved — open Builder M / S to see the timeline mascot.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetVariant = () => {
    setLayout((prev) =>
      mergeTimelineMascotLayout({
        ...prev,
        [variant]: structuredClone(TIMELINE_MASCOT_LAYOUT_DEFAULTS[variant]),
      })
    );
  };

  const sum =
    row.barPct + row.gapBeforePct + row.mascotPct + row.gapAfterPct;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Timeline mascot
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Split the sticky progress row: bar width, gaps, and mascot slot —
          separately for Builder M (multi) and Builder S (single). Values
          auto-normalize to 100% on save. Mascot can stick out of its slot.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["multi", "Builder M"],
              ["single", "Builder S"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVariant(id)}
              className={
                variant === id
                  ? "rounded-full border border-[#075473] bg-[#075473]/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7dd3fc]"
                  : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-emerald-400">{msg}</p> : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SliderField
            label="Bar width %"
            value={row.barPct}
            min={40}
            max={92}
            step={0.5}
            onChange={(barPct) => patchRow({ barPct })}
          />
          <SliderField
            label="Gap before mascot %"
            value={row.gapBeforePct}
            min={0}
            max={30}
            step={0.5}
            onChange={(gapBeforePct) => patchRow({ gapBeforePct })}
          />
          <SliderField
            label="Mascot slot %"
            value={row.mascotPct}
            min={4}
            max={30}
            step={0.5}
            onChange={(mascotPct) => patchRow({ mascotPct })}
          />
          <SliderField
            label="Gap after mascot %"
            value={row.gapAfterPct}
            min={0}
            max={30}
            step={0.5}
            onChange={(gapAfterPct) => patchRow({ gapAfterPct })}
          />
          <SliderField
            label="Nudge X % (neg = left)"
            value={row.nudgePct}
            min={-20}
            max={20}
            step={0.5}
            onChange={(nudgePct) => patchRow({ nudgePct })}
          />
          <SliderField
            label="Mascot scale %"
            value={row.scalePct}
            min={50}
            max={160}
            step={1}
            onChange={(scalePct) => patchRow({ scalePct })}
          />
        </div>

        <div className="mt-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            Align in slot
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["start", "center", "end"] as TimelineMascotAlign[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => patchRow({ align: a })}
                className={
                  row.align === a
                    ? "rounded-lg border border-[#075473] bg-[#075473]/20 px-3 py-1.5 text-xs font-semibold capitalize text-[#7dd3fc]"
                    : "rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold capitalize text-zinc-400"
                }
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 font-mono text-[0.65rem] text-zinc-500">
          Sum {sum.toFixed(1)}%
          {Math.abs(sum - 100) > 0.2 ? " → will normalize on Save" : " ✓"}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-xl bg-[#075473] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={resetVariant}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300"
          >
            Reset {variant === "multi" ? "M" : "S"} defaults
          </button>
        </div>
      </div>

      <div className="overflow-visible rounded-2xl border border-zinc-800 bg-black p-4">
        <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Preview · {variant === "multi" ? "Builder M" : "Builder S"}
        </p>
        <div className="relative flex h-16 items-end overflow-visible rounded-xl border border-zinc-800 bg-[#0A0E14]">
          <div
            className="flex h-full items-center border-r border-[#075473]/40 bg-[#075473]/15 px-2"
            style={{ width: `${row.barPct}%` }}
          >
            <span className="truncate text-[10px] font-semibold text-[#7dd3fc]">
              Progress bar
            </span>
          </div>
          <div style={{ width: `${row.gapBeforePct}%` }} aria-hidden />
          <div
            className="flex h-full items-end overflow-visible"
            style={{
              width: `${row.mascotPct}%`,
              justifyContent: alignToJustify(row.align),
              transform:
                row.nudgePct !== 0
                  ? `translateX(${row.nudgePct}%)`
                  : undefined,
            }}
          >
            <div
              style={{
                transform:
                  row.scalePct !== 100
                    ? `scale(${row.scalePct / 100})`
                    : undefined,
                transformOrigin: "bottom left",
              }}
            >
              <TimelineProgressMascot className="-mb-2" />
            </div>
          </div>
          <div style={{ width: `${row.gapAfterPct}%` }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-xs text-zinc-400">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-zinc-200">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[#075473]"
      />
    </label>
  );
}
