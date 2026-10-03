import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderEDossierView } from "@/components/builder-e/BuilderEDossier";

export const metadata: Metadata = {
  title: "VIP Tickets & Local Access · Dossier",
  description:
    "Hard-to-get tickets, restaurant reservations & local specs",
};

export default function BuilderEDossierPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Loading dossier…
        </div>
      }
    >
      <BuilderEDossierView />
    </Suspense>
  );
}
