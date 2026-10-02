import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generatePNR } from "@/lib/generatePNR";

export type BuilderECategory = "DRIVER" | "EXPERIENCE" | "TRANSIT" | null;

export type BuilderEDriverPayload = {
  pickupLocation: string;
  pickupTime: string;
  flightNumber: string;
  dropoffLocation: string;
  adults: number;
  children: number;
  luggageCount: number;
  notes: string;
};

export type BuilderEExperiencePayload = {
  activityTitle: string;
  targetDate: string;
  timeSlot: "morning" | "afternoon" | "evening" | "";
  guestNames: string;
  guestAges: string;
  guideLanguage: string;
  notes: string;
};

export type BuilderETransitPayload = {
  passType:
    | "suica_physical"
    | "suica_digital"
    | "shinkansen"
    | "jr_pass"
    | "";
  routeFrom: string;
  routeTo: string;
  travelDate: string;
  preferredTime: string;
  delivery:
    | "hotel_delivery"
    | "airport_counter"
    | "digital_qr"
    | "";
  notes: string;
};

export type BuilderECartItem = {
  id: string;
  category: Exclude<BuilderECategory, null>;
  label: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type BuilderEState = {
  category: BuilderECategory;
  bookingRef: string;
  guestName: string;
  guestEmail: string;
  guestWhatsapp: string;
  contactGateComplete: boolean;
  driver: BuilderEDriverPayload;
  experience: BuilderEExperiencePayload;
  transit: BuilderETransitPayload;
  /** Accumulated micro-services on this PNR (multi-add). */
  cart: BuilderECartItem[];
  setCategory: (c: BuilderECategory) => void;
  ensureBookingRef: () => string;
  setGuestName: (v: string) => void;
  setGuestEmail: (v: string) => void;
  setGuestWhatsapp: (v: string) => void;
  setContactGateComplete: (v: boolean) => void;
  patchDriver: (p: Partial<BuilderEDriverPayload>) => void;
  patchExperience: (p: Partial<BuilderEExperiencePayload>) => void;
  patchTransit: (p: Partial<BuilderETransitPayload>) => void;
  addCartItem: (item: Omit<BuilderECartItem, "id"> & { id?: string }) => void;
  removeCartItem: (id: string) => void;
  /** Wipe cart + mint new PNR. keepGuest preserves name/email. */
  reset: (opts?: { keepGuest?: boolean }) => void;
};

const emptyDriver = (): BuilderEDriverPayload => ({
  pickupLocation: "",
  pickupTime: "",
  flightNumber: "",
  dropoffLocation: "",
  adults: 2,
  children: 0,
  luggageCount: 2,
  notes: "",
});

const emptyExperience = (): BuilderEExperiencePayload => ({
  activityTitle: "",
  targetDate: "",
  timeSlot: "",
  guestNames: "",
  guestAges: "",
  guideLanguage: "EN",
  notes: "",
});

const emptyTransit = (): BuilderETransitPayload => ({
  passType: "",
  routeFrom: "",
  routeTo: "",
  travelDate: "",
  preferredTime: "",
  delivery: "",
  notes: "",
});

const initial = {
  category: null as BuilderECategory,
  bookingRef: "",
  guestName: "",
  guestEmail: "",
  guestWhatsapp: "",
  contactGateComplete: false,
  driver: emptyDriver(),
  experience: emptyExperience(),
  transit: emptyTransit(),
  cart: [] as BuilderECartItem[],
};

export const useBuilderEStore = create<BuilderEState>()(
  persist(
    (set, get) => ({
      ...initial,
      setCategory: (c) => {
        const cur = String(get().bookingRef || "").trim();
        if (!cur) {
          set({ category: c, bookingRef: generatePNR() });
        } else {
          set({ category: c });
        }
      },
      ensureBookingRef: () => {
        const cur = String(get().bookingRef || "").trim();
        if (cur) return cur;
        const next = generatePNR();
        set({ bookingRef: next });
        return next;
      },
      setGuestName: (v) => set({ guestName: v }),
      setGuestEmail: (v) => set({ guestEmail: v }),
      setGuestWhatsapp: (v) => set({ guestWhatsapp: v }),
      setContactGateComplete: (v) => set({ contactGateComplete: Boolean(v) }),
      patchDriver: (p) =>
        set((s) => ({ driver: { ...s.driver, ...p } })),
      patchExperience: (p) =>
        set((s) => ({ experience: { ...s.experience, ...p } })),
      patchTransit: (p) =>
        set((s) => ({ transit: { ...s.transit, ...p } })),
      addCartItem: (item) => {
        const id =
          item.id ||
          `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({
          cart: [...s.cart, { ...item, id }],
          category: item.category,
        }));
      },
      removeCartItem: (id) =>
        set((s) => ({ cart: s.cart.filter((x) => x.id !== id) })),
      reset: (opts) => {
        const keep = Boolean(opts?.keepGuest);
        const name = keep ? get().guestName : "";
        const email = keep ? get().guestEmail : "";
        const whatsapp = keep ? get().guestWhatsapp : "";
        set({
          ...initial,
          guestName: name,
          guestEmail: email,
          guestWhatsapp: whatsapp,
          contactGateComplete: false,
          driver: emptyDriver(),
          experience: emptyExperience(),
          transit: emptyTransit(),
          cart: [],
          bookingRef: generatePNR(),
        });
      },
    }),
    { name: "builder-e-v1" }
  )
);

export function builderEPayloadSnapshot(s: BuilderEState) {
  return {
    booking_type: "EXPERIENCE_ONLY" as const,
    category: s.category,
    guestName: s.guestName,
    guestEmail: s.guestEmail,
    guestWhatsapp: s.guestWhatsapp,
    cart: s.cart,
    driver: s.driver,
    experience: s.experience,
    transit: s.transit,
  };
}

export function builderEDemandFlags(category: BuilderECategory): {
  ticketsNeeded: boolean;
  driverNeeded: boolean;
  guideNeeded: boolean;
} {
  if (category === "DRIVER") {
    return { ticketsNeeded: false, driverNeeded: true, guideNeeded: false };
  }
  if (category === "EXPERIENCE") {
    return { ticketsNeeded: true, driverNeeded: false, guideNeeded: true };
  }
  if (category === "TRANSIT") {
    return { ticketsNeeded: true, driverNeeded: false, guideNeeded: false };
  }
  return { ticketsNeeded: false, driverNeeded: false, guideNeeded: false };
}

/** Aggregate Ops demand across the cart (+ active category). */
export function builderEDemandFromState(s: BuilderEState) {
  const cats = new Set<Exclude<BuilderECategory, null>>();
  for (const item of s.cart) cats.add(item.category);
  if (s.category) cats.add(s.category);
  return {
    ticketsNeeded: cats.has("EXPERIENCE") || cats.has("TRANSIT"),
    driverNeeded: cats.has("DRIVER"),
    guideNeeded: cats.has("EXPERIENCE"),
  };
}

export function builderEPrimaryCity(s: BuilderEState): string {
  if (s.category === "DRIVER") {
    return (
      s.driver.dropoffLocation.split(",")[0]?.trim() ||
      s.driver.pickupLocation.split(",")[0]?.trim() ||
      "Tokyo"
    );
  }
  if (s.category === "EXPERIENCE") return "Tokyo";
  if (s.category === "TRANSIT") {
    return s.transit.routeFrom.trim() || s.transit.routeTo.trim() || "Tokyo";
  }
  return "Tokyo";
}

export function builderETourDate(s: BuilderEState): string | null {
  if (s.category === "EXPERIENCE") {
    return s.experience.targetDate || null;
  }
  if (s.category === "TRANSIT") {
    return s.transit.travelDate || null;
  }
  if (s.category === "DRIVER") {
    return null;
  }
  return null;
}

export function builderEGuestSummary(s: BuilderEState): string {
  if (s.category === "DRIVER") {
    const a = s.driver.adults;
    const c = s.driver.children;
    const parts = [`${a} adult${a === 1 ? "" : "s"}`];
    if (c > 0) parts.push(`${c} kid${c === 1 ? "" : "s"}`);
    parts.push(`${s.driver.luggageCount} bags`);
    return parts.join(", ");
  }
  if (s.category === "EXPERIENCE") {
    const names = s.experience.guestNames
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    return names.length
      ? `${names.length} guest${names.length === 1 ? "" : "s"}`
      : "Experience booking";
  }
  if (s.category === "TRANSIT") {
    return s.transit.passType.replace(/_/g, " ") || "Transit booking";
  }
  return "";
}
