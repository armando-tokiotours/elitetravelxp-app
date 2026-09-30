"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function touchDistance(a: Touch, b: Touch) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function touchMid(a: Touch, b: Touch) {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  };
}

/**
 * Instagram-style pinch-zoom on a photo only (not the page).
 * Pinch zooms + pans the media; release snaps back to 1×.
 * Native non-passive touch listeners so Safari does not zoom the whole UI.
 */
export function PinchZoomPhoto({
  children,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
    originX: number;
    originY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const panRef = useRef<{
    x: number;
    y: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const transformRef = useRef({ scale: 1, tx: 0, ty: 0 });

  const apply = useCallback(() => {
    const el = layerRef.current;
    if (!el) return;
    const { scale, tx, ty } = transformRef.current;
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    el.style.zIndex = scale > 1.01 ? "30" : "";
  }, []);

  const reset = useCallback(() => {
    transformRef.current = { scale: 1, tx: 0, ty: 0 };
    const el = layerRef.current;
    if (el) {
      el.style.transition = "transform 180ms ease-out";
      el.style.transform = "translate3d(0,0,0) scale(1)";
      el.style.zIndex = "";
      window.setTimeout(() => {
        if (el) el.style.transition = "";
      }, 200);
    }
    pinchRef.current = null;
    panRef.current = null;
  }, []);

  useEffect(() => {
    if (disabled) reset();
  }, [disabled, reset]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onTouchStart = (e: TouchEvent) => {
      if (disabledRef.current) return;
      const layer = layerRef.current;
      if (layer) layer.style.transition = "";

      if (e.touches.length === 2) {
        const dist = touchDistance(e.touches[0], e.touches[1]);
        const mid = touchMid(e.touches[0], e.touches[1]);
        pinchRef.current = {
          startDist: Math.max(dist, 1),
          startScale: transformRef.current.scale,
          originX: mid.x,
          originY: mid.y,
          startTx: transformRef.current.tx,
          startTy: transformRef.current.ty,
        };
        panRef.current = null;
      } else if (e.touches.length === 1 && transformRef.current.scale > 1.05) {
        panRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          startTx: transformRef.current.tx,
          startTy: transformRef.current.ty,
        };
        pinchRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (disabledRef.current) return;

      if (pinchRef.current && e.touches.length === 2) {
        e.preventDefault();
        const pinch = pinchRef.current;
        const dist = touchDistance(e.touches[0], e.touches[1]);
        const mid = touchMid(e.touches[0], e.touches[1]);
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinch.startScale * (dist / pinch.startDist))
        );
        transformRef.current = {
          scale: nextScale,
          tx: pinch.startTx + (mid.x - pinch.originX),
          ty: pinch.startTy + (mid.y - pinch.originY),
        };
        apply();
        return;
      }

      if (panRef.current && e.touches.length === 1) {
        e.preventDefault();
        const pan = panRef.current;
        const t = e.touches[0];
        transformRef.current = {
          ...transformRef.current,
          tx: pan.startTx + (t.clientX - pan.x),
          ty: pan.startTy + (t.clientY - pan.y),
        };
        apply();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (disabledRef.current) return;
      if (e.touches.length === 0) {
        reset();
        return;
      }
      if (e.touches.length === 1 && transformRef.current.scale > 1.05) {
        pinchRef.current = null;
        panRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          startTx: transformRef.current.tx,
          startTy: transformRef.current.ty,
        };
      }
    };

    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd);
    stage.addEventListener("touchcancel", reset);

    return () => {
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", reset);
    };
  }, [apply, reset]);

  return (
    <div
      ref={stageRef}
      className={`relative overflow-hidden touch-none ${className}`}
    >
      <div
        ref={layerRef}
        className="h-full w-full will-change-transform"
        style={{ transformOrigin: "center center" }}
      >
        {children}
      </div>
    </div>
  );
}
