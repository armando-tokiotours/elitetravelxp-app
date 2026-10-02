"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { MobileTopChrome } from "@/components/navigation/MobileTopChrome";
import { BookingRefBadge } from "@/components/builder/BookingRefBadge";
import { NewBookingResetButton } from "@/components/builder/NewBookingResetButton";
import { GoldLight } from "@/components/branding/GoldLight";
import { IdleHeroMascot } from "@/components/branding/IdleHeroMascot";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import { useBuilderEStore } from "@/store/useBuilderEStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { BuilderEServiceGrid } from "@/components/builder-e/BuilderEServiceGrid";
import { ServiceDetailMediaModal } from "@/components/builder-e/ServiceDetailMediaModal";
import { AttractionsDiscoveryModal } from "@/components/builder-e/AttractionsDiscoveryModal";
import type { SubServiceItem } from "@/components/builder-e/subServices";

export function BuilderEView() {
  const bookingRef = useBuilderEStore((s) => s.bookingRef);
  const ensureBookingRef = useBuilderEStore((s) => s.ensureBookingRef);
  const cart = useBuilderEStore((s) => s.cart);
  const removeCartItem = useBuilderEStore((s) => s.removeCartItem);
  const setGuestName = useBuilderEStore((s) => s.setGuestName);
  const setGuestEmail = useBuilderEStore((s) => s.setGuestEmail);
  const setGuestWhatsapp = useBuilderEStore((s) => s.setGuestWhatsapp);
  const guestName = useBuilderEStore((s) => s.guestName);
  const guestEmail = useBuilderEStore((s) => s.guestEmail);
  const guestWhatsapp = useBuilderEStore((s) => s.guestWhatsapp);
  const [activeService, setActiveService] = useState<SubServiceItem | null>(
    null
  );
  const [attractionsOpen, setAttractionsOpen] = useState(false);

  useEffect(() => {
    ensureBookingRef();
    const it = useItineraryStore.getState();
    const pre = usePreBuilderStore.getState();
    const name = (
      guestName ||
      it.clientName ||
      pre.fullName ||
      pre.lastPayload?.fullName ||
      ""
    ).trim();
    const email = (
      guestEmail ||
      it.clientEmail ||
      pre.email ||
      pre.lastPayload?.email ||
      ""
    )
      .trim()
      .toLowerCase();
    const whatsapp = (
      guestWhatsapp ||
      pre.whatsapp ||
      pre.lastPayload?.whatsapp ||
      ""
    ).trim();
    if (name && !guestName) setGuestName(name);
    if (email && !guestEmail) setGuestEmail(email);
    if (whatsapp && !guestWhatsapp) setGuestWhatsapp(whatsapp);
  }, [
    ensureBookingRef,
    guestEmail,
    guestName,
    guestWhatsapp,
    setGuestEmail,
    setGuestName,
    setGuestWhatsapp,
  ]);

  return (
    <div className="builder-theme relative z-10 min-h-screen overflow-x-hidden bg-transparent pb-28 text-white">
      <SystemMessageFox />
      <div className="no-print">
        <MobileTopChrome
          brandTitle="Builder E"
          ctaHref="/builder-e/dossier"
          ctaLabel="Dossier"
        />
      </div>

      <div className="mx-auto w-full max-w-lg px-4 pt-20 lg:max-w-xl lg:pt-10">
        <header className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0D1117]/80 p-5">
          <GoldLight color="#F6A724" placement="left-center" />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
                Builder E · Micro-Services
              </p>
              <h1 className="font-godiva mt-1 text-2xl tracking-wide text-white uppercase sm:text-3xl">
                Experiences
                <br />
                Tickets
                <br />
                Services
              </h1>
            </div>
            <div className="flex flex-col items-end gap-2">
              <IdleHeroMascot className="h-24 w-auto" />
              <div className="flex w-full max-w-[16rem] items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <BookingRefBadge
                    bookingStatus="draft"
                    tempBookingRef={bookingRef}
                    confirmedBookingRef={null}
                  />
                </div>
                <NewBookingResetButton scope="builder-e" />
              </div>
            </div>
          </div>
        </header>

        <p className="mb-1 text-xs font-bold tracking-widest text-gray-400 uppercase">
          Tap a mini app to explore &amp; add
        </p>

        <BuilderEServiceGrid
          onSelect={(item) => {
            ensureBookingRef();
            setActiveService(item);
          }}
          onOpenAttractions={() => {
            ensureBookingRef();
            setAttractionsOpen(true);
          }}
        />

        {cart.length > 0 ? (
          <section className="mb-6 space-y-2 rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              On this PNR · {cart.length} item{cart.length === 1 ? "" : "s"}
            </p>
            <ul className="space-y-2">
              {cart.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                      {item.category}
                    </p>
                    <p className="truncate text-sm font-semibold text-white">
                      {item.label}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {item.summary}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCartItem(item.id)}
                    className="shrink-0 rounded-full border border-white/10 p-1.5 text-zinc-500 hover:text-white"
                    aria-label={`Remove ${item.label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Link
          href="/builder-e/dossier"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#075473] px-4 py-3 text-xs font-bold tracking-wider text-white uppercase transition hover:bg-[#054F70]"
        >
          View dossier
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <ServiceDetailMediaModal
        service={activeService}
        onClose={() => setActiveService(null)}
      />
      <AttractionsDiscoveryModal
        open={attractionsOpen}
        onClose={() => setAttractionsOpen(false)}
      />

    </div>
  );
}
