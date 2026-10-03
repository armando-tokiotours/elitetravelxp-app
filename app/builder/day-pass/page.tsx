import type { Metadata } from "next";
import { Suspense } from "react";
import { SingleDayBuilderView } from "@/components/builder-single/SingleDayBuilderView";

export const metadata: Metadata = {
  title: "1-Day Express Pass",
  description: "Custom 1-Day Private Route & Instant Quote",
};

export default function DayPassBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Opening 1-Day Express Pass…
        </div>
      }
    >
      <SingleDayBuilderView />
    </Suspense>
  );
}
