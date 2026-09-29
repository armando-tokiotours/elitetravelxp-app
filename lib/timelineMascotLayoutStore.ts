/**
 * Server-only timeline mascot layout JSON store.
 * Team Access layout builder writes; Builder M/S progress bars read.
 */

import fs from "fs";
import path from "path";
import {
  TIMELINE_MASCOT_LAYOUT_DEFAULTS,
  mergeTimelineMascotLayout,
  type TimelineMascotLayout,
} from "@/lib/timelineMascotLayout";

export function getTimelineMascotLayoutPath(): string {
  return path.join(process.cwd(), "config", "timelineMascotLayout.json");
}

export function loadPersistedTimelineMascotLayout(): TimelineMascotLayout {
  try {
    const filePath = getTimelineMascotLayoutPath();
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
      return mergeTimelineMascotLayout(raw);
    }
  } catch (err) {
    console.warn("[timelineMascotLayout] failed to read JSON store:", err);
  }
  return structuredClone(TIMELINE_MASCOT_LAYOUT_DEFAULTS);
}

export function saveTimelineMascotLayout(input: unknown): TimelineMascotLayout {
  const next = mergeTimelineMascotLayout(input);
  const filePath = getTimelineMascotLayoutPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}
