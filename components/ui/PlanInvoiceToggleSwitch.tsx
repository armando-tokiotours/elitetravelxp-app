"use client";

import React from "react";

interface Props {
  activeTab: "plan" | "invoice";
  onChange: (tab: "plan" | "invoice") => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Simple black-and-white pill toggle — PLAN (left) ↔ INVOICE (right).
 * Solid black track, solid white selected pill, black label on the
 * selected side, white label on the unselected side. No gradient/gloss.
 */
export function PlanInvoiceToggleSwitch({
  activeTab,
  onChange,
  disabled = false,
  className = "",
}: Props) {
  const isInvoice = activeTab === "invoice";

  const select = (tab: "plan" | "invoice") => {
    if (disabled || tab === activeTab) return;
    onChange(tab);
  };

  return (
    <div
      role="switch"
      aria-checked={isInvoice}
      aria-label="Plan or Invoice view"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (disabled) return;
        onChange(isInvoice ? "plan" : "invoice");
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(isInvoice ? "plan" : "invoice");
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          select("plan");
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          select("invoice");
        }
      }}
      className={`relative inline-flex h-9 w-36 cursor-pointer select-none items-center rounded-full bg-black p-1 shadow-[0_2px_10px_rgba(0,0,0,0.35)] ring-1 ring-white/15 transition-opacity sm:h-10 sm:w-44 ${
        disabled ? "cursor-not-allowed opacity-45" : ""
      } ${className}`}
    >
      {/* Solid white selected pill — slides between halves */}
      <div
        aria-hidden
        className={`pointer-events-none absolute top-1 bottom-1 left-1 z-0 w-[calc(50%-4px)] rounded-full bg-white transition-transform duration-300 ease-out ${
          isInvoice ? "translate-x-full" : "translate-x-0"
        }`}
      />

      {/* PLAN (left) */}
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        aria-pressed={!isInvoice}
        onClick={(e) => {
          e.stopPropagation();
          select("plan");
        }}
        className={`relative z-10 flex h-full flex-1 items-center justify-center text-center font-godiva text-[10px] tracking-widest uppercase transition-colors duration-300 sm:text-xs ${
          !isInvoice ? "font-bold text-black" : "font-medium text-white"
        }`}
      >
        PLAN
      </button>

      {/* INVOICE (right) */}
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        aria-pressed={isInvoice}
        onClick={(e) => {
          e.stopPropagation();
          select("invoice");
        }}
        className={`relative z-10 flex h-full flex-1 items-center justify-center text-center font-godiva text-[10px] tracking-widest uppercase transition-colors duration-300 sm:text-xs ${
          isInvoice ? "font-bold text-black" : "font-medium text-white"
        }`}
      >
        INVOICE
      </button>
    </div>
  );
}
