"use client";

import {
  AppSidebar,
  APP_SIDEBAR_RAIL_PAD,
  MobileAppNav,
} from "@/components/navigation/AppSidebar";
import { BudgetPlannerForm } from "@/components/budget/BudgetPlannerForm";
import { BottomNav } from "@/components/builder/BottomNav";

export function BudgetPlannerPageClient() {
  return (
    <div className={`min-h-dvh bg-zinc-950 text-white ${APP_SIDEBAR_RAIL_PAD}`}>
      <AppSidebar />
      <MobileAppNav />
      <main className="pb-28 lg:pb-10">
        <BudgetPlannerForm />
      </main>
      <BottomNav />
    </div>
  );
}
