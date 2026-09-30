"use client";

import { create } from "zustand";

export type SystemMessageTone = "info" | "error" | "tip";

export type SystemMessage = {
  id: string;
  text: string;
  tone: SystemMessageTone;
  durationMs: number;
  /** Optional fox image override (default /brand/fox-peek.webp). */
  foxSrc?: string;
  /** Peek side — right uses fox-peek-right assets. */
  side?: "left" | "right";
};

type SystemMessageState = {
  message: SystemMessage | null;
  show: (input: {
    text: string;
    tone?: SystemMessageTone;
    durationMs?: number;
    foxSrc?: string;
    side?: "left" | "right";
  }) => void;
  dismiss: () => void;
};

let seq = 0;

/**
 * Global fox speech-bubble messages (errors, tips, instructions).
 * Mount `<SystemMessageFox />` once in the builder shell.
 */
export const useSystemMessageStore = create<SystemMessageState>((set) => ({
  message: null,
  show: ({ text, tone = "info", durationMs, foxSrc, side }) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    seq += 1;
    // Longer copy stays up longer (default ~6.8–10s)
    const auto = Math.min(10_000, Math.max(6800, 3200 + trimmed.length * 55));
    set({
      message: {
        id: `sys-${seq}-${Date.now()}`,
        text: trimmed,
        tone,
        durationMs: Math.max(2800, durationMs ?? auto),
        foxSrc,
        side: side ?? (foxSrc ? "right" : "left"),
      },
    });
  },
  dismiss: () => set({ message: null }),
}));

/** Imperative helper — safe outside React components. */
export function showSystemMessage(input: {
  text: string;
  tone?: SystemMessageTone;
  durationMs?: number;
  foxSrc?: string;
  side?: "left" | "right";
}): void {
  useSystemMessageStore.getState().show(input);
}

export function dismissSystemMessage(): void {
  useSystemMessageStore.getState().dismiss();
}
