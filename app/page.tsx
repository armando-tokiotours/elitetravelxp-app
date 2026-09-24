"use client";

import { useState } from "react";
import Link from "next/link";
import { JapanKeyword } from "@/components/branding/JapanKeyword";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";

export default function HomePage() {
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <header className="relative z-10 px-6 py-6 sm:px-10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/tokiotours-logo.png"
            alt="TOKIOTOURS"
            className="h-10 w-10 rounded-full object-cover"
          />
          <p className="font-godiva text-sm tracking-[0.35em] text-[#D91147] uppercase sm:text-base">
            TOKIOTOURS
          </p>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-20 sm:px-10">
        <h1 className="max-w-3xl animate-fade-up">
          <span className="block font-godiva text-[1.2rem] font-normal leading-tight tracking-[0.08em] text-tokio-ice uppercase sm:text-[1.8rem]">
            Build your journey to
          </span>
          <JapanKeyword className="mt-1 block text-[6.0375rem] leading-[1.05] text-tokio-crimson sm:text-[9.05625rem]">
            Japan
          </JapanKeyword>
        </h1>
        <p
          className="mt-6 max-w-md font-futura text-base leading-relaxed text-tokio-ice/70 sm:text-lg animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          A mobile-first trip builder powered by live admin configuration —
          hotels, cities, tours, and transfers curated in PocketBase.
        </p>
        <div
          className="mt-10 flex w-full max-w-xs flex-col gap-3 pt-4 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <Link
            href="/pre-elite-builder"
            className="w-full rounded-full border border-amber-500/60 px-6 py-3 text-center font-godiva text-xs font-bold uppercase tracking-widest text-amber-300 shadow-md transition-all hover:bg-amber-500/10"
          >
            START TRIP BRIEF →
          </Link>
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="w-full rounded-full border border-zinc-700 bg-zinc-900/80 px-6 py-3 text-center font-godiva text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-zinc-800"
          >
            MANAGE BOOKING
          </button>
        </div>
      </main>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </div>
  );
}
