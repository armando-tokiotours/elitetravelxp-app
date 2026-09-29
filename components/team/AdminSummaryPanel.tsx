"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type PocketBase from "pocketbase";
import { Loader2 } from "lucide-react";

type LeadLite = {
  status?: string;
  type?: string;
  created?: string;
  email_sent_count?: number;
};

function normalizeStatus(raw: unknown): string {
  const s = String(raw || "lead")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (s === "confirmed" || s === "confirm") return "confirmed";
  if (s === "in_progress" || s === "in-progress" || s === "progress")
    return "in_progress";
  if (s === "draft") return "draft";
  return "lead";
}

function normalizeType(raw: unknown): "multi" | "single" | "other" {
  const t = String(raw || "")
    .trim()
    .toLowerCase();
  if (t.includes("single") || t === "s" || t === "builder_s") return "single";
  if (t.includes("multi") || t === "m" || t === "builder_m") return "multi";
  return "other";
}

/**
 * Admin Summary — static snapshot of bookings_and_leads (no email settings).
 */
export function AdminSummaryPanel({
  getClient,
}: {
  getClient: () => PocketBase;
}) {
  const [rows, setRows] = useState<LeadLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pb = getClient();
        const token = pb.authStore.token;
        let list: LeadLite[] = [];
        if (token) {
          const res = await fetch("/api/admin/bookings-and-leads", {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && Array.isArray(data.records)) {
            list = data.records as LeadLite[];
          }
        }
        if (!list.length) {
          try {
            list = (await pb.collection("bookings_and_leads").getFullList({
              fields: "status,type,created,email_sent_count",
              requestKey: null,
            })) as LeadLite[];
          } catch {
            /* empty */
          }
        }
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load summary");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getClient]);

  const stats = useMemo(() => {
    const byStatus = {
      lead: 0,
      draft: 0,
      in_progress: 0,
      confirmed: 0,
    };
    let multi = 0;
    let single = 0;
    let other = 0;
    let emailed = 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let last7 = 0;

    for (const r of rows) {
      const st = normalizeStatus(r.status) as keyof typeof byStatus;
      if (st in byStatus) byStatus[st] += 1;
      else byStatus.lead += 1;

      const ty = normalizeType(r.type);
      if (ty === "multi") multi += 1;
      else if (ty === "single") single += 1;
      else other += 1;

      if ((r.email_sent_count || 0) > 0) emailed += 1;
      const created = Date.parse(String(r.created || ""));
      if (created && created >= weekAgo) last7 += 1;
    }

    return {
      total: rows.length,
      byStatus,
      multi,
      single,
      other,
      emailed,
      last7,
    };
  }, [rows]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-12 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading summary…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-white">Summary</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Snapshot of leads and bookings. Email SMTP lives in{" "}
          <Link
            href="/team-access"
            className="text-[#7dd3fc] underline-offset-2 hover:underline"
          >
            Content Admin → Email Settings
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total records" value={stats.total} accent="#075473" />
        <StatCard label="Last 7 days" value={stats.last7} accent="#1CA67F" />
        <StatCard label="Confirmed" value={stats.byStatus.confirmed} accent="#F6A724" />
        <StatCard label="Emailed (≥1)" value={stats.emailed} accent="#DC6E8A" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-[#1C1C1E]/80 p-5">
          <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            By status
          </h3>
          <ul className="mt-4 space-y-3">
            <StatusRow label="Lead" count={stats.byStatus.lead} total={stats.total} color="#7dd3fc" />
            <StatusRow label="Draft" count={stats.byStatus.draft} total={stats.total} color="#a1a1aa" />
            <StatusRow
              label="In progress"
              count={stats.byStatus.in_progress}
              total={stats.total}
              color="#F6A724"
            />
            <StatusRow
              label="Confirmed"
              count={stats.byStatus.confirmed}
              total={stats.total}
              color="#1CA67F"
            />
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#1C1C1E]/80 p-5">
          <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            By trip type
          </h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniStat label="Multi-day" value={stats.multi} />
            <MiniStat label="Single-day" value={stats.single} />
            <MiniStat label="Other / unset" value={stats.other} />
          </div>
          <p className="mt-5 text-xs text-zinc-500">
            Open Bookings &amp; Leads for the full table, export, and status
            actions.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#1C1C1E]/80 p-4">
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-30 blur-2xl"
        style={{ background: accent }}
        aria-hidden
      />
      <p className="relative text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="relative mt-2 font-display text-3xl text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-center">
      <p className="font-display text-2xl text-white">{value}</p>
      <p className="mt-1 text-[0.65rem] text-zinc-500">{label}</p>
    </div>
  );
}

function StatusRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="font-semibold text-white">
          {count}{" "}
          <span className="font-normal text-zinc-500">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </li>
  );
}
