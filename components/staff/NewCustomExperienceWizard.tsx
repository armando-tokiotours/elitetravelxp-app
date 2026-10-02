"use client";

import { useState } from "react";

export type CustomExperienceWizardPayload = {
  type: "NEW_CUSTOM_EXPERIENCE";
  pnr: string;
  title: string;
  category: "EXPERIENCE" | "SERVICE" | "TRANSPORT";
  proposedPriceEur: number;
  description: string;
};

type Props = {
  pnr: string;
  onClose: () => void;
  onRequestApproval: (payload: CustomExperienceWizardPayload) => Promise<void>;
};

/**
 * Agent drafts an unlisted activity → routes to Ops Manager via OPS channel.
 */
export function NewCustomExperienceWizard({
  pnr,
  onClose,
  onRequestApproval,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<
    "EXPERIENCE" | "SERVICE" | "TRANSPORT"
  >("EXPERIENCE");
  const [proposedPriceEur, setProposedPriceEur] = useState(150);
  const [description, setDescription] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendWizardRequest = async () => {
    if (!title.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await onRequestApproval({
        type: "NEW_CUSTOM_EXPERIENCE",
        pnr,
        title: title.trim(),
        category,
        proposedPriceEur: Math.max(0, Math.round(proposedPriceEur)),
        description: description.trim(),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send request");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New custom activity request"
        className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-[#0A1017] p-6 text-xs text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
              Agent request wizard
            </span>
            <h3 className="text-sm font-bold tracking-wide text-white uppercase">
              New custom activity request
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Activity / service title
            </label>
            <input
              type="text"
              placeholder="e.g. Private Helicopter Tsukiji Overlook…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Category
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as "EXPERIENCE" | "SERVICE" | "TRANSPORT"
                )
              }
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 py-2 text-white"
            >
              <option value="EXPERIENCE">Tour experience</option>
              <option value="SERVICE">Concierge service</option>
              <option value="TRANSPORT">Special transport</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Proposed price (€)
            </label>
            <input
              type="number"
              min={0}
              value={proposedPriceEur}
              onChange={(e) => setProposedPriceEur(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 py-2 font-mono text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Description / vendor details
            </label>
            <textarea
              rows={3}
              placeholder="Provide vendor rates or special details for Ops Manager review…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] p-3 text-white"
            />
          </div>
        </div>

        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-[10px] text-purple-200">
          Submitting sends a creation request to the Operations Manager in the
          internal OPS chat for official approval and catalog entry.
        </div>

        {error ? <p className="text-[11px] text-red-400">{error}</p> : null}

        <button
          type="button"
          disabled={isSending || !title.trim()}
          onClick={() => void handleSendWizardRequest()}
          className="w-full rounded-xl bg-purple-600 py-3.5 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition hover:bg-purple-500 disabled:opacity-40"
        >
          {isSending
            ? "Sending request…"
            : "Send creation request to Ops Manager →"}
        </button>
      </div>
    </div>
  );
}
