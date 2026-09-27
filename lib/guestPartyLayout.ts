/**
 * Guest party (Pre-Elite Step 5) layout — position / size / z only.
 * Edited in Team Access → Layout Builder; consumed by GuestPartyMascots.
 */

export type GuestPartySlot = {
  /** % from right edge of the party box */
  right: number;
  /** % from bottom of the party box */
  bottom: number;
  /** height as % of party box */
  height: number;
  z: number;
};

export type GuestPartyAdultId = "duck" | "shiba" | "cat" | "red" | "panda";

export type GuestPartyLayout = {
  version: 1;
  adults: Record<GuestPartyAdultId, GuestPartySlot>;
  chicks: [GuestPartySlot, GuestPartySlot, GuestPartySlot];
};

export const GUEST_PARTY_LAYOUT_LOCAL_KEY = "tokio_guest_party_layout";
export const GUEST_PARTY_LAYOUT_EVENT = "guest-party-layout-updated";

export const GUEST_PARTY_ADULTS: Array<{
  id: GuestPartyAdultId;
  label: string;
  src: string;
  minAdults: number;
}> = [
  {
    id: "duck",
    label: "Duck peek",
    src: "/brand/guest-duck-peek.png",
    minAdults: 2,
  },
  {
    id: "shiba",
    label: "Shiba",
    src: "/brand/guest-shiba.png",
    minAdults: 3,
  },
  {
    id: "cat",
    label: "Cat",
    src: "/brand/guest-cat.png",
    minAdults: 4,
  },
  {
    id: "red",
    label: "Red panda",
    src: "/brand/guest-red-panda.png",
    minAdults: 5,
  },
  {
    id: "panda",
    label: "Panda",
    src: "/brand/guest-panda.png",
    minAdults: 6,
  },
];

export const GUEST_PARTY_CHICK_SRC = "/brand/guest-chick.png";

/** Defaults match the current hard-coded layout in GuestPartyMascots. */
export const GUEST_PARTY_LAYOUT_DEFAULTS: GuestPartyLayout = {
  version: 1,
  adults: {
    duck: { right: 4, bottom: 6, height: 78, z: 8 },
    shiba: { right: 22, bottom: 2, height: 72, z: 6 },
    cat: { right: 40, bottom: 4, height: 68, z: 5 },
    red: { right: 54, bottom: 12, height: 58, z: 3 },
    panda: { right: 68, bottom: 14, height: 54, z: 2 },
  },
  chicks: [
    { right: 16, bottom: -4, height: 40, z: 14 },
    { right: -2, bottom: -6, height: 38, z: 15 },
    { right: 30, bottom: -4, height: 40, z: 13 },
  ],
};

function clampNum(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function mergeSlot(base: GuestPartySlot, raw: unknown): GuestPartySlot {
  if (!raw || typeof raw !== "object") return { ...base };
  const o = raw as Record<string, unknown>;
  return {
    right: clampNum(o.right, base.right),
    bottom: clampNum(o.bottom, base.bottom),
    height: clampNum(o.height, base.height),
    z: Math.round(clampNum(o.z, base.z)),
  };
}

export function mergeGuestPartyLayout(raw: unknown): GuestPartyLayout {
  const base = structuredClone(GUEST_PARTY_LAYOUT_DEFAULTS);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const adultsRaw =
    o.adults && typeof o.adults === "object"
      ? (o.adults as Record<string, unknown>)
      : {};
  const chicksRaw = Array.isArray(o.chicks) ? o.chicks : [];

  return {
    version: 1,
    adults: {
      duck: mergeSlot(base.adults.duck, adultsRaw.duck),
      shiba: mergeSlot(base.adults.shiba, adultsRaw.shiba),
      cat: mergeSlot(base.adults.cat, adultsRaw.cat),
      red: mergeSlot(base.adults.red, adultsRaw.red),
      panda: mergeSlot(base.adults.panda, adultsRaw.panda),
    },
    chicks: [
      mergeSlot(base.chicks[0], chicksRaw[0]),
      mergeSlot(base.chicks[1], chicksRaw[1]),
      mergeSlot(base.chicks[2], chicksRaw[2]),
    ],
  };
}

export function slotToStyle(slot: GuestPartySlot): {
  right: string;
  bottom: string;
  height: string;
  zIndex: number;
} {
  return {
    right: `${slot.right}%`,
    bottom: `${slot.bottom}%`,
    height: `${slot.height}%`,
    zIndex: slot.z,
  };
}

export function readGuestPartyLayoutLocal(): GuestPartyLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_PARTY_LAYOUT_LOCAL_KEY);
    if (!raw) return null;
    return mergeGuestPartyLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeGuestPartyLayoutLocal(
  layout: GuestPartyLayout,
  opts?: { broadcast?: boolean }
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      GUEST_PARTY_LAYOUT_LOCAL_KEY,
      JSON.stringify(layout)
    );
    if (opts?.broadcast !== false) {
      window.dispatchEvent(
        new CustomEvent(GUEST_PARTY_LAYOUT_EVENT, { detail: layout })
      );
    }
  } catch {
    /* ignore */
  }
}
