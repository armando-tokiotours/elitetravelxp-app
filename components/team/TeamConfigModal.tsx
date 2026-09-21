"use client";

import { X } from "lucide-react";
import { TeamConfigDashboard } from "@/components/team/TeamConfigDashboard";

/**
 * Modal wrapper around TeamConfigDashboard for quick access from nav gear.
 */
export function TeamConfigModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-config-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#121212] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#2C2C2E] px-4 py-3 sm:px-5">
          <h2 id="team-config-title" className="sr-only">
            Team Email Settings
          </h2>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#B85304]">
            ⚙️ Team Email Settings
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-[#1C1C1E] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-6">
          <TeamConfigDashboard compact onSaved={onClose} />
        </div>
      </div>
    </div>
  );
}
