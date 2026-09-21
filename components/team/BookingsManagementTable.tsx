"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import type PocketBase from "pocketbase";

type BookingRow = {
  id: string;
  reference?: string;
  status?: string;
  contact_email?: string;
  guest_label?: string;
  adults?: number;
  children?: number;
  arrival_date?: string;
  departure_date?: string;
  quote_min?: number;
  quote_max?: number;
  notes?: string;
  created?: string;
  updated?: string;
};

function formatMoney(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Lists itinerary submissions / leads from PocketBase booking_requests.
 */
export function BookingsManagementTable({
  getClient,
}: {
  getClient: () => PocketBase;
}) {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const list = await pb.collection("booking_requests").getList(1, 100, {
        sort: "-created",
      });
      setRows(list.items as unknown as BookingRow[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load booking requests."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = !q
    ? rows
    : rows.filter((r) =>
        [r.reference, r.contact_email, r.status, r.guest_label, r.notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-white">Bookings & Leads</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Client itinerary submissions, booking PNRs, and guest contacts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by PNR, email, status…"
          className="w-full rounded-xl border border-[#2C2C2E] bg-[#121212] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#B85304]"
        />
      </label>

      {error ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#2C2C2E] text-[0.65rem] uppercase tracking-wider text-[#D9BB96]/80">
            <tr>
              <th className="px-4 py-3 font-semibold">PNR</th>
              <th className="px-4 py-3 font-semibold">Guest / Email</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Dates</th>
              <th className="px-4 py-3 font-semibold">Quote</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#B85304]" />
                  Loading bookings…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  No booking requests found.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#2C2C2E]/80 last:border-0 hover:bg-[#121212]/60"
                >
                  <td className="px-4 py-3 font-mono text-xs font-bold tracking-wider text-[#D9BB96]">
                    {row.reference || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white">{row.guest_label || "—"}</p>
                    <p className="text-xs text-zinc-500">
                      {row.contact_email || "No email"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#B85304]/40 bg-[#B85304]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D9BB96]">
                      {row.status || "unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {row.arrival_date || "—"}
                    {row.departure_date ? ` → ${row.departure_date}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-300">
                    {formatMoney(row.quote_min)}
                    {row.quote_max != null && row.quote_max !== row.quote_min
                      ? ` – ${formatMoney(row.quote_max)}`
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {row.created
                      ? new Date(row.created).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
