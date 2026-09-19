"use client";

import { useState } from "react";
import { PrintItineraryDocument } from "@/components/builder/PrintItineraryDocument";
import {
  PrintRequestModal,
  type PrintRequestResult,
} from "@/components/checkout/PrintRequestModal";

/** Print / Save PDF opens Resend email dispatch (server PDF + BCC team). */
export default function PrintPageClient() {
  const [printOpen, setPrintOpen] = useState(false);
  const [printResult, setPrintResult] = useState<PrintRequestResult | null>(
    null
  );

  return (
    <>
      <PrintItineraryDocument onPrintRequest={() => setPrintOpen(true)} />
      <PrintRequestModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        onSuccess={(result) => {
          setPrintResult(result);
        }}
      />
      {printResult ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#B85304]">
              Itinerary saved
            </p>
            <h2 className="mt-2 font-display text-2xl text-[#0B1F3A]">
              PNR {printResult.bookingRef}
            </h2>
            <p className="mt-2 text-sm text-[#5C6570]">{printResult.message}</p>
            <button
              type="button"
              onClick={() => setPrintResult(null)}
              className="mt-5 w-full rounded-full bg-[#0B1F3A] py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
