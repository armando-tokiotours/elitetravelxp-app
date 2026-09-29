"use client";

import { useState } from "react";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import {
  SYSTEM_MESSAGE_CATALOG,
  getSystemMessage,
  readSystemMessageOverrides,
  writeSystemMessageOverrides,
  type SystemMessageKey,
} from "@/lib/systemMessages";

export function FoxMessagesEditor() {
  const [drafts, setDrafts] = useState<
    Partial<Record<SystemMessageKey, string>>
  >(() => readSystemMessageOverrides());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const save = () => {
    const cleaned: Partial<Record<SystemMessageKey, string>> = {};
    for (const m of SYSTEM_MESSAGE_CATALOG) {
      const v = (drafts[m.key] || "").trim();
      if (v && v !== m.defaultText) cleaned[m.key] = v;
    }
    writeSystemMessageOverrides(cleaned);
    setDrafts(cleaned);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const resetAll = () => {
    writeSystemMessageOverrides({});
    setDrafts({});
    setSavedAt(new Date().toLocaleTimeString());
  };

  const groups = ["pre_elite", "builder_m", "builder_s", "itinerary"] as const;

  return (
    <div className="relative min-h-[22rem] space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Fox message catalog
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Short copy only. Empty field uses the default. Saved in this browser.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-[#075473] px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-white"
          >
            Save messages
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-xl border border-zinc-700 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300"
          >
            Reset defaults
          </button>
          {savedAt ? (
            <span className="self-center text-xs text-[#1CA67F]">
              Saved {savedAt}
            </span>
          ) : null}
        </div>
      </div>

      {groups.map((group) => (
        <div
          key={group}
          className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {group.replace("_", " ")}
          </p>
          <ul className="mt-3 space-y-3">
            {SYSTEM_MESSAGE_CATALOG.filter((m) => m.group === group).map(
              (m) => (
                <li key={m.key} className="grid gap-1 sm:grid-cols-[11rem_1fr]">
                  <label
                    htmlFor={`sys-${m.key}`}
                    className="text-xs text-zinc-400 sm:pt-2"
                  >
                    {m.label}
                  </label>
                  <input
                    id={`sys-${m.key}`}
                    value={drafts[m.key] ?? m.defaultText}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [m.key]: e.target.value }))
                    }
                    className="rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </li>
              )
            )}
          </ul>
        </div>
      ))}

      <div className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Fire a fox message
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              showSystemMessage({
                text: getSystemMessage("builder_s_step3"),
                tone: "tip",
              })
            }
            className="rounded-xl border border-[#1BA58A]/50 bg-[#1BA58A]/15 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#7dd3c0]"
          >
            Tip
          </button>
          <button
            type="button"
            onClick={() =>
              showSystemMessage({
                text: getSystemMessage("payment_not_ready"),
                tone: "error",
              })
            }
            className="rounded-xl border border-[#E60F43]/50 bg-[#E60F43]/15 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#ff8aa8]"
          >
            Error
          </button>
          <button
            type="button"
            onClick={() =>
              showSystemMessage({
                text: getSystemMessage("sending_again"),
                tone: "info",
              })
            }
            className="rounded-xl border border-[#075473]/50 bg-[#075473]/20 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-[#7dd3fc]"
          >
            Instruction
          </button>
        </div>
      </div>

      <div className="relative h-64 overflow-hidden rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/80">
        <p className="absolute left-4 top-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-600">
          Preview stage
        </p>
        <SystemMessageFox />
      </div>
    </div>
  );
}
