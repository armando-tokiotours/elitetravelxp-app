"use client";

import type { ReactNode } from "react";

/** Debug/inspection outline for Travel Dossier layout sections. */
export function DossierSectionOutline({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto my-6 w-full max-w-2xl rounded-2xl border-2 border-dashed border-white/40 bg-black/20 p-4 ${className}`}
    >
      <span className="absolute -top-3 left-4 rounded border border-white/30 bg-zinc-800 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white">
        {label}
      </span>
      {children}
    </div>
  );
}
