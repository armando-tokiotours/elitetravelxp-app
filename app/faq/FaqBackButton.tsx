"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { extractBookingRef, sanitizeInternalReturnUrl } from "@/lib/faqReturn";

const backButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-[#F6A724]/40 bg-[#F6A724]/10 px-4 py-2 text-sm font-semibold text-[#F6A724] shadow-[0_0_18px_rgba(246,167,36,0.12)] transition hover:border-[#F6A724]/70 hover:bg-[#F6A724]/20 hover:text-[#FFD88A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F6A724]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1017]";

/** Static placeholder shown while search params resolve (Suspense fallback). */
export function FaqBackButtonFallback() {
  return (
    <span className={backButtonClass} aria-hidden>
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back
    </span>
  );
}

/**
 * Context-aware Back button for `/faq`. Must be rendered inside a
 * `<Suspense>` boundary (uses `useSearchParams`).
 *
 * Priority: valid `?from=`/`?returnUrl=` internal path → browser history →
 * home (`/`).
 */
export function FaqBackButton() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnUrl = sanitizeInternalReturnUrl(
    searchParams.get("from") ?? searchParams.get("returnUrl"),
  );
  const pnr = extractBookingRef(
    returnUrl,
    searchParams.get("ref") ?? searchParams.get("pnr"),
  );
  const label = pnr ? `Back to Booking ${pnr}` : "Back";

  const handleBack = () => {
    if (returnUrl) {
      router.push(returnUrl);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={backButtonClass}
      aria-label={pnr ? `Back to booking ${pnr}` : "Go back"}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
