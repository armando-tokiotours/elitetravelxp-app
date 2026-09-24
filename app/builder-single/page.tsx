import type { Metadata } from "next";
import { Suspense } from "react";
import { SingleDayBuilderView } from "@/components/builder-single/SingleDayBuilderView";

export const metadata: Metadata = {
  title: "Single-Day Tour Builder",
  description:
    "Hour-by-hour day-trip builder for TOKIOTOURS — activities, timing, and intra-city movement.",
};

export default function BuilderSinglePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Loading single-day builder…
        </div>
      }
    >
      <SingleDayBuilderView />
    </Suspense>
  );
}
