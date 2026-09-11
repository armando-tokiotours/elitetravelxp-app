"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchBuilderConfig,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote, formatUsd } from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import { BottomNav } from "@/components/builder/BottomNav";

export default function ExportPage() {
  const state = useBuilderStore();
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    fetchBuilderConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          ...state,
          quote,
          exportedAt: new Date().toISOString(),
        },
        null,
        2
      ),
    [state, quote]
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  return (
    <div className="builder-theme min-h-screen bg-[#F5F0E8] pb-28 text-[#0B1F3A]">
      <header className="border-b border-[#E8E2D9] bg-[#FBF8F2] px-4 py-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#C4A35A]">
          Save / Export
        </p>
        <h1 className="mt-1 font-display text-3xl">Export Your Trip</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <p className="text-sm text-[#5C6570]">
          Your selections are saved automatically in this browser. Export a
          print-ready summary or copy the JSON payload for your concierge team.
        </p>

        {quote ? (
          <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[#C4A35A]">
              Estimated range
            </p>
            <p className="mt-1 font-display text-3xl">
              {formatUsd(quote.min)} – {formatUsd(quote.max)}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 rounded-full bg-[#0B1F3A] py-3 text-sm font-semibold text-white"
          >
            Print / Save PDF
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 rounded-full border border-[#0B1F3A] py-3 text-sm font-semibold"
          >
            {copied ? "Copied!" : "Copy JSON"}
          </button>
        </div>

        <pre className="max-h-80 overflow-auto rounded-2xl border border-[#E8E2D9] bg-white p-4 text-xs text-[#5C6570]">
          {payload}
        </pre>
      </main>
      <BottomNav />
    </div>
  );
}
