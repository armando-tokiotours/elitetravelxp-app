"use client";

import { STAFF_CREDENTIAL_LANGUAGES } from "@/lib/staffLanguages";

export function LanguagePills({
  selected,
  onToggle,
  disabled,
}: {
  selected: readonly string[];
  onToggle: (lang: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-400">
        Languages
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {STAFF_CREDENTIAL_LANGUAGES.map((l) => {
          const on = selected.includes(l);
          return (
            <button
              key={l}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(l)}
              className={`rounded-full px-2.5 py-1 text-[10px] ${
                on
                  ? "bg-[#075473] text-white"
                  : "border border-zinc-700 text-zinc-400"
              } disabled:opacity-50`}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
