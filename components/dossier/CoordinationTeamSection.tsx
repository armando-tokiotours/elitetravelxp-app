"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import {
  countUnreadStaffMessages,
  requestGuestCommOpen,
} from "@/lib/guestTalkChat";
import { StaffIdentityCard } from "@/components/dossier/DayStaffCards";

/** Guide / driver entry rendered below the agent (privacy already masked by caller). */
export type CoordinationStaffEntry = {
  name?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsappDigits?: string | null;
  /** Shown when full contact is still gated (see lib/guidePrivacy.ts). */
  unlockMessage?: string | null;
  emptyLabel?: string;
  serviceTitle?: string | null;
  serviceHint?: string | null;
  /** e.g. “Day 2 · 14 Oct” for multi-day per-day guide rows. */
  dayLabel?: string | null;
};

/**
 * Compact Coordination Team widget — photo, name, role label.
 * Messaging opens the on-page GuestTalkBubble chat modal (no route).
 * Concierge / assigned agent: photo, full name, WhatsApp and
 * messaging are visible immediately (no payment unlock). Below the agent,
 * the assigned guide (and driver, only when actually assigned) are shown
 * reusing StaffIdentityCard — guide/driver names and contacts arrive
 * already privacy-masked from ops-staff / lib/guidePrivacy.ts, so a locked
 * guide shows first name + “Full contact details unlock…” and an
 * unassigned guide shows the existing pending copy. No driver entry is
 * rendered at all when no driver/car is assigned.
 */
export function CoordinationTeamSection({
  pnr,
  agentName: agentNameProp,
  guestEmail,
  guestName,
  tripPath: _tripPath = "/builder/itinerary",
  guide,
  guides,
  driver,
}: {
  pnr: string;
  agentName?: string | null;
  guestEmail?: string;
  guestName?: string;
  /** @deprecated Chat opens as modal — path unused. */
  tripPath?: string;
  /** Single-day / fallback guide (rendered even when unassigned → pending). */
  guide?: CoordinationStaffEntry | null;
  /** Multi-day: per-day guides, labelled by day/date. Takes precedence over `guide`. */
  guides?: CoordinationStaffEntry[];
  /** Rendered ONLY when it carries a name (driver/car actually assigned). */
  driver?: CoordinationStaffEntry | null;
}) {
  const guideEntries: CoordinationStaffEntry[] =
    guides && guides.length > 0 ? guides : guide ? [guide] : [];
  const showDriver = Boolean(driver && String(driver.name || "").trim());
  const [agent, setAgent] = useState<{
    name?: string;
    email?: string | null;
    photoUrl?: string;
    whatsappDigits?: string | null;
    unlockMessage?: string | null;
    contactsUnlocked?: boolean;
  } | null>(null);
  const [unread, setUnread] = useState(0);

  const reload = useCallback(async () => {
    const ref = String(pnr || "").trim();
    if (!ref) return;
    try {
      const [agentRes, commRes] = await Promise.all([
        fetch(`/api/bookings/concierge-agent?pnr=${encodeURIComponent(ref)}`, {
          cache: "no-store",
        }),
        // Messaging hub is JPN-only today; TMP still loads agent assignment.
        ref.startsWith("TMP-")
          ? Promise.resolve(null)
          : fetch(`/api/comm?pnr=${encodeURIComponent(ref)}`, {
              cache: "no-store",
            }),
      ]);
      if (agentRes.ok) {
        const data = (await agentRes.json()) as {
          agent?: {
            name?: string;
            email?: string | null;
            photoUrl?: string;
            whatsappDigits?: string | null;
            unlockMessage?: string | null;
            contactsUnlocked?: boolean;
          } | null;
        };
        setAgent(data.agent || null);
      }
      if (commRes && commRes.ok) {
        const data = (await commRes.json()) as {
          messages?: { author_role?: string }[];
        };
        setUnread(countUnreadStaffMessages(ref, data.messages || []));
      }
    } catch {
      /* ignore */
    }
  }, [pnr]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const name = agent?.name || agentNameProp || null;
  const assigned = Boolean(name);
  const photoUrl = agent?.photoUrl || "";
  const wa = String(agent?.whatsappDigits || "").replace(/\D/g, "");
  void _tripPath;

  return (
    /* px inset so soft side shadow isn’t clipped by itinerary `overflow-x-hidden` mains */
    <div className="mb-8 w-full px-6 sm:px-8 print:px-0">
      <div className="relative z-[1] flex h-full w-full flex-col rounded-[32px] bg-white px-6 py-8 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] print:break-inside-avoid print:shadow-none">
        <p className="mb-6 text-xs font-black tracking-widest text-[#060A0F] uppercase md:text-sm">
          Coordination Team
        </p>

        <section className="relative w-full flex-1">
          <div className="relative h-full overflow-hidden text-[#060A0F] print:text-gray-900">
            <div className="absolute top-0 right-0 z-10 print:hidden">
              <button
                type="button"
                disabled={!assigned}
                onClick={() =>
                  requestGuestCommOpen({
                    pnr,
                    guestEmail,
                    guestName,
                  })
                }
                aria-label="Messages"
                title="Messages"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#060A0F] transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
              >
                <Mail className="h-5 w-5" aria-hidden />
                {unread > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E60F43] px-1 text-[10px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </button>
            </div>

            {assigned ? (
              <div className="flex items-center gap-3 pr-12">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-gray-200"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-cyan-600/30 bg-cyan-50 font-godiva text-lg text-cyan-700 print:border-gray-300 print:bg-transparent print:text-gray-900">
                    {(name || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-godiva text-base tracking-wide text-[#060A0F] uppercase print:text-gray-900">
                    {name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold tracking-wider text-gray-500 uppercase print:text-gray-600">
                    Your TokioTours agent
                  </p>
                  {wa ? (
                    <a
                      href={`https://wa.me/${wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block text-xs text-emerald-700 hover:underline print:text-gray-700"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="pr-12 text-sm text-gray-500 print:text-gray-600">
                Still pending — Operations will assign your TokioTours agent.
              </p>
            )}

            {guideEntries.length > 0 || showDriver ? (
              <div className="mt-4 space-y-2.5 border-t border-gray-200 pt-4 print:border-gray-300">
                {guideEntries.map((entry, i) => (
                  <div key={`guide-${entry.dayLabel || i}`} className="space-y-1.5">
                    {entry.dayLabel ? (
                      <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase print:text-gray-600">
                        {entry.dayLabel}
                      </p>
                    ) : null}
                    <StaffIdentityCard
                      role="guide"
                      name={entry.name}
                      photoUrl={entry.photoUrl}
                      email={entry.email}
                      phone={entry.phone}
                      whatsappDigits={entry.whatsappDigits}
                      unlockMessage={entry.unlockMessage}
                      emptyLabel={entry.emptyLabel}
                      serviceTitle={entry.serviceTitle}
                      serviceHint={entry.serviceHint || "Pending assignment"}
                    />
                  </div>
                ))}
                {showDriver && driver ? (
                  <StaffIdentityCard
                    role="driver"
                    name={driver.name}
                    photoUrl={driver.photoUrl}
                    email={driver.email}
                    phone={driver.phone}
                    whatsappDigits={driver.whatsappDigits}
                    unlockMessage={driver.unlockMessage}
                    emptyLabel={driver.emptyLabel}
                    serviceTitle={driver.serviceTitle}
                    serviceHint={driver.serviceHint}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
