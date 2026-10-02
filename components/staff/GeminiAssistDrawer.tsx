"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type GeminiAssistPromptType =
  | "DISCOUNT_RULE"
  | "DRAFT_REPLY"
  | "SUICA_EXPLAIN"
  | "WORKLOAD_RULE"
  | "GENERAL";

type Props = {
  pnr: string;
  guestMessage: string;
  onApplyReply: (suggestedText: string) => void;
  /** Only show Apply when composing on CUST (or when parent allows) */
  canApplyToComposer?: boolean;
};

/**
 * Gemini System AI Rules Assistant — portal modal with Ask bar,
 * knowledge-base grounding, and optional Google Search.
 */
export function GeminiAssistDrawer({
  pnr,
  guestMessage,
  onApplyReply,
  canApplyToComposer = true,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [knowledgeDocCount, setKnowledgeDocCount] = useState(0);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const consultAI = async (opts: {
    prompt?: string;
    promptType?: GeminiAssistPromptType;
  }) => {
    const prompt = String(opts.prompt || "").trim();
    if (!opts.promptType && !prompt) {
      setError("Type a question or pick a quick action");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gemini/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr,
          guestMessage,
          promptType: opts.promptType || "GENERAL",
          prompt: prompt || undefined,
          enableSearch: enableWebSearch,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        source?: string;
        knowledgeDocCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Assist unavailable");
        return;
      }
      setAiSuggestion(String(data.reply || "").trim());
      setSource(data.source || null);
      setKnowledgeDocCount(Number(data.knowledgeDocCount) || 0);
    } catch {
      setError("Could not reach Gemini Assist");
    } finally {
      setIsLoading(false);
    }
  };

  const modal =
    isOpen && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="Gemini Assist"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <div className="max-h-[min(92vh,42rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-cyan-500/40 bg-[#0A1017] p-5 text-xs text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                  <span aria-hidden>✨</span>
                  Gemini system AI rules &amp; web search
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="font-bold text-gray-400 hover:text-white"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Ask anything */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                    Ask system rules or search Tokyo info
                  </span>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={enableWebSearch}
                      onChange={(e) => setEnableWebSearch(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span className="text-[9px] font-bold tracking-wider text-cyan-300 uppercase">
                      🌐 Google web search
                    </span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Can we run a 4-hour night tour? · Shibuya Sky hours today?"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void consultAI({ prompt: customPrompt });
                      }
                    }}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0D1117] px-3 py-2 text-white outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    disabled={isLoading || !customPrompt.trim()}
                    onClick={() => void consultAI({ prompt: customPrompt })}
                    className="rounded-xl bg-[#075473] px-4 py-2 text-[10px] font-bold tracking-wider text-white uppercase disabled:opacity-40"
                  >
                    Ask AI
                  </button>
                </div>
              </div>

              {/* Quick actions */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                  Quick action rules
                </span>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      void consultAI({ promptType: "DRAFT_REPLY" })
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-gray-200 hover:bg-white/10 disabled:opacity-40"
                  >
                    📝 Draft customer reply
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      void consultAI({ promptType: "DISCOUNT_RULE" })
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-gray-200 hover:bg-white/10 disabled:opacity-40"
                  >
                    🔍 15% discount rule
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      void consultAI({ promptType: "WORKLOAD_RULE" })
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-gray-200 hover:bg-white/10 disabled:opacity-40"
                  >
                    ⏱️ Guide workload
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() =>
                      void consultAI({ promptType: "SUICA_EXPLAIN" })
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-gray-200 hover:bg-white/10 disabled:opacity-40"
                  >
                    💳 Suica / transit
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="animate-pulse rounded-xl bg-[#0D1117] p-4 text-center font-mono text-[11px] text-cyan-300">
                  Consulting uploaded SOP documents
                  {enableWebSearch ? " & live web" : ""}…
                </div>
              ) : null}

              {error ? (
                <p className="text-[11px] text-red-400">{error}</p>
              ) : null}

              {!isLoading && aiSuggestion ? (
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#0D1117] p-4">
                  <div className="flex flex-wrap gap-2 font-mono text-[9px] tracking-wider text-zinc-500 uppercase">
                    {source ? (
                      <span>
                        Source:{" "}
                        {source === "gemini" ? "Gemini API" : "Rules fallback"}
                      </span>
                    ) : null}
                    <span>KB docs: {knowledgeDocCount}</span>
                    {enableWebSearch ? <span>Search: on</span> : null}
                  </div>
                  <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-200">
                    {aiSuggestion}
                  </p>
                  {canApplyToComposer ? (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyReply(aiSuggestion);
                        setIsOpen(false);
                      }}
                      className="w-full rounded-lg bg-[#075473] py-2 text-[10px] font-bold tracking-wider text-white uppercase"
                    >
                      Use this reply in Comms Hub →
                    </button>
                  ) : null}
                </div>
              ) : null}

              <p className="text-[9px] leading-relaxed text-zinc-500">
                Uses built-in SOPs + uploads from{" "}
                <a
                  href="/ops/settings/ai-rules"
                  className="text-cyan-400/80 underline hover:text-cyan-300"
                  onClick={() => setIsOpen(false)}
                >
                  AI Knowledge Studio
                </a>
                . Toggle Google Search for live Tokyo schedules, venues, and FX.
              </p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-[#075473] px-2.5 py-1 text-[10px] font-bold tracking-wider text-cyan-300 uppercase shadow-md transition hover:bg-[#075473]/80"
        title="Gemini Agent Assist"
      >
        <span aria-hidden>✨</span>
        <span>Gemini Assist</span>
      </button>
      {modal}
    </div>
  );
}
