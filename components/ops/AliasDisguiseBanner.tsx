"use client";

import { EyeOff, X } from "lucide-react";
import {
  aliasLabel,
  roleTypeLabel,
  type AliasSession,
} from "@/lib/aliasMode";

export function AliasDisguiseBanner({
  alias,
  onExit,
  compact,
}: {
  alias: AliasSession;
  onExit: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100 backdrop-blur",
        compact ? "text-[11px]" : "text-xs",
      ].join(" ")}
    >
      <p className="inline-flex min-w-0 items-center gap-2 font-medium">
        <EyeOff className={compact ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
        <span className="truncate">
          Currently Disguised as {roleTypeLabel(alias.roleType)}:{" "}
          <span className="font-mono text-amber-50">{aliasLabel(alias)}</span>
          <span className="ml-1 font-normal text-amber-200/70">
            (preview filter only — auth unchanged)
          </span>
        </span>
      </p>
      <button
        type="button"
        onClick={onExit}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-50 hover:bg-amber-500/25"
      >
        <X className="h-3.5 w-3.5" />
        Exit Alias Mode
      </button>
    </div>
  );
}
