import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Map · Dev Index",
  description: "Developer silo map — not linked from public Silo 1.",
  robots: { index: false, follow: false },
};

type MapLink = {
  href: string;
  label: string;
  note?: string;
};

type StubCard = {
  label: string;
  note: string;
};

const SILO1_LIVE: MapLink[] = [
  { href: "/", label: "Home" },
  { href: "/pre-elite-builder", label: "Pre-Elite Qualification" },
  { href: "/pre-build", label: "Pre-Build" },
  { href: "/builder", label: "Trip Builder (multi-day)" },
  { href: "/builder-single", label: "Trip Builder (single-day)" },
  { href: "/discover", label: "Discover Experiences" },
  { href: "/builder/itinerary", label: "My Saved Itineraries" },
  { href: "/builder/preview", label: "Builder Preview" },
  { href: "/builder/export", label: "Builder Export" },
  { href: "/manage", label: "Manage Booking" },
  { href: "/budget-planner", label: "Budget Planner" },
  { href: "/itinerary-designer", label: "Itinerary Designer" },
  {
    href: "/pass-preview/SAMPLE",
    label: "Pass Preview",
    note: "Needs a real PNR — /pass-preview/[pnr]",
  },
];

const SILO2_PLANNED: StubCard[] = [
  { label: "Agency login", note: "Portal auth — not built" },
  { label: "Agency orders", note: "List/detail over agency_orders" },
  { label: "Inquire / Reserve", note: "Agency intake → agency_orders" },
];

const SILO3_LIVE: MapLink[] = [
  { href: "/admin", label: "Admin / leads" },
  { href: "/team-access", label: "Team Access (content)" },
  { href: "/ops", label: "Ops board (assign / job board)" },
  { href: "/ops/booking", label: "Booking master (PNR assemble)" },
  { href: "/ops/money", label: "Money pocket (owner)" },
  { href: "/agent", label: "Concierge agent portal" },
  { href: "/ticketer", label: "Ticketer portal" },
  { href: "/guide", label: "Guide portal (my jobs + board)" },
  { href: "/driver", label: "Driver portal (my jobs + board)" },
  { href: "/agency", label: "Agency portal + inquire" },
  { href: "/profile", label: "Staff profile (bio / media / bank)" },
];

const SILO3_PLANNED: StubCard[] = [
  { label: "Comm hub", note: "Guest/staff messaging — not built" },
  { label: "Google Workspace SSO", note: "Button stubbed — add OAuth client next" },
];

function LiveLink({ item }: { item: MapLink }) {
  return (
    <li>
      <Link
        href={item.href}
        className="group flex flex-col rounded-lg border border-zinc-700/80 bg-zinc-900/60 px-3 py-2.5 transition hover:border-[#075473] hover:bg-zinc-900"
      >
        <span className="text-sm font-medium text-zinc-100 group-hover:text-white">
          {item.label}
        </span>
        <span className="mt-0.5 font-mono text-[11px] text-zinc-500">
          {item.href}
        </span>
        {item.note ? (
          <span className="mt-1 text-[11px] text-amber-500/90">{item.note}</span>
        ) : null}
      </Link>
    </li>
  );
}

function StubItem({ item }: { item: StubCard }) {
  return (
    <li className="rounded-lg border border-dashed border-zinc-700/60 bg-zinc-950/40 px-3 py-2.5 opacity-60">
      <span className="text-sm text-zinc-400">{item.label}</span>
      <p className="mt-0.5 text-[11px] text-zinc-600">{item.note}</p>
    </li>
  );
}

export default function MapPage() {
  return (
    <div className="min-h-screen bg-[#0B0F14] text-zinc-200">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10 border-b border-zinc-800 pb-6">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#075473]">
            Developer index
          </p>
          <h1 className="mt-2 font-display text-3xl text-white sm:text-4xl">
            Map
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            Dev only — not linked from public Silo 1. Cross-silo entry lives
            here; guest chrome never points at Team Access or agency/ops UI.
          </p>
        </header>

        <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
          <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Data spine
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            <li>
              <span className="text-[#075473]">Silo 1</span> →{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                bookings_and_leads
              </code>{" "}
              (<code className="text-[12px] text-zinc-500">source=direct</code>)
            </li>
            <li>
              <span className="text-[#075473]">Silo 2</span> →{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                agency_orders
              </code>{" "}
              <span className="text-zinc-500">(inquire live)</span>
            </li>
            <li>
              <span className="text-[#075473]">Silo 3</span> → thin{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                ops_hub
              </code>{" "}
              by PNR + pockets{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                ops_dispatch
              </code>
              ,{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                ops_money
              </code>
              ,{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                ops_tickets
              </code>
              ,{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                ops_payouts
              </code>
              ; people →{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                staff_profiles
              </code>{" "}
              /{" "}
              <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-[12px] text-zinc-200">
                agencies
              </code>
            </li>
            <li>
              Staff roles: owner · ops (Operations manager) · agent (Concierge) ·
              ticketer · guide · driver · agency —{" "}
              <Link href="/ops" className="text-[#075473] hover:underline">
                /ops
              </Link>
              ,{" "}
              <Link href="/agency" className="text-[#075473] hover:underline">
                /agency
              </Link>
            </li>
            <li>
              Staff entry:{" "}
              <Link href="/admin" className="text-[#075473] hover:underline">
                /admin
              </Link>
              ,{" "}
              <Link
                href="/team-access"
                className="text-[#075473] hover:underline"
              >
                /team-access
              </Link>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-white">Silo 1 · Direct</h2>
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-500/90">
              Live
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SILO1_LIVE.map((item) => (
              <LiveLink key={item.href} item={item} />
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-white">Silo 2 · Agency</h2>
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
              Planned
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SILO2_PLANNED.map((item) => (
              <StubItem key={item.label} item={item} />
            ))}
          </ul>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-white">
              Silo 3 · Ops / Team Access
            </h2>
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-500/90">
              Staff live
            </span>
          </div>
          <ul className="mb-4 grid gap-2 sm:grid-cols-2">
            {SILO3_LIVE.map((item) => (
              <LiveLink key={item.href} item={item} />
            ))}
          </ul>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-500">
            Planned stubs
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SILO3_PLANNED.map((item) => (
              <StubItem key={item.label} item={item} />
            ))}
          </ul>
        </section>

        <p className="border-t border-zinc-800 pt-6 text-xs text-zinc-600">
          Bookmark <code className="text-zinc-500">/map</code> — not in public
          nav.
        </p>
      </div>
    </div>
  );
}
