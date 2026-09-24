"use client";

import { ChevronDown } from "lucide-react";
import { cityLanguageChoices } from "@/lib/tourLanguages";

/**
 * Glass city-level language dropdown with flag labels.
 * Used above per-tour language pills in Experiences & Places.
 */
export function CityLanguageSelect({
  cityName,
  availableLanguages,
  value,
  onChange,
}: {
  cityName: string;
  availableLanguages?: unknown;
  value: string;
  onChange: (code: string) => void;
}) {
  const options = cityLanguageChoices(availableLanguages);
  const safeValue =
    options.find((o) => o.code === value)?.code || options[0]?.code || "EN";

  return (
    <div className="mb-4 space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1BA58A]">
        Preferred tour language for {cityName || "city"}
      </label>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
        Available city languages
      </p>
      <div className="relative">
        <select
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Preferred tour language for ${cityName}`}
          className="w-full cursor-pointer appearance-none rounded-xl border border-white/15 bg-[#0D1117]/90 py-2.5 pl-3 pr-10 text-xs text-white backdrop-blur-md outline-none transition focus:border-[#1BA58A]"
        >
          {options.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
      </div>
    </div>
  );
}
