"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  GUEST_PARTY_ADULTS,
  GUEST_PARTY_CHICK_SRC,
  GUEST_PARTY_LAYOUT_DEFAULTS,
  mergeGuestPartyLayout,
  slotToStyle,
  writeGuestPartyLayoutLocal,
  type GuestPartyAdultId,
  type GuestPartyLayout,
  type GuestPartySlot,
} from "@/lib/guestPartyLayout";

type SelectedId =
  | GuestPartyAdultId
  | "chick-0"
  | "chick-1"
  | "chick-2";

function getSlot(
  layout: GuestPartyLayout,
  id: SelectedId
): GuestPartySlot {
  if (id.startsWith("chick-")) {
    const i = Number(id.split("-")[1]) as 0 | 1 | 2;
    return layout.chicks[i];
  }
  return layout.adults[id as GuestPartyAdultId];
}

function setSlot(
  layout: GuestPartyLayout,
  id: SelectedId,
  slot: GuestPartySlot
): GuestPartyLayout {
  if (id.startsWith("chick-")) {
    const i = Number(id.split("-")[1]) as 0 | 1 | 2;
    const chicks = [...layout.chicks] as GuestPartyLayout["chicks"];
    chicks[i] = slot;
    return { ...layout, chicks };
  }
  return {
    ...layout,
    adults: { ...layout.adults, [id]: slot },
  };
}

const ELEMENT_LIST: Array<{ id: SelectedId; label: string; src: string }> = [
  ...GUEST_PARTY_ADULTS.map((a) => ({
    id: a.id as SelectedId,
    label: a.label,
    src: a.src,
  })),
  { id: "chick-0", label: "Chick 1", src: GUEST_PARTY_CHICK_SRC },
  { id: "chick-1", label: "Chick 2", src: GUEST_PARTY_CHICK_SRC },
  { id: "chick-2", label: "Chick 3", src: GUEST_PARTY_CHICK_SRC },
];

/**
 * Visual drag builder for Pre-Elite Step 5 guest party positions.
 * Save writes config/guestPartyLayout.json via API — live page reads it.
 */
