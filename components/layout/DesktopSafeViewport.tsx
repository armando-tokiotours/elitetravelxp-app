"use client";

import type { ReactNode } from "react";

type MaxWidth = "max-w-md" | "max-w-lg" | "max-w-xl";

/**
 * Desktop safe-space frame for full-screen media modals / reels.
 * Mobile: edge-to-edge. sm+: centered phone/tablet column with blurred side backdrop.
 */
export function DesktopSafeViewport({
  children,
  onClose,
  maxWidth = "max-w-md",
  zIndexClass = "z-[50]",
  frameClassName = "",
  backdropClassName = "bg-black/80 backdrop-blur-md",
}: {
  children: ReactNode;
  onClose?: () => void;
  maxWidth?: MaxWidth;
  /** Tailwind z-index utility, e.g. z-[200] */
  zIndexClass?: string;
  /** Extra classes on the inner phone frame */
  frameClassName?: string;
  backdropClassName?: string;
}) {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center ${backdropClassName} ${zIndexClass}`}
      role="presentation"
    >
      {onClose ? (
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Close"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0" aria-hidden />
      )}

      <div
        className={`relative z-10 mx-auto flex h-full w-full flex-col overflow-hidden bg-[#0A1017] shadow-2xl transition-all sm:h-[92vh] sm:rounded-3xl sm:border sm:border-white/10 ${maxWidth} ${frameClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
