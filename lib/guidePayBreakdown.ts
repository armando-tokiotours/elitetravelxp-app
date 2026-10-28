/**
 * Guide day payout = base (matrix) + expenses (¥3,000 default) + specialty bonus.
 */

import type PocketBase from "pocketbase";
import { estimateGuidePayout } from "@/lib/guideMatcher";

export const DEFAULT_DAY_EXPENSES_JPY = 3000;

export type SpecialtyTier = {
  id: string;
  label: string;
  amount_jpy: number;
};

export type GuidePaySettings = {
  default_expenses_jpy: number;
  specialty_tiers: SpecialtyTier[];
};

export type GuidePayRuleRow = {
  id?: string;
  year?: number;
  tour_name?: string;
  duration_hours?: number;
  pax_count?: number;
  guide_pay_jpy?: number;
  expenses_jpy?: number;
  is_meet_and_greet?: boolean;
};

export type GuidePayBreakdown = {
  basePayJpy: number;
  expensesJpy: number;
  specialtyBonusJpy: number;
  totalPayoutJpy: number;
  matchedRuleId?: string;
  source: "matrix" | "fallback";
};

export const DEFAULT_SPECIALTY_TIERS: SpecialtyTier[] = [
  { id: "level1", label: "Level 1 Specialty", amount_jpy: 3000 },
  { id: "level2", label: "Level 2 High Difficulty", amount_jpy: 5000 },
  { id: "vip", label: "VIP / Language Specialty", amount_jpy: 8000 },
];

export function formatYenJpy(n: number): string {
  return `¥${Math.max(0, Math.round(Number(n) || 0)).toLocaleString("en-US")}`;
}

export function sumGuidePayout(parts: {
  basePayJpy?: number;
  expensesJpy?: number;
  specialtyBonusJpy?: number;
}): number {
  return (
    Math.max(0, Math.round(Number(parts.basePayJpy) || 0)) +
    Math.max(0, Math.round(Number(parts.expensesJpy) || 0)) +
    Math.max(0, Math.round(Number(parts.specialtyBonusJpy) || 0))
  );
}

export function parseSpecialtyTiersJson(raw: unknown): SpecialtyTier[] {
  try {
    const parsed =
      typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
    if (!Array.isArray(parsed)) return [...DEFAULT_SPECIALTY_TIERS];
    const tiers = parsed
      .map((t, i) => {
        const amount = Math.max(0, Math.round(Number(t?.amount_jpy) || 0));
        const label = String(t?.label || "").trim();
        const id = String(t?.id || `tier_${i}`).trim() || `tier_${i}`;
        if (!label || amount <= 0) return null;
        return { id, label, amount_jpy: amount };
      })
      .filter(Boolean) as SpecialtyTier[];
    return tiers.length > 0 ? tiers : [...DEFAULT_SPECIALTY_TIERS];
  } catch {
    return [...DEFAULT_SPECIALTY_TIERS];
  }
}

export async function loadGuidePaySettings(
  pb: PocketBase
): Promise<GuidePaySettings> {
  try {
    const row = await pb
      .collection("guide_pay_settings")
      .getFirstListItem<{
        default_expenses_jpy?: number;
        specialty_tiers_json?: string;
      }>('key="default"', { requestKey: null });
    return {
      default_expenses_jpy: Math.max(
        0,
        Math.round(Number(row.default_expenses_jpy) || DEFAULT_DAY_EXPENSES_JPY)
      ),
      specialty_tiers: parseSpecialtyTiersJson(row.specialty_tiers_json),
    };
  } catch {
    return {
      default_expenses_jpy: DEFAULT_DAY_EXPENSES_JPY,
      specialty_tiers: [...DEFAULT_SPECIALTY_TIERS],
    };
  }
}

export async function saveGuidePaySettings(
  pb: PocketBase,
  settings: GuidePaySettings
): Promise<void> {
  const payload = {
    key: "default",
    default_expenses_jpy: Math.max(
      0,
      Math.round(Number(settings.default_expenses_jpy) || DEFAULT_DAY_EXPENSES_JPY)
    ),
    specialty_tiers_json: JSON.stringify(
      settings.specialty_tiers.length
        ? settings.specialty_tiers
        : DEFAULT_SPECIALTY_TIERS
    ),
  };
  try {
    const existing = await pb
      .collection("guide_pay_settings")
      .getFirstListItem<{ id: string }>('key="default"', { requestKey: null });
    await pb.collection("guide_pay_settings").update(existing.id, payload, {
      requestKey: null,
    });
  } catch {
    await pb.collection("guide_pay_settings").create(payload, {
      requestKey: null,
    });
  }
}

export async function loadGuidePayRules(
  pb: PocketBase
): Promise<GuidePayRuleRow[]> {
  try {
    return await pb.collection("guide_pay_rules").getFullList<GuidePayRuleRow>({
      sort: "-year,tour_name,duration_hours,pax_count",
      requestKey: null,
    });
  } catch {
    return [];
  }
}

