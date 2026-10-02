import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderEDossierView } from "@/components/builder-e/BuilderEDossier";

export const metadata: Metadata = {
  title: "Builder E Dossier",
  description: "Micro-service booking pass — TOKIOTOURS Builder E.",
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
