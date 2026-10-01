import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";

export const metadata: Metadata = {
  title: "Terms & Policies",
  description:
    "Cancellation, refund, and operational guidelines for TokioTours.",
};

export default function PoliciesPage() {
  return (
    <AppShell dark title="Policies" subtitle="TOKIOTOURS">
      <div className="min-h-[calc(100dvh-4rem)] bg-[#0A1017] px-4 pb-16 pt-8 text-white sm:px-6 sm:pt-10">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="font-godiva text-3xl text-[#F6A724]">
            Terms &amp; Policies
          </h1>
          <p className="mb-10 mt-2 text-zinc-400">
            Cancellation, refund, and operational guidelines for TokioTours.
          </p>

          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/70 p-8 backdrop-blur-md">
            <BoxGradingGlow />
            <div className="relative z-10 space-y-8">
              <section>
                <h2 className="mb-3 font-godiva text-xl text-[#075473]">
                  1. Cancellation &amp; Refunds
                </h2>
                <p className="mb-3 text-sm leading-relaxed text-zinc-300">
                  All deposits are non-refundable once the itinerary is
                  confirmed. If a cancellation occurs within 30 days of the
                  travel date, a 100% cancellation fee applies to all arranged
                  private transport and local guides.
                </p>
                <p className="text-sm leading-relaxed text-zinc-300">
                  Public transport tickets (including Suica and JR Passes)
                  cannot be refunded once validated or issued by the operator.
                </p>
              </section>

              <section>
                <h2 className="mb-3 font-godiva text-xl text-[#075473]">
                  2. Itinerary Modifications
                </h2>
                <p className="text-sm leading-relaxed text-zinc-300">
                  Changes to confirmed itineraries requested within 14 days of
                  arrival may incur administrative fees. We cannot guarantee the
                  availability of specific private chauffeurs for last-minute
                  adjustments.
                </p>
              </section>

              <section>
                <h2 className="mb-3 font-godiva text-xl text-[#075473]">
                  3. Travel Insurance
                </h2>
                <p className="text-sm leading-relaxed text-zinc-300">
                  TokioTours highly recommends comprehensive travel insurance.
                  We are not liable for costs incurred due to flight delays,
                  medical emergencies, or lost luggage outside of our directly
                  controlled transfer services.
                </p>
              </section>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-zinc-500">
            More travel questions?{" "}
            <Link
              href="/faq"
              className="font-semibold text-[#F6A724] underline-offset-2 hover:underline"
            >
              Browse the FAQ
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
