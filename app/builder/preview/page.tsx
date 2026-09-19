"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  cityPhoto,
  fetchBuilderConfig,
  pbFileUrl,
  type BuilderConfig,
} from "@/lib/pocketbase/client";
import { calculateBuilderQuote, formatUsd } from "@/lib/builder-pricing";
import { useBuilderStore } from "@/store/useBuilderStore";
import { BottomNav } from "@/components/builder/BottomNav";

export default function PreviewPage() {
  const state = useBuilderStore();
  const [config, setConfig] = useState<BuilderConfig | null>(null);

  useEffect(() => {
    useBuilderStore.persist.rehydrate();
    fetchBuilderConfig({ includeAccommodations: true })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const quote = useMemo(
    () => (config ? calculateBuilderQuote(state, config) : null),
    [config, state]
  );

  return (
    <div className="builder-theme min-h-screen bg-[#F5F0E8] pb-28 text-[#0B1F3A]">
      <header className="border-b border-[#E8E2D9] bg-[#FBF8F2] px-4 py-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#C4A35A]">
          Preview Trip
        </p>
        <h1 className="mt-1 font-display text-3xl">
          {state.durationDays}-Day Japan Preview
        </h1>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-4">
          {state.locations.map((loc, i) => {
            const city = config?.cities.find((c) => c.id === loc.cityId);
            const filename = city ? cityPhoto(city) : "";
            const img =
              filename && city
                ? pbFileUrl(city.collectionId, city.id, filename, "600x400")
                : "";
            const cityTours =
              config?.tours.filter(
                (t) =>
                  t.city_id === loc.cityId &&
                  state.selectedTourIds.includes(t.id)
              ) ?? [];

            return (
              <article
                key={loc.key}
                className="overflow-hidden rounded-2xl border border-[#E8E2D9] bg-white shadow-sm"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={city?.name ?? ""}
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-[#E8E2D9] font-display text-2xl text-[#8A8278]">
                    {city?.name}
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#C4A35A]">
                    Stop {i + 1}
                  </p>
                  <h2 className="font-display text-2xl">
                    {city?.name ?? "City"}
                  </h2>
                  <p className="mt-1 text-sm text-[#5C6570]">
                    {loc.nights} night{loc.nights === 1 ? "" : "s"}
                  </p>
                  {cityTours.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-[#0B1F3A]">
                      {cityTours.map((t) => (
                        <li key={t.id}>· {t.title}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {quote ? (
          <p className="mt-6 text-center font-display text-2xl">
            {formatUsd(quote.min)} – {formatUsd(quote.max)}
          </p>
        ) : null}

        <Link
          href="/builder"
          className="mt-6 block rounded-full bg-[#0B1F3A] py-3 text-center text-sm font-semibold text-white"
        >
          Continue Editing
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}
