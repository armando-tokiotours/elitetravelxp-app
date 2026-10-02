import type { Metadata } from "next";
import { Suspense } from "react";
import { PreEliteBuilderClient } from "./PreEliteBuilderClient";

export const metadata: Metadata = {
  title: "Pre-Elite Builder",
  description:
    "Share your travel style, interests, and timing. We qualify the trip before the Elite builder.",
};

export default function PreEliteBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-400">
          Loading…
        </div>
      }
    >
      <PreEliteBuilderClient />
    </Suspense>
  );
}
