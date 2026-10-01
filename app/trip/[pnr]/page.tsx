"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { normalizeBookingPNR } from "@/utils/pnr";

/**
 * Production magic link landing:
 * https://tokiotours-app.com/trip/JPN-XXXXXX?email=guest@…
 * Redirects into the existing /manage retrieve flow.
 */
function TripMagicLinkInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const pnr = normalizeBookingPNR(
      decodeURIComponent(String(params?.pnr || ""))
    );
    const email = String(searchParams.get("email") || "")
      .trim()
      .toLowerCase();
    const q = new URLSearchParams();
    if (pnr) q.set("pnr", pnr);
    if (email) q.set("email", email);
    router.replace(`/manage?${q.toString()}`);
  }, [params, searchParams, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0A1017] px-4 text-center text-white">
      <p className="font-godiva text-sm uppercase tracking-[0.3em] text-[#F6A724]">
        TOKIOTOURS
      </p>
      <p className="mt-3 text-sm text-zinc-400">Opening your trip…</p>
    </div>
  );
}

export default function TripMagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#0A1017] text-sm text-zinc-400">
          Opening your trip…
        </div>
      }
    >
      <TripMagicLinkInner />
    </Suspense>
  );
}
