"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Mini picture shortcut used on Admin / Team Access / Ops staff chrome.
 */
export function ShortcutTile({
  href,
  label,
  icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition ${
        active
          ? "border-[#075473] bg-[#075473]/20"
          : "border-zinc-800 bg-[#1C1C1E] hover:border-[#075473] hover:bg-[#075473]/15"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 transition ${
          active
            ? "text-[#7dd3fc]"
            : "text-zinc-300 group-hover:text-[#7dd3fc]"
        }`}
      >
        {icon}
      </span>
      <span
        className={`text-[0.65rem] font-bold tracking-wide ${
          active ? "text-white" : "text-zinc-400 group-hover:text-white"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
