"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useConciergeAgentName } from "@/lib/useConciergeAgentName";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";

const STORAGE_KEY = "tokiotours.guestTalkBubble.position";
const DRAG_THRESHOLD_PX = 6;
const FAB_SIZE_PX = 56; // h-14 / w-14
const EDGE_INSET_PX = 20; // right-5 / left-5
const EDGE_INSET_LG_PX = 32; // lg:right-8
const DEFAULT_BOTTOM_MOBILE_PX = 192; // bottom-48
const DEFAULT_BOTTOM_DESKTOP_PX = 128; // md:bottom-32
const TOP_GAP_PX = 16;
const DOCK_HEIGHT_PX = 64; // AppNavDock mobile h-16
const DOCK_GAP_PX = 12;

type DockSide = "left" | "right";

type FabPosition = {
  side: DockSide;
  bottomPx: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originBottomPx: number;
  dragging: boolean;
};

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

function isLgViewport() {
  return typeof window !== "undefined" && window.innerWidth >= 1024;
}

function edgeInsetPx() {
  return isLgViewport() ? EDGE_INSET_LG_PX : EDGE_INSET_PX;
}

function readSafeInset(side: "top" | "bottom") {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-${side}:env(safe-area-inset-${side},0px);`;
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0;
  probe.remove();
  return value;
}

function clampBottomPx(bottomPx: number) {
  const vh = window.innerHeight;
  const safeTop = readSafeInset("top");
  const safeBottom = readSafeInset("bottom");
  const minBottom =
    (isMobileViewport() ? DOCK_HEIGHT_PX + DOCK_GAP_PX : 24) + safeBottom;
  const maxBottom = Math.max(
    minBottom,
    vh - FAB_SIZE_PX - TOP_GAP_PX - safeTop
  );
  return Math.min(maxBottom, Math.max(minBottom, Math.round(bottomPx)));
}

function defaultPosition(): FabPosition {
  return {
    side: "right",
    bottomPx: isMobileViewport()
      ? DEFAULT_BOTTOM_MOBILE_PX
      : DEFAULT_BOTTOM_DESKTOP_PX,
  };
}

function readStoredPosition(): FabPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FabPosition>;
    if (parsed.side !== "left" && parsed.side !== "right") return null;
    if (typeof parsed.bottomPx !== "number" || !Number.isFinite(parsed.bottomPx)) {
      return null;
    }
    return { side: parsed.side, bottomPx: parsed.bottomPx };
  } catch {
    return null;
  }
}

function writeStoredPosition(pos: FabPosition) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore quota / private mode
  }
}

function nearestSide(clientX: number): DockSide {
  return clientX < window.innerWidth / 2 ? "left" : "right";
}

/**
 * Floating guest talk bubble (same look as Ops Comms Hub FAB).
 * Opens /comm only when a concierge agent is assigned; otherwise shows the fox tip.
 * Draggable vertically with left/right edge docking; position persists in localStorage.
 */
export function GuestTalkBubble({
  pnr,
  guestEmail,
  guestName,
  tripPath,
}: {
  pnr: string;
  guestEmail?: string;
  guestName?: string;
  /** Base itinerary path, e.g. /builder-single/itinerary */
  tripPath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const ref = String(pnr || "").trim();
  const agentName = useConciergeAgentName(ref);
  const assigned = Boolean(agentName && agentName.trim());

  const [pos, setPos] = useState<FabPosition>(() => defaultPosition());
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  // Hydrate from localStorage + clamp to current viewport
  useEffect(() => {
    const stored = readStoredPosition();
    const next = stored ?? defaultPosition();
    setPos({ side: next.side, bottomPx: clampBottomPx(next.bottomPx) });
    setReady(true);
  }, []);

  // Re-clamp on resize / orientation change
  useEffect(() => {
    const onResize = () => {
      setPos((prev) => ({
        ...prev,
        bottomPx: clampBottomPx(prev.bottomPx),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Chat is a full /comm page — hide FAB there so it never covers the thread UI
  const chatOpen = Boolean(pathname?.includes("/comm"));

  if (!ref || ref === "—" || ref.includes("····")) return null;
  if (chatOpen) return null;

  const openChat = () => {
    if (!assigned) {
      showSystemMessage({
        text: getSystemMessage("guest_comm_needs_agent"),
        tone: "info",
      });
      return;
    }
    const base = tripPath.replace(/\/$/, "");
    const qs = new URLSearchParams({
      pnr: ref,
      guestEmail: guestEmail || "",
      guestName: guestName || "",
    });
    router.push(`${base}/comm?${qs.toString()}`);
  };

  const inset = edgeInsetPx();
  const style: CSSProperties = {
    left: pos.side === "left" ? inset : "auto",
    right: pos.side === "right" ? inset : "auto",
    bottom: pos.bottomPx,
    touchAction: "none",
    opacity: ready ? 1 : 0,
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originBottomPx: pos.bottomPx,
      dragging: false,
    };
    suppressClickRef.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      setDragging(true);
      suppressClickRef.current = true;
    }

    const nextBottom = clampBottomPx(drag.originBottomPx - dy);
    const side = nearestSide(e.clientX);
    setPos({ side, bottomPx: nextBottom });
  };

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (drag.dragging) {
      const side = nearestSide(e.clientX);
      const bottomPx = clampBottomPx(drag.originBottomPx - (e.clientY - drag.startY));
      const next = { side, bottomPx };
      setPos(next);
      writeStoredPosition(next);
    }

    dragRef.current = null;
    setDragging(false);
  };

  const onClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    openChat();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={style}
      className={`no-print fixed z-50 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-[#1CA67F] text-white shadow-2xl transition-[background-color,transform,opacity] hover:bg-[#178f6c] ${
        dragging ? "cursor-grabbing scale-105" : "active:scale-95"
      }`}
      aria-label={
        assigned
          ? `Chat with ${agentName}`
          : "Talk to your TokioTours agent"
      }
      title={
        assigned
          ? `Chat with ${agentName}`
          : "Agent required to open chat"
      }
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
      {!assigned ? (
        <span
          className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0D1117] bg-amber-400"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