function scoreRule(
  rule: GuidePayRuleRow,
  opts: {
    year: number;
    tourName: string;
    hours: number;
    pax: number;
    isMeetAndGreet: boolean;
  }
): number {
  const year = Number(rule.year) || 0;
  const hours = Number(rule.duration_hours) || 0;
  const pax = Number(rule.pax_count) || 0;
  const mg = rule.is_meet_and_greet === true;
  const name = String(rule.tour_name || "")
    .trim()
    .toLowerCase();
  const jobName = opts.tourName.trim().toLowerCase();
  let score = 0;

  if (opts.isMeetAndGreet !== mg) return -1;
  if (year && year === opts.year) score += 40;
  else if (year && Math.abs(year - opts.year) <= 1) score += 10;

  if (hours > 0 && hours === opts.hours) score += 30;
  else if (hours > 0 && Math.abs(hours - opts.hours) <= 1) score += 12;

  if (pax > 0 && pax === opts.pax) score += 25;
  else if (pax > 0 && Math.abs(pax - opts.pax) <= 1) score += 10;

  if (name && jobName) {
    if (name === jobName) score += 50;
    else if (jobName.includes(name) || name.includes(jobName)) score += 28;
    else {
      const tokens = name.split(/[\s/()·\-]+/).filter((t) => t.length >= 3);
      const hits = tokens.filter((t) => jobName.includes(t)).length;
      score += Math.min(20, hits * 6);
    }
  }

  return score;
}

export function resolveGuidePayBreakdown(opts: {
  rules: GuidePayRuleRow[];
  year?: number;
  tourName: string;
  durationHours: number;
  paxCount: number;
  isMeetAndGreet?: boolean;
  specialtyBonusJpy?: number;
  defaultExpensesJpy?: number;
}): GuidePayBreakdown {
  const year = opts.year || new Date().getFullYear();
  const hours = Math.max(0, Math.round(Number(opts.durationHours) || 6));
  const pax = Math.max(1, Math.round(Number(opts.paxCount) || 1));
  const isMg = Boolean(opts.isMeetAndGreet);
  const specialty = Math.max(0, Math.round(Number(opts.specialtyBonusJpy) || 0));
  const defaultExp = Math.max(
    0,
    Math.round(Number(opts.defaultExpensesJpy) || DEFAULT_DAY_EXPENSES_JPY)
  );

  let best: GuidePayRuleRow | null = null;
  let bestScore = 0;
  for (const rule of opts.rules) {
    const s = scoreRule(rule, {
      year,
      tourName: opts.tourName,
      hours,
      pax,
      isMeetAndGreet: isMg,
    });
    if (s > bestScore) {
      bestScore = s;
      best = rule;
    }
  }

  if (best && bestScore >= 40) {
    const base = Math.max(0, Math.round(Number(best.guide_pay_jpy) || 0));
    // Matrix expenses of 0 / blank → fall back to Super User default (¥3,000).
    const ruleExp = Math.round(Number(best.expenses_jpy) || 0);
    const expenses = Math.max(0, ruleExp > 0 ? ruleExp : defaultExp);
    return {
      basePayJpy: base,
      expensesJpy: expenses,
      specialtyBonusJpy: specialty,
      totalPayoutJpy: sumGuidePayout({
        basePayJpy: base,
        expensesJpy: expenses,
        specialtyBonusJpy: specialty,
      }),
      matchedRuleId: best.id,
      source: "matrix",
    };
  }

  const est = estimateGuidePayout({
    tourHours: hours || 6,
    baseRate6hJpy: 18000,
    baseRate8hJpy: 24000,
  });
  const base = est.totalPayoutJpy;
  return {
    basePayJpy: base,
    expensesJpy: defaultExp,
    specialtyBonusJpy: specialty,
    totalPayoutJpy: sumGuidePayout({
      basePayJpy: base,
      expensesJpy: defaultExp,
      specialtyBonusJpy: specialty,
    }),
    source: "fallback",
  };
}

/** Prefer stored job breakdown fields; otherwise derive from flat payout. */
export function breakdownFromJob(job: {
  payout_jpy?: number;
  base_pay_jpy?: number;
  expenses_jpy?: number;
  specialty_bonus_jpy?: number;
  duration_hours?: number;
}): GuidePayBreakdown {
  const base = Math.max(0, Math.round(Number(job.base_pay_jpy) || 0));
  const expenses = Math.max(0, Math.round(Number(job.expenses_jpy) || 0));
  const specialty = Math.max(
    0,
    Math.round(Number(job.specialty_bonus_jpy) || 0)
  );
  const totalStored = Math.max(0, Math.round(Number(job.payout_jpy) || 0));

  if (base > 0 || expenses > 0 || specialty > 0) {
    const total = sumGuidePayout({
      basePayJpy: base,
      expensesJpy: expenses,
      specialtyBonusJpy: specialty,
    });
    return {
      basePayJpy: base,
      expensesJpy: expenses || (base > 0 ? 0 : DEFAULT_DAY_EXPENSES_JPY),
      specialtyBonusJpy: specialty,
      totalPayoutJpy: totalStored > 0 ? totalStored : total,
      source: "matrix",
    };
  }

  if (totalStored > 0) {
    const exp = DEFAULT_DAY_EXPENSES_JPY;
    const inferredBase = Math.max(0, totalStored - exp);
    return {
      basePayJpy: inferredBase,
      expensesJpy: exp,
      specialtyBonusJpy: 0,
      totalPayoutJpy: totalStored,
      source: "fallback",
    };
  }

  return resolveGuidePayBreakdown({
    rules: [],
    tourName: "",
    durationHours: Number(job.duration_hours) || 6,
    paxCount: 2,
  });
}
