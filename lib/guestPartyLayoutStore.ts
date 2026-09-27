/**
 * Server-only guest party layout JSON store.
 * Team Access layout builder writes; Pre-Elite GuestPartyMascots reads.
 */

import fs from "fs";
import path from "path";
import {
  GUEST_PARTY_LAYOUT_DEFAULTS,
  mergeGuestPartyLayout,
  type GuestPartyLayout,
} from "@/lib/guestPartyLayout";

export function getGuestPartyLayoutPath(): string {
  return path.join(process.cwd(), "config", "guestPartyLayout.json");
}

export function loadPersistedGuestPartyLayout(): GuestPartyLayout {
  try {
    const filePath = getGuestPartyLayoutPath();
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
      return mergeGuestPartyLayout(raw);
    }
  } catch (err) {
    console.warn("[guestPartyLayout] failed to read JSON store:", err);
  }
  return structuredClone(GUEST_PARTY_LAYOUT_DEFAULTS);
}

export function saveGuestPartyLayout(input: unknown): GuestPartyLayout {
  const next = mergeGuestPartyLayout(input);
  const filePath = getGuestPartyLayoutPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}
