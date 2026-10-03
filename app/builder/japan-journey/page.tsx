import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderApp } from "@/components/builder/BuilderApp";

export const metadata: Metadata = {
  title: "Grand Japan Journey",
  description: "Full Bespoke Vacation across Tokyo, Kyoto & Beyond",
};

export default function JapanJourneyBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Opening Grand Japan Journey…
        </div>
      }
    >
      <BuilderApp />
    </Suspense>
  );
}
