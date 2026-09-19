import type { Metadata } from "next";
import { BudgetPlannerPageClient } from "./BudgetPlannerPageClient";

export const metadata: Metadata = {
  title: "Budget Planner",
  description:
    "Set a per-person daily or total trip budget and get affordable Japan tour and experience recommendations.",
};

export default function BudgetPlannerPage() {
  return <BudgetPlannerPageClient />;
}
