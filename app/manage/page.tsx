import { Suspense } from "react";
import ManageBookingPageClient from "./ManageBookingPageClient";

export default function ManageBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="tokio-ambient-bg flex min-h-dvh items-center justify-center text-sm text-zinc-400">
          Loading…
        </div>
      }
    >
      <ManageBookingPageClient />
    </Suspense>
  );
}
