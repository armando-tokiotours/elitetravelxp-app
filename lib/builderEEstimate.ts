import type { BuilderECartItem } from "@/store/useBuilderEStore";

export type BuilderEContactDraft = {
  fullName: string;
  email: string;
  whatsapp: string;
};

export type BuilderEContactServiceLine = {
  id: string;
  category: string;
  title: string;
  summary: string;
  estimatedEur: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9()\-\s]{7,}$/;

const SERVICE_EUR: Record<string, number> = {
  pickup: 120,
  dropoff: 120,
  intercity: 260,
  bicycle: 95,
  teamlab: 145,
  disney: 180,
  suica: 28,
  bullet_train: 95,
  jr_pass: 220,
  ghibli_vip: 180,
  sumo_box: 260,
  usj_express: 150,
  michelin_omakase: 320,
  event_verification: 140,
  geisha_dinner: 380,
};

const CATEGORY_DEFAULT_EUR: Record<string, number> = {
  DRIVER: 160,
  EXPERIENCE: 120,
  TRANSIT: 50,
};

function serviceIdOf(item: BuilderECartItem): string {
  const raw = item.payload?.subServiceId;
  const id = typeof raw === "string" ? raw.trim() : "";
  return id || item.id || item.label.toLowerCase().replace(/\s+/g, "_");
}

function serviceEstimateEur(item: BuilderECartItem): number {
  const id = serviceIdOf(item);
  return SERVICE_EUR[id] ?? CATEGORY_DEFAULT_EUR[item.category] ?? 100;
}

export function validateBuilderEContact(draft: BuilderEContactDraft): string | null {
  const fullName = draft.fullName.trim();
  const email = draft.email.trim().toLowerCase();
  const whatsapp = draft.whatsapp.trim();

  if (!fullName) return "Enter your full name.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  if (!PHONE_RE.test(whatsapp)) return "Enter a valid WhatsApp number.";
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Enter a valid WhatsApp number.";
  }
  return null;
}

export function buildBuilderEContactSnapshot(cart: BuilderECartItem[]) {
  const services = cart.map((item) => {
    const estimatedEur = serviceEstimateEur(item);
    return {
      id: serviceIdOf(item),
      category: item.category,
      title: item.label,
      summary: item.summary,
      estimatedEur,
    } satisfies BuilderEContactServiceLine;
  });
  const estimated_total = services.reduce((sum, item) => sum + item.estimatedEur, 0);

  let paxCount = 1;
  let startDate: string | null = null;

  for (const item of cart) {
    const adults = Number(item.payload?.adults);
    const children = Number(item.payload?.children);
    const guestNames = String(item.payload?.guestNames || "");
    const targetDate = String(
      item.payload?.targetDate || item.payload?.travelDate || ""
    ).slice(0, 10);

    if (Number.isFinite(adults) || Number.isFinite(children)) {
      const adultCount = Number.isFinite(adults) ? Math.max(0, Math.round(adults)) : 0;
      const childCount = Number.isFinite(children)
        ? Math.max(0, Math.round(children))
        : 0;
      const group = adultCount + childCount;
      if (group > 0) paxCount = Math.max(paxCount, group);
    }

    if (guestNames.trim()) {
      const count = guestNames
        .split(/[\n,]+/)
        .map((part) => part.trim())
        .filter(Boolean).length;
      if (count > 0) paxCount = Math.max(paxCount, count);
    }

    if (!startDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      startDate = targetDate;
    }
  }

  return {
    selected_services: services,
    paxCount,
    startDate,
    estimated_total,
  };
}

