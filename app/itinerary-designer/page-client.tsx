"use client";

import { AccommodationSettings } from "@/components/modules/AccommodationSettings";
import { AirportTransfers } from "@/components/modules/AirportTransfers";
import {
  ArrivalHub,
  DepartureHub,
} from "@/components/modules/ArrivalDepartureHubs";
import { ExcursionsTours } from "@/components/modules/ExcursionsTours";
import { ExportActions } from "@/components/modules/ExportActions";
import { GuestDetails } from "@/components/modules/GuestDetails";
import { InterCityTransit } from "@/components/modules/InterCityTransit";
import { LocationNightAllocation } from "@/components/modules/LocationNightAllocation";
import { QuotationSummary } from "@/components/modules/QuotationSummary";
import { TripDuration } from "@/components/modules/TripDuration";

export default function ItineraryDesignerPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0B0C] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.08)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(255,255,255,0.03)_0%,_transparent_40%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="group">
            <p className="text-[0.6rem] uppercase tracking-[0.4em] text-[#D4AF37] transition group-hover:text-[#e0c04a]">
              TOKIOTOURS
            </p>
            <p className="mt-1 font-display text-lg tracking-wide text-white sm:text-xl">
              Itinerary Designer
            </p>
          </a>
          <a
            href="https://tokiotours-app.com"
            className="hidden text-xs tracking-[0.2em] text-white/40 uppercase transition hover:text-[#D4AF37] sm:block"
          >
            tokiotours-app.com
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        <div className="mb-10 max-w-2xl animate-fade-up">
          <h1 className="font-display text-4xl leading-tight tracking-wide text-white sm:text-5xl">
            Design Your Japan Journey
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/55 sm:text-lg">
            Compose a bespoke itinerary. Preferences update a live price range
            in real time — then export a printable quotation or submit to our
            concierge team.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-6 animate-stagger">
            <TripDuration />
            <GuestDetails />
            <ArrivalHub />
            <DepartureHub />
            <AirportTransfers />
            <AccommodationSettings />
            <LocationNightAllocation />
            <ExcursionsTours />
            <InterCityTransit />
            <ExportActions />
          </div>

          <div className="lg:self-start">
            <div className="fixed inset-x-0 bottom-0 z-40 lg:static">
              <div className="mx-auto max-w-7xl lg:mx-0">
                <QuotationSummary />
              </div>
            </div>
            <div className="h-24 lg:hidden" aria-hidden />
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs tracking-wider text-white/30">
        © {new Date().getFullYear()} TOKIOTOURS · Private
        &amp; Confidential
      </footer>
    </div>
  );
}
