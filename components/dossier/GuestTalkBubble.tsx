"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { GuestCommPage } from "@/components/dossier/GuestCommPage";
import { useConciergeAgent } from "@/lib/useConciergeAgent";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import {
  GUEST_COMM_OPEN_EVENT,
  isGuestTalkUnlocked,
  type GuestCommOpenDetail,
} from "@/lib/guestTalkChat";

const STORAGE_KEY = "tokiotours.guestTalkBubble.position";
const DRAG_THRESHOLD_PX = 6;
const FAB_SIZE_PX = 56;
const EDGE_INSET_PX = 20;
const EDGE_INSET_LG_PX = 32;
const DEFAULT_BOTTOM_MOBILE_PX = 192;
const DEFAULT_BOTTOM_DESKTOP_PX = 128;
const TOP_GAP_PX = 16;
const DOCK_HEIGHT_PX = 64;
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
  const value =
    parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) ||
    0;
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
    if (
      typeof parsed.bottomPx !== "number" ||
      !Number.isFinite(parsed.bottomPx)
    ) {
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
    /* ignore */
  }
}

function nearestSide(clientX: number): DockSide {
  return clientX < window.innerWidth / 2 ? "left" : "right";
}

/**
 * Floating guest talk bubble — opens GuestCommPage as an overlay modal
 * (no route navigation / no WhatsApp). Locked until Concierge Deposit + agent.
 */
export function GuestTalkBubble({
  pnr,
  guestName,
  guestEmail,
  feeCreditEur = 0,
  totalPaidEur = 0,
  conciergeFeeEur = DEFAULT_CONCIERGE_FEE_EUR,
}: {
  pnr: string;
  guestName?: string;
  guestEmail?: string;
  /** @deprecated Unused — chat opens as modal on the current page. */
  tripPath?: string;
  feeCreditEur?: number;
  totalPaidEur?: number;
  conciergeFeeEur?: number;
}) {
  const ref = String(pnr || "").trim();
  const agent = useConciergeAgent(ref);
  const agentName = agent?.name || null;
  const agentAssigned = Boolean(agentName);
  const unlocked = isGuestTalkUnlocked({
    feeCreditEur,
    totalPaidEur,
    conciergeFeeEur,
  });
  const canOpenChat = unlocked && agentAssigned;

  const [pos, setPos] = useState<FabPosition>(() => defaultPosition());
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const stored = readStoredPosition();
    const next = stored ?? defaultPosition();
    setPos({ side: next.side, bottomPx: clampBottomPx(next.bottomPx) });
    setReady(true);
  }, []);

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

  useEffect(() => {
    if (!chatOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [chatOpen]);

  // Coordination Team (and others) can request the same modal without routing
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<GuestCommOpenDetail>).detail;
      const eventPnr = String(detail?.pnr || "").trim();
      if (!eventPnr || eventPnr.toUpperCase() !== ref.toUpperCase()) return;
      if (!unlocked) {
        showSystemMessage({
          text: getSystemMessage("guest_comm_needs_deposit"),
          tone: "info",
        });
        return;
      }
      if (!agentAssigned) {
        showSystemMessage({
          text: getSystemMessage("guest_comm_needs_agent"),
          tone: "info",
        });
        return;
      }
      setChatOpen(true);
    };
    window.addEventListener(GUEST_COMM_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(GUEST_COMM_OPEN_EVENT, onOpen);
  }, [ref, unlocked, agentAssigned]);

  if (!ref || ref === "—" || ref.includes("····")) return null;

  const openChat = () => {
    if (!unlocked) {
      showSystemMessage({
        text: getSystemMessage("guest_comm_needs_deposit"),
        tone: "info",
      });
      return;
    }
    if (!agentAssigned) {
      showSystemMessage({
        text: getSystemMessage("guest_comm_needs_agent"),
        tone: "info",
      });
      return;
    }
    setChatOpen(true);
  };

  const inset = edgeInsetPx();
  const style: CSSProperties = {
    left: pos.side === "left" ? inset : "auto",
    right: pos.side === "right" ? inset : "auto",
    bottom: pos.bottomPx,
    touchAction: "none",
    opacity: ready ? (unlocked ? 1 : 0.72) : 0,
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
      const bottomPx = clampBottomPx(
        drag.originBottomPx - (e.clientY - drag.startY)
      );
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

  const title = !unlocked
    ? "Unlocks after €60 Concierge Deposit"
    : canOpenChat
      ? agentName
        ? `Message ${agentName}`
        : "Open messages"
      : "Agent required to open chat";

  const modal =
    mounted && chatOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] flex flex-col bg-[#05080C] print:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Concierge chat"
          >
            <Suspense
              fallback={
                <p className="px-4 py-10 text-sm text-zinc-500">
                  Opening messages…
                </p>
              }
            >
              <GuestCommPage
                embedded
                pnr={ref}
                guestEmail={guestEmail}
                guestName={guestName}
                onClose={() => setChatOpen(false)}
              />
            </Suspense>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={style}
        className={`no-print fixed z-50 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-[#1CA67F] text-white shadow-2xl transition-[background-color,transform,opacity] hover:bg-[#178f6c] print:hidden ${
          dragging ? "cursor-grabbing scale-105" : "active:scale-95"
        } ${!unlocked ? "ring-2 ring-amber-400/70" : ""}`}
        aria-label={title}
        title={title}
      >
        <MessageCircle className="h-6 w-6" aria-hidden />
        {!canOpenChat ? (
          <span
            className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0D1117] ${
              !unlocked ? "bg-amber-400" : "bg-zinc-400"
            }`}
            aria-hidden
          />
        ) : null}
      </button>
      {modal}
    </>
  );
}
