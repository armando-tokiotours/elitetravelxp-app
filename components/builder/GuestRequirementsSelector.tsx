"use client";

import { useState } from "react";
import {
  MOBILITY_OPTIONS,
  formatGuestSpecialRequirementsStatusLine,
  guestSpecialRequirementsChoiceBadge,
  guestSpecialRequirementsChoicesComplete,
  guestSpecialRequirementsNotesRequired,
  guestSpecialRequirementsNotesVisible,
  guestSpecialRequirementsValidationError,
  type GuestSpecialRequirements,
} from "@/lib/guestSpecialRequirements";

type Category = "DIETARY" | "MOBILITY";

export type { GuestSpecialRequirements };

export function GuestRequirementsSelector({
  value,
  onChange,
  onAck,
  flat = false,
}: {
  value: GuestSpecialRequirements;
  onChange: (val: GuestSpecialRequirements) => void;
  /** Fired when both Dietary and Mobility have an explicit Yes/No. */
  onAck?: () => void;
  /** Borderless canvas section (Builder S full-page sub-steps). */
  flat?: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<Category>("DIETARY");

  const showNotes = guestSpecialRequirementsNotesVisible(value);
  const notesRequired = guestSpecialRequirementsNotesRequired(value);
  const validationError = guestSpecialRequirementsValidationError(value);
  const showNotesError = Boolean(validationError);
  const statusLine = formatGuestSpecialRequirementsStatusLine(value);
  const dietaryBadge = guestSpecialRequirementsChoiceBadge(value.hasDietary);
  const mobilityBadge = guestSpecialRequirementsChoiceBadge(value.hasMobility);

  const emit = (next: GuestSpecialRequirements) => {
    onChange(next);
    if (guestSpecialRequirementsChoicesComplete(next)) {
      onAck?.();
    }
  };

  const setDietary = (hasDietary: boolean) => {
    emit({
      ...value,
      hasDietary,
      // Clear notes when switching Dietary → No
      customNotes: hasDietary ? value.customNotes || "" : "",
    });
  };

  const setMobility = (next: boolean) => {
    emit({
      ...value,
      hasMobility: next,
      // Clear tags when switching Mobility → No
      mobilityTags: next ? value.mobilityTags || [] : [],
    });
  };

  const toggleMobility = (tag: string) => {
    const currentList = value.mobilityTags || [];
    const updated = currentList.includes(tag)
      ? currentList.filter((t) => t !== tag)
      : [...currentList, tag];
    emit({
      ...value,
      hasMobility: true,
      mobilityTags: updated,
    });
  };

  const tabClass = (id: Category) =>
    `px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all ${
      activeCategory === id
        ? "bg-[#F6A724] text-black shadow-md"
        : "bg-white/5 text-gray-400 hover:text-white"
    }`;

  const yesNoBtn = (selected: boolean, tone: "yes" | "no") => {
    const on =
      tone === "yes"
        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500"
        : "bg-white/10 text-zinc-200 border-white/40";
    return `px-4 py-2 rounded-xl border font-bold text-xs transition-all ${
      selected
        ? `${on} shadow-md`
        : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
    }`;
  };

  const tagBtn = (selected: boolean) =>
    `px-3 py-1.5 rounded-xl border font-bold text-xs transition-all ${
      selected
        ? "bg-blue-500/20 text-blue-400 border-blue-500 shadow-md"
        : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
    }`;

  return (
    <div
      className={`space-y-4 font-mono text-xs ${
        flat
          ? "bg-[#0D141C] p-4"
          : "rounded-2xl border border-white/10 bg-[#0A1017] p-4"
      }`}
    >
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveCategory("DIETARY")}
          className={tabClass("DIETARY")}
        >
          Dietary ({dietaryBadge})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory("MOBILITY")}
          className={tabClass("MOBILITY")}
        >
          Mobility ({mobilityBadge})
        </button>
      </div>

      {activeCategory === "DIETARY" ? (
        <div className="space-y-3">
          <span className="block text-[10px] font-bold uppercase text-gray-400">
            Any dietary needs or food allergies?
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDietary(true)}
              className={yesNoBtn(value.hasDietary === true, "yes")}
            >
              {value.hasDietary === true ? "✓ " : ""}Yes
            </button>
            <button
              type="button"
              onClick={() => setDietary(false)}
              className={yesNoBtn(value.hasDietary === false, "no")}
            >
              {value.hasDietary === false ? "✓ " : ""}No
            </button>
          </div>

          {showNotes ? (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <span className="block text-[10px] font-bold uppercase text-gray-400">
                Dietary notes
                {notesRequired ? (
                  <span className="ml-1 text-amber-300">* required</span>
                ) : null}
              </span>
              <textarea
                rows={3}
                placeholder="Describe dietary needs / allergies for guide & driver…"
                value={value.customNotes || ""}
                onChange={(e) => {
                  emit({ ...value, customNotes: e.target.value });
                }}
                aria-invalid={showNotesError}
                className={`w-full rounded-xl border bg-black/60 p-3 font-sans text-xs text-white outline-none ${
                  showNotesError
                    ? "border-amber-400 focus:border-amber-300"
                    : "border-white/20 focus:border-[#F6A724]"
                }`}
              />
              {showNotesError ? (
                <p className="text-[11px] font-sans font-medium text-amber-300">
                  {validationError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeCategory === "MOBILITY" ? (
        <div className="space-y-3">
          <span className="block text-[10px] font-bold uppercase text-gray-400">
            Do any guests require mobility assistance?
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMobility(true)}
              className={yesNoBtn(value.hasMobility === true, "yes")}
            >
              {value.hasMobility === true ? "✓ " : ""}Yes
            </button>
            <button
              type="button"
              onClick={() => setMobility(false)}
              className={yesNoBtn(value.hasMobility === false, "no")}
            >
              {value.hasMobility === false ? "✓ " : ""}No
            </button>
          </div>

          {value.hasMobility === true ? (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <span className="block text-[10px] font-bold uppercase text-gray-400">
                Assistance needs{" "}
                <span className="font-medium normal-case text-gray-500">
                  (optional)
                </span>
              </span>
              <div className="flex flex-wrap gap-2">
                {MOBILITY_OPTIONS.map((tag) => {
                  const isSelected = value.mobilityTags?.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleMobility(tag)}
                      className={tagBtn(Boolean(isSelected))}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-white/10 pt-2">
        <p className="text-[11px] font-sans text-gray-300">
          <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Status
          </span>
          {statusLine}
        </p>
      </div>
    </div>
  );
}
