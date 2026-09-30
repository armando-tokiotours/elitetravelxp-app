"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";

const SNAP_MINUTES = 15;
const MIN_HOUR = 6;
const MAX_HOUR = 20;

function parseTime(value: string): { hour: number; minute: number } {
  const m = String(value || "09:00").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hour: 9, minute: 0 };
  const hour = Math.min(MAX_HOUR, Math.max(MIN_HOUR, Number(m[1]) || 9));
  const minute = Math.min(59, Math.max(0, Number(m[2]) || 0));
  return { hour, minute };
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function snapMinute(raw: number): number {
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  if (snapped >= 60) return 0;
  return snapped;
}

/**
 * Radial alarm-clock style start-time picker (15-minute snaps, 06:00–20:00).
 */
export function AlarmClockPicker({
  value,
  onChange,
  label = "Start time",
}: {
  value: string;
  onChange: (hhmm: string) => void;
  label?: string;
}) {
  const uid = useId();
  const { hour, minute } = parseTime(value);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const angleDeg = useMemo(() => {
    if (mode === "hour") {
      const h12 = hour % 12;
      return h12 * 30 + (minute / 60) * 30;
    }
    return (minute / 60) * 360;
  }, [hour, minute, mode]);

  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = svgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;

      if (mode === "hour") {
        const h12 = Math.round(deg / 30) % 12;
        // Prefer morning tour window: map 12→12, then keep AM hours in range
        let nextHour = h12 === 0 ? 12 : h12;
        if (nextHour < MIN_HOUR) nextHour += 12;
        if (nextHour > MAX_HOUR) nextHour = MAX_HOUR;
        if (nextHour < MIN_HOUR) nextHour = MIN_HOUR;
        onChange(formatTime(nextHour, minute));
      } else {
        const rawMin = Math.round(deg / 6);
        const nextMin = snapMinute(rawMin >= 60 ? 0 : rawMin);
        onChange(formatTime(hour, nextMin));
      }
    },
    [hour, minute, mode, onChange]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    applyFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    applyFromPointer(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const handLen = mode === "hour" ? 58 : 70;
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const hx = 100 + handLen * Math.cos(rad);
  const hy = 100 + handLen * Math.sin(rad);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0D1117]/80 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1BA58A]">
        {label}
      </p>

      <div className="mt-3 flex items-center justify-center gap-1 font-godiva text-4xl tracking-wider text-white">
        <button
          type="button"
          aria-pressed={mode === "hour"}
          onClick={() => setMode("hour")}
          className={`rounded-lg px-2 py-1 transition ${
            mode === "hour"
              ? "bg-[#054F70] text-white"
              : "text-white/50 hover:text-white"
          }`}
        >
          {String(hour).padStart(2, "0")}
        </button>
        <span className="text-white/40" aria-hidden>
          :
        </span>
        <button
          type="button"
          aria-pressed={mode === "minute"}
          onClick={() => setMode("minute")}
          className={`rounded-lg px-2 py-1 transition ${
            mode === "minute"
              ? "bg-[#054F70] text-white"
              : "text-white/50 hover:text-white"
          }`}
        >
          {String(minute).padStart(2, "0")}
        </button>
      </div>

      <div className="mt-4 flex justify-center">
        <svg
          ref={svgRef}
          id={uid}
          viewBox="0 0 200 200"
          className="h-52 w-52 touch-none select-none"
          role="slider"
          aria-label={label}
          aria-valuetext={formatTime(hour, minute)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="#121820"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2"
          />
          <circle
            cx="100"
            cy="100"
            r="78"
            fill="none"
            stroke="rgba(246,167,36,0.18)"
            strokeWidth="1"
          />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            const x1 = 100 + 70 * Math.cos(a);
            const y1 = 100 + 70 * Math.sin(a);
            const x2 = 100 + 82 * Math.cos(a);
            const y2 = 100 + 82 * Math.sin(a);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={i % 3 === 0 ? 2.5 : 1.25}
              />
            );
          })}
          <line
            x1="100"
            y1="100"
            x2={hx}
            y2={hy}
            stroke="#F6A724"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="6" fill="#F6A724" />
          <circle cx={hx} cy={hy} r="8" fill="#F6A724" />
        </svg>
      </div>

      <p className="mt-2 text-center font-mono text-[11px] text-white/45">
        Drag the dial · {mode === "hour" ? "set hour" : "set minutes (15′)"} ·
        default 09:00
      </p>
    </div>
  );
}
