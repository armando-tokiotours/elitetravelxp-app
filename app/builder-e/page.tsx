import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderEView } from "@/components/builder-e/BuilderEView";

export const metadata: Metadata = {
  title: "Builder E — Experiences & Micro-Services",
  description:
    "Book chauffeurs, attractions, and transit passes with TOKIOTOURS — standalone micro-services.",
};

export default function BuilderEPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Loading Builder E…
        </div>
      }
    >
      <BuilderEView />
    </Suspense>
  );
}