export function GuestPartyLayoutBuilder({
  embedded = false,
}: {
  /** When true, omit outer page chrome (used inside LayoutBuilderHub). */
  embedded?: boolean;
}) {
  const [layout, setLayout] = useState<GuestPartyLayout>(
    structuredClone(GUEST_PARTY_LAYOUT_DEFAULTS)
  );
  const [selected, setSelected] = useState<SelectedId>("duck");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: SelectedId;
    startX: number;
    startY: number;
    originRight: number;
    originBottom: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/guest-party-layout");
        const data = await res.json();
        if (!cancelled && data?.layout) {
          const next = mergeGuestPartyLayout(data.layout);
          setLayout(next);
          writeGuestPartyLayoutLocal(next, { broadcast: false });
        }
      } catch {
        if (!cancelled) setError("Could not load saved layout — showing defaults.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2800);
    return () => window.clearTimeout(t);
  }, [msg]);

  const updateSelected = useCallback(
    (patch: Partial<GuestPartySlot>) => {
      setLayout((prev) => {
        const cur = getSlot(prev, selected);
        return setSlot(prev, selected, { ...cur, ...patch });
      });
    },
    [selected]
  );

  const onPointerDown = (id: SelectedId, e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(id);
    const slot = getSlot(layout, id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      originRight: slot.right,
      originBottom: slot.bottom,
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    const box = canvasRef.current;
    if (!drag || !box) return;
    const rect = box.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
    // Moving right decreases `right`%; moving up increases `bottom`%
    const nextRight = Math.round((drag.originRight - dxPct) * 10) / 10;
    const nextBottom = Math.round((drag.originBottom - dyPct) * 10) / 10;
    setLayout((prev) => {
      const cur = getSlot(prev, drag.id);
      return setSlot(prev, drag.id, {
        ...cur,
        right: nextRight,
        bottom: nextBottom,
      });
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/guest-party-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      const next = mergeGuestPartyLayout(data.layout ?? layout);
      setLayout(next);
      writeGuestPartyLayoutLocal(next, { broadcast: true });
      setMsg("Layout saved — Pre-Elite Step 5 will use these positions.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLayout(structuredClone(GUEST_PARTY_LAYOUT_DEFAULTS));
    setMsg("Reset to defaults (not saved yet).");
  };

  const sel = getSlot(layout, selected);

  return (
    <div className={embedded ? "" : "mx-auto max-w-5xl px-4 py-6 sm:px-6"}>
      <div
        className={
          embedded
            ? "mb-5 flex flex-wrap items-center justify-end gap-3"
            : "mb-5 flex flex-wrap items-center justify-between gap-3"
        }
      >
        {!embedded ? (
          <Link
            href="/team-access"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1C1C1E] px-3.5 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-[#075473] hover:text-white"
          >
            <span aria-hidden>←</span>
            <span>Back to Team Admin</span>
          </Link>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-500"
          >
            Reset defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-xl border border-[#075473] bg-[#075473] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#054F70] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save layout"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h2
          className={
            embedded
              ? "font-display text-2xl text-white sm:text-3xl"
              : "font-display text-2xl text-white sm:text-3xl"
          }
        >
          Guest party layout
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Drag characters to place them. Height and z-index use the sliders.
          Positions only — no timing or guest-count rules. Saves to{" "}
          <code className="text-zinc-300">config/guestPartyLayout.json</code>{" "}
          and updates Pre-Elite Step 5 live.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="mb-4 text-sm text-emerald-400">{msg}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading layout…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
          {/* Canvas — mirrors Step 5 hero party box */}
          <div className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-6">
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#075473]">
              Step 5 preview · drag to move
            </p>
            <div className="relative min-h-[14rem] overflow-visible rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/80 sm:min-h-[16rem]">
              {/* Locked kid reference (not editable) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/mascot-look.webp"
                alt=""
                className="pointer-events-none absolute -right-2 -top-2 z-20 h-36 w-auto select-none object-contain opacity-90 sm:h-44"
              />
              <div
                ref={canvasRef}
                className="absolute inset-y-0 right-0 w-[78%] max-w-[24rem] select-none sm:w-[74%] sm:max-w-[28rem]"
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {GUEST_PARTY_ADULTS.map((a) => {
                  const slot = layout.adults[a.id];
                  const on = selected === a.id;
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={a.id}
                      src={a.src}
                      alt={a.label}
                      draggable={false}
                      onPointerDown={(e) => onPointerDown(a.id, e)}
                      className={
                        on
                          ? "absolute cursor-grab object-contain object-bottom drop-shadow-[0_0_0_2px_#075473] active:cursor-grabbing ring-2 ring-[#075473] ring-offset-1 ring-offset-zinc-950"
                          : "absolute cursor-grab object-contain object-bottom opacity-90 active:cursor-grabbing hover:opacity-100"
                      }
                      style={slotToStyle(slot)}
                    />
                  );
                })}
                {layout.chicks.map((slot, i) => {
                  const id = `chick-${i}` as SelectedId;
                  const on = selected === id;
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={id}
                      src={GUEST_PARTY_CHICK_SRC}
                      alt={`Chick ${i + 1}`}
                      draggable={false}
                      onPointerDown={(e) => onPointerDown(id, e)}
                      className={
                        on
                          ? "absolute cursor-grab object-contain object-bottom active:cursor-grabbing ring-2 ring-[#F6A724] ring-offset-1 ring-offset-zinc-950"
                          : "absolute cursor-grab object-contain object-bottom opacity-90 active:cursor-grabbing hover:opacity-100"
                      }
                      style={slotToStyle(slot)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Elements
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {ELEMENT_LIST.map((el) => (
                  <li key={el.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(el.id)}
                      className={
                        selected === el.id
                          ? "flex w-full items-center gap-2 rounded-lg bg-[#075473]/30 px-2 py-1.5 text-left text-xs font-semibold text-[#7dd3fc]"
                          : "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-800"
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={el.src}
                        alt=""
                        className="h-7 w-7 object-contain"
                      />
                      {el.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Selected · {ELEMENT_LIST.find((e) => e.id === selected)?.label}
              </p>
              <label className="mt-3 block text-xs text-zinc-400">
                Right % ({sel.right})
                <input
                  type="range"
                  min={-20}
                  max={100}
                  step={0.5}
                  value={sel.right}
                  onChange={(e) =>
                    updateSelected({ right: Number(e.target.value) })
                  }
                  className="mt-1 w-full accent-[#075473]"
                />
              </label>
              <label className="mt-2 block text-xs text-zinc-400">
                Bottom % ({sel.bottom})
                <input
                  type="range"
                  min={-20}
                  max={80}
                  step={0.5}
                  value={sel.bottom}
                  onChange={(e) =>
                    updateSelected({ bottom: Number(e.target.value) })
                  }
                  className="mt-1 w-full accent-[#075473]"
                />
              </label>
              <label className="mt-2 block text-xs text-zinc-400">
                Height % ({sel.height})
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={1}
                  value={sel.height}
                  onChange={(e) =>
                    updateSelected({ height: Number(e.target.value) })
                  }
                  className="mt-1 w-full accent-[#075473]"
                />
              </label>
              <label className="mt-2 block text-xs text-zinc-400">
                Z-index ({sel.z})
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={sel.z}
                  onChange={(e) =>
                    updateSelected({ z: Number(e.target.value) })
                  }
                  className="mt-1 w-full accent-[#075473]"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
