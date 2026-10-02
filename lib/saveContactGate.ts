"use client";

import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import { normalizeTiming } from "@/lib/preEliteBuilder";

/**
 * Persist contact from the builder gate: local stores + PocketBase draft create.
 */
export async function saveContactAndCreateDraft(contact: {
  fullName: string;
  email: string;
  whatsapp?: string;
}): Promise<{ bookingRef: string }> {
  const pre = usePreBuilderStore.getState();
  const fullName = contact.fullName.trim();
  const email = contact.email.trim().toLowerCase();
  const whatsapp = String(contact.whatsapp || pre.whatsapp || "").trim();

  if (!pre.tripType) {
    throw new Error(
      "Trip type missing — restart from the homepage and choose Single-Day or Multi-Day."
    );
  }

  const timing = pre.timing.formattedString.trim()
    ? normalizeTiming(pre.timing)
    : normalizeTiming({
        totalDays: pre.tripType === "single_day" ? 1 : 14,
        formattedString:
          pre.tripType === "single_day" ? "1 Day (TBD)" : "14 Days (TBD)",
      });

  pre.setContact({ fullName, email, whatsapp, timing });

  const res = await fetch("/api/pre-elite-builder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      travelStyle: pre.travelStyle,
      interests: pre.interests,
      tripMotivation: pre.tripMotivation,
      painPoints: pre.painPoints,
      tripType: pre.tripType,
      fullName,
      email,
      whatsapp,
      timing,
      adults: pre.adults || 1,
      children: pre.children || 0,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      String(data?.error || "Could not save your request. Try again.")
    );
  }

  const bookingRef = String(data.bookingRef || "").trim().toUpperCase();
  if (!bookingRef) {
    throw new Error("Save succeeded but no booking reference was returned.");
  }

  pre.markSubmitted({
    bookingRef,
    fullName: String(data.fullName || fullName).trim(),
    email: String(data.email || email).trim().toLowerCase(),
    whatsapp,
    status: "draft",
    itineraryData: String(data.itineraryData || pre.lastPayload?.itineraryData || ""),
  });

  useItineraryStore.getState().setClientName(fullName);
  useItineraryStore.getState().setClientEmail(email);
  useBuilderStore.setState({
    confirmedBookingRef: bookingRef,
    tempBookingRef: bookingRef,
    bookingStatus: "draft",
  });

  try {
    window.localStorage.setItem("pnr_draft_status", "SAVED");
  } catch {
    /* private mode */
  }

  return { bookingRef };
}

export function hasGuestContact(): boolean {
  const it = useItineraryStore.getState();
  const pre = usePreBuilderStore.getState();
  const name = (it.clientName || pre.fullName || pre.lastPayload?.fullName || "").trim();
  const email = (
    it.clientEmail ||
    pre.email ||
    pre.lastPayload?.email ||
    ""
  )
    .trim()
    .toLowerCase();
  const phone = (
    pre.whatsapp ||
    pre.lastPayload?.whatsapp ||
    ""
  ).trim();
  const phoneOk = phone.replace(/\D/g, "").length >= 7;
  const draftSaved =
    pre.pnrDraftStatus === "SAVED" ||
    Boolean(String(pre.lastPayload?.bookingRef || "").trim());
  return Boolean(
    name &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      phoneOk &&
      draftSaved
  );
}
