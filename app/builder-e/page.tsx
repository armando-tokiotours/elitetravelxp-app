import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderEView } from "@/components/builder-e/BuilderEView";

export const metadata: Metadata = {
  title: "VIP Tickets & Local Access",
  description:
    "Hard-to-get tickets, restaurant reservations & local specs",
};

export default function BuilderEPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Loading VIP Access…
        </div>
      }
    >
      <BuilderEView />
    </Suspense>
  );
}
