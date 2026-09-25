"use client";

import { useEffect } from "react";

/** ESC + optional body scroll lock while a modal is open. */
export function useModalDismiss(
  open: boolean,
  onClose: () => void,
  opts?: { lockScroll?: boolean }
) {
  const lockScroll = opts?.lockScroll !== false;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    if (lockScroll) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, lockScroll]);
}
