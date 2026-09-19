"use client";

import { useEffect, useRef, useState } from "react";

function prefersHover(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Hybrid tooltip: hover open/close on desktop; tap-toggle + outside dismiss on touch.
 * Click always toggles so mobile and fine-pointer devices both get a reliable open path.
 */
export function useHybridTooltip() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [isOpen]);

  const onMouseEnter = () => {
    if (prefersHover()) setIsOpen(true);
  };

  const onMouseLeave = () => {
    if (prefersHover()) setIsOpen(false);
  };

  /** Toggle on touch / coarse pointers; no-op toggle on fine hover (hover handles it). */
  const onTriggerClick = () => {
    if (!prefersHover()) {
      setIsOpen((prev) => !prev);
    }
  };

  /** Always toggle — for badges / transit pills whose tip should open on tap. */
  const onToggleClick = () => {
    setIsOpen((prev) => !prev);
  };

  return {
    isOpen,
    setIsOpen,
    containerRef,
    onMouseEnter,
    onMouseLeave,
    onTriggerClick,
    onToggleClick,
  };
}
