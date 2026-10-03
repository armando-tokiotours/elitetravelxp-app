"use client";

import React from "react";

interface Props {
  activeTab: "plan" | "invoice";
  onChange: (tab: "plan" | "invoice") => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Skeuomorphic pill toggle — PLAN (left) ↔ INVOICE (right).
 * Glossy metallic circular knob on a dark inset track.
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
      className={`relative inline-flex h-9 w-36 cursor-pointer select-none items-center rounded-full border-2 border-white/20 bg-[#0A1017] p-1 shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)] transition-opacity sm:h-10 sm:w-44 ${
        disabled ? "cursor-not-allowed opacity-45" : ""
      } ${className}`}
    >
      {/* Active track tint */}
      <div
        className={`pointer-events-none absolute inset-0.5 rounded-full transition-all duration-300 ${
          isInvoice ? "bg-[#075473]/45" : "bg-white/[0.04]"
        }`}
        aria-hidden
      />

      {/* PLAN (left) */}
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          select("plan");
        }}
        className={`relative z-10 flex-1 pr-1 text-center font-godiva text-[10px] tracking-widest uppercase transition-colors duration-300 sm:text-xs ${
          !isInvoice
            ? "font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            : "text-zinc-300"
        }`}
      >
        PLAN
      </button>

      {/* INVOICE (right) */}
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          select("invoice");
        }}
        className={`relative z-10 flex-1 pl-1 text-center font-godiva text-[10px] tracking-widest uppercase transition-colors duration-300 sm:text-xs ${
          isInvoice
            ? "font-bold text-[#F6A724] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            : "text-zinc-300"
        }`}
      >
        INVOICE
      </button>

      {/* Skeuomorphic sliding metallic knob — half-width cover + grip */}
      <div
        aria-hidden
        className={`pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 z-20 flex w-[calc(50%-2px)] items-center justify-center rounded-full border border-white/60 bg-gradient-to-b from-white via-[#E8E8EC] to-[#A8A8B0] shadow-[0_4px_12px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out ${
          isInvoice ? "translate-x-full" : "translate-x-0"
        }`}
      >
        <span
          className={`font-godiva text-[8px] font-bold tracking-[0.14em] uppercase sm:text-[9px] ${
            isInvoice ? "text-[#075473]" : "text-[#0A1017]"
          }`}
        >
          {isInvoice ? "INVOICE" : "PLAN"}
        </span>
        <span className="absolute right-1.5 h-2.5 w-1 rounded-full bg-gradient-to-b from-gray-400/50 to-gray-500/40 sm:right-2" />
      </div>
    </div>
  );
}
