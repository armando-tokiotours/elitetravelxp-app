"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";

/**
 * Compact Coordination Team widget — photo, name, email.
 * Messaging opens a separate communications page.
 */
export function CoordinationTeamSection({
  pnr,
  agentName: agentNameProp,
  guestEmail,
  guestName,
  tripPath = "/builder/itinerary",
}: {
  pnr: string;
  agentName?: string | null;
  guestEmail?: string;
  guestName?: string;
  tripPath?: string;
}) {
  const [agent, setAgent] = useState<{
    name?: string;
    email?: string;
    photoUrl?: string;
  } | null>(null);
  const [unread, setUnread] = useState(0);

  const reload = useCallback(async () => {
    const ref = String(pnr || "").trim();
    if (!ref || ref.startsWith("TMP-")) return;
    try {
      const [agentRes, commRes] = await Promise.all([
        fetch(`/api/bookings/concierge-agent?pnr=${encodeURIComponent(ref)}`, {
          cache: "no-store",
        }),
        fetch(`/api/comm?pnr=${encodeURIComponent(ref)}`, { cache: "no-store" }),
      ]);
      if (agentRes.ok) {
        const data = (await agentRes.json()) as {
          agent?: {
            name?: string;
            email?: string;
            photoUrl?: string;
          } | null;
        };
        setAgent(data.agent || null);
      }
      if (commRes.ok) {
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
  const commHref = `${tripPath.replace(/\/$/, "")}/comm?pnr=${encodeURIComponent(pnr)}&guestEmail=${encodeURIComponent(guestEmail || "")}&guestName=${encodeURIComponent(guestName || "")}`;

  return (
    <section className="relative mx-auto my-6 w-full max-w-2xl rounded-3xl border-2 border-dashed border-white/40 bg-black/20 p-4">
      <span className="absolute -top-3 left-4 z-20 rounded border border-white/30 bg-zinc-800 px-2 py-0.5 font-mono text-[9px] tracking-widest text-amber-400 uppercase">
        Coordination Team
      </span>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4 text-white">
        <div className="absolute top-3 right-3 z-10">
          <Link
            href={assigned ? commHref : "#"}
            aria-label="Messages"
            title="Messages"
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-zinc-300 transition hover:text-white ${
              assigned ? "" : "pointer-events-none opacity-40"
            }`}
          >
            <Mail className="h-5 w-5" aria-hidden />
            {unread > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E60F43] px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
        </div>

        <p className="pr-12 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
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
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/40 font-godiva text-lg text-cyan-300">
                {(name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-godiva text-base tracking-wide text-white uppercase">
                {name}
              </p>
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="mt-0.5 block truncate text-sm text-cyan-300/90 hover:underline"
                >
                  {email}
                </a>
              ) : (
                <p className="mt-0.5 text-xs text-zinc-500">
                  Coordination email on file with Ops
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Still pending — Operations will assign your TokioTours agent.
          </p>
        )}
      </div>
    </section>
  );
}
