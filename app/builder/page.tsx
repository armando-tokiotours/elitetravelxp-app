import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderApp } from "@/components/builder/BuilderApp";

export const metadata: Metadata = {
  title: "Build Your Japan Journey",
  description:
    "Mobile-first trip builder for TOKIOTOURS — powered by live PocketBase configuration.",
};

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Loading your trip builder…
        </div>
      }
    >
      <BuilderApp />
    </Suspense>
  );
}
