"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { requestGuestCommOpen } from "@/lib/guestTalkChat";
import { GUIDE_CONTACT_UNLOCK_MSG } from "@/lib/guidePrivacy";

/**
 * Compact Coordination Team widget — photo, name, email.
 * Messaging opens the on-page GuestTalkBubble chat modal (no route).
 * Full email / WhatsApp unlock with confirmed + fully paid booking.
 */
export function CoordinationTeamSection({
  pnr,
  agentName: agentNameProp,
  guestEmail,
  guestName,
  tripPath: _tripPath = "/builder/itinerary",
}: {
  pnr: string;
  agentName?: string | null;
  guestEmail?: string;
  guestName?: string;
  /** @deprecated Chat opens as modal — path unused. */
  tripPath?: string;
}) {
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
        const msgs = data.messages || [];
        // Unread ≈ staff messages (guest opens page to read)
        const staffMsgs = msgs.filter(
          (m) => m.author_role === "agent" || m.author_role === "ops"
        ).length;
        let seen = 0;
        try {
          seen = Number(
            sessionStorage.getItem(`comm-seen-${ref}`) || "0"
          );
        } catch {
          seen = 0;
        }
        setUnread(Math.max(0, staffMsgs - seen));
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
  const email = agent?.email || "";
  const photoUrl = agent?.photoUrl || "";
  const wa = String(agent?.whatsappDigits || "").replace(/\D/g, "");
  const unlockMessage =
    agent?.unlockMessage ||
    (assigned && agent?.contactsUnlocked === false
      ? GUIDE_CONTACT_UNLOCK_MSG
      : null);
  void _tripPath;

  return (
    <section className="relative mx-auto my-6 w-full max-w-2xl rounded-3xl border-2 border-dashed border-white/40 bg-black/20 p-4 print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent">
      <span className="absolute -top-3 left-4 z-20 rounded border border-white/30 bg-zinc-800 px-2 py-0.5 font-mono text-[9px] tracking-widest text-amber-400 uppercase print:border-gray-300 print:bg-white print:text-gray-900">
        Coordination Team
      </span>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4 text-white print:rounded-none print:border-gray-200 print:bg-transparent print:text-gray-900">
        <div className="absolute top-3 right-3 z-10 print:hidden">
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
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-zinc-300 transition hover:text-white disabled:pointer-events-none disabled:opacity-40`}
          >
            <Mail className="h-5 w-5" aria-hidden />
            {unread > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E60F43] px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </button>
        </div>

        <p className="pr-12 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase print:text-gray-600">
          Your TokioTours agent
        </p>

        {assigned ? (
          <div className="mt-3 flex items-center gap-3">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/40 font-godiva text-lg text-cyan-300 print:border-gray-300 print:bg-transparent print:text-gray-900">
                {(name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-godiva text-base tracking-wide text-white uppercase print:text-gray-900">
                {name}
              </p>
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="mt-0.5 block truncate text-sm text-cyan-300/90 hover:underline print:text-gray-700"
                >
                  {email}
                </a>
              ) : unlockMessage ? (
                <p className="mt-0.5 text-xs text-amber-300/85 print:text-gray-600">
                  {unlockMessage}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-zinc-500 print:text-gray-600">
                  Coordination email on file with Ops
                </p>
              )}
              {wa ? (
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block text-xs text-emerald-300/90 hover:underline print:text-gray-700"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 print:text-gray-600">
            Still pending — Operations will assign your TokioTours agent.
          </p>
        )}
      </div>
    </section>
  );
}
