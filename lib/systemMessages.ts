/**
 * Short fox / system message catalog.
 * Team Access can override copy via localStorage key SYSTEM_MESSAGE_OVERRIDES.
 */

export type SystemMessageKey =
  | "pre_step_style"
  | "pre_step_interests"
  | "pre_step_motivation"
  | "pre_step_pain"
  | "pre_contact_trip_type"
  | "pre_contact_name"
  | "pre_contact_email"
  | "pre_contact_phone"
  | "pre_contact_dates"
  | "builder_lock"
  | "builder_m_step1"
  | "builder_m_step2"
  | "builder_m_step3"
  | "builder_m_step4"
  | "builder_m_step5"
  | "builder_m_generic"
  | "builder_s_step1"
  | "builder_s_step2"
  | "builder_s_step3"
  | "builder_s_lock"
  | "payment_not_ready"
  | "builder_incomplete"
  | "builder_m_transit_required"
  | "sending_again"
  | "sending_pdf";

export type SystemMessageDef = {
  key: SystemMessageKey;
  label: string;
  group: "pre_elite" | "builder_m" | "builder_s" | "itinerary";
  defaultText: string;
};

export const SYSTEM_MESSAGE_CATALOG: readonly SystemMessageDef[] = [
  {
    key: "pre_step_style",
    label: "Pre-Elite · travel style",
    group: "pre_elite",
    defaultText: "Pick a travel style.",
  },
  {
    key: "pre_step_interests",
    label: "Pre-Elite · interests",
    group: "pre_elite",
    defaultText: "Pick at least one interest.",
  },
  {
    key: "pre_step_motivation",
    label: "Pre-Elite · motivation",
    group: "pre_elite",
    defaultText: "Tell us what this trip is for.",
  },
  {
    key: "pre_step_pain",
    label: "Pre-Elite · concerns",
    group: "pre_elite",
    defaultText: "Pick at least one concern.",
  },
  {
    key: "pre_contact_trip_type",
    label: "Pre-Elite · trip type",
    group: "pre_elite",
    defaultText: "Choose Multi-Day or Single-Day.",
  },
  {
    key: "pre_contact_name",
    label: "Pre-Elite · name",
    group: "pre_elite",
    defaultText: "Enter your full name.",
  },
  {
    key: "pre_contact_email",
    label: "Pre-Elite · email",
    group: "pre_elite",
    defaultText: "Enter a valid email.",
  },
  {
    key: "pre_contact_phone",
    label: "Pre-Elite · phone",
    group: "pre_elite",
    defaultText: "Enter your phone number.",
  },
  {
    key: "pre_contact_dates",
    label: "Pre-Elite · dates",
    group: "pre_elite",
    defaultText: "Select your travel dates.",
  },
  {
    key: "builder_lock",
    label: "Builder · locked section",
    group: "builder_m",
    defaultText: "Finish earlier steps first.",
  },
  {
    key: "builder_m_step1",
    label: "Builder M · duration",
    group: "builder_m",
    defaultText: "Set dates and guests first.",
  },
  {
    key: "builder_m_step2",
    label: "Builder M · hubs",
    group: "builder_m",
    defaultText: "Pick arrival and departure hubs.",
  },
  {
    key: "builder_m_step3",
    label: "Builder M · cities",
    group: "builder_m",
    defaultText: "Add at least one city.",
  },
  {
    key: "builder_m_step4",
    label: "Builder M · hotels",
    group: "builder_m",
    defaultText: "Allocate rooms (or turn hotels off).",
  },
  {
    key: "builder_m_step5",
    label: "Builder M · tours",
    group: "builder_m",
    defaultText: "Choose tours or skip.",
  },
  {
    key: "builder_m_generic",
    label: "Builder M · generic",
    group: "builder_m",
    defaultText: "Complete this step first.",
  },
  {
    key: "builder_s_step1",
    label: "Builder S · duration",
    group: "builder_s",
    defaultText: "Set date, hours, and guests.",
  },
  {
    key: "builder_s_step2",
    label: "Builder S · city",
    group: "builder_s",
    defaultText: "Choose a city focus.",
  },
  {
    key: "builder_s_step3",
    label: "Builder S · experiences",
    group: "builder_s",
    defaultText: "Pick experiences or Continue to skip.",
  },
  {
    key: "builder_s_lock",
    label: "Builder S · locked",
    group: "builder_s",
    defaultText: "Finish earlier steps first.",
  },
  {
    key: "payment_not_ready",
    label: "Itinerary · payment off",
    group: "itinerary",
    defaultText: "Payment is not set up yet.",
  },
  {
    key: "builder_incomplete",
    label: "Itinerary · incomplete builder",
    group: "itinerary",
    defaultText: "Save all builder sections first.",
  },
  {
    key: "builder_m_transit_required",
    label: "Builder M · transit required",
    group: "builder_m",
    defaultText:
      "Pick how you will travel between cities (Self, Public, or Private) before saving.",
  },
  {
    key: "sending_again",
    label: "Pre-Build · resend",
    group: "pre_elite",
    defaultText: "Sending again…",
  },
  {
    key: "sending_pdf",
    label: "Itinerary · send PDF",
    group: "itinerary",
    defaultText: "Sending your PDF…",
  },
] as const;

const STORAGE_KEY = "system_message_overrides";

export function readSystemMessageOverrides(): Partial<
  Record<SystemMessageKey, string>
> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed as Partial<Record<SystemMessageKey, string>>;
  } catch {
    return {};
  }
}

export function writeSystemMessageOverrides(
  overrides: Partial<Record<SystemMessageKey, string>>
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getSystemMessage(key: SystemMessageKey): string {
  const def = SYSTEM_MESSAGE_CATALOG.find((m) => m.key === key);
  const fallback = def?.defaultText || key;
  if (typeof window === "undefined") return fallback;
  const o = readSystemMessageOverrides()[key];
  const text = (o || "").trim();
  return text || fallback;
}
