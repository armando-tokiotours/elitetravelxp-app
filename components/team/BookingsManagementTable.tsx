"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import type PocketBase from "pocketbase";
import {
  bookingStatusLabel,
  normalizeBookingStatus,
  type BookingStatus,
} from "@/utils/pnr";
import type {
  BookingLeadStatus,
  BookingLeadType,
} from "@/lib/bookingsAndLeads";
import {
  formatAuditSentLabel,
  formatDurationLabel,
} from "@/lib/bookingLeadAudit";
import {
  LOCAL_LEADS_STORAGE_KEYS,
  patchLocalLeadStatus,
} from "@/lib/syncBookingLead";
import { formatUsd } from "@/lib/builder-pricing";
import { generateDossierPdf } from "@/lib/generateDossierPdf";

type LeadRow = {
  id: string;
  booking_ref?: string;
  email?: string;
  guest_name?: string;
  status?: string;
  type?: BookingLeadType | string;
  primary_city?: string;
  tour_date?: string;
  end_date?: string;
  guests?: { adults?: number; kids?: number };
  duration_value?: number;
  duration_label?: string;
  cities_list?: string;
  email_sent_count?: number;
  save_version?: number;
  first_email_sent_at?: string;
  last_email_sent_at?: string;
  last_saved_at?: string;
  quote_min?: number;
  quote_max?: number;
  selections?: Record<string, unknown>;
  created?: string;
  updated?: string;
  /** localStorage fallback marker */
  source?: "bookings_and_leads" | "local";
};

/** Map admin UI status → `bookings_and_leads.status` select values. */
function toCollectionStatus(ui: BookingStatus): BookingLeadStatus {
  if (ui === "confirmed") return "confirmed";
  if (ui === "in_progress") return "in_progress";
  return "lead";
}

function formatGuests(g?: { adults?: number; kids?: number }) {
  if (!g) return "—";
  const adults = Number(g.adults) || 0;
  const kids = Number(g.kids) || 0;
  const parts: string[] = [];
  if (adults) parts.push(`${adults} Adult${adults === 1 ? "" : "s"}`);
  if (kids) parts.push(`${kids} Kid${kids === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "—";
}

function sourceBadge(type?: string) {
  if (type === "single_day") {
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider bg-cyan-500/20 text-cyan-300">
        BUILDER S
      </span>
    );
  }
  if (type === "multi_day") {
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider bg-amber-500/20 text-amber-300">
        BUILDER M
      </span>
    );
  }
  return <span className="text-xs text-zinc-500">—</span>;
}

function statusBadgeClass(status: BookingStatus) {
  if (status === "confirmed") {
    return "border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]";
  }
  if (status === "in_progress") {
    return "border-[#075473]/40 bg-[#075473]/15 text-[#075473]";
  }
  return "border-zinc-600/50 bg-zinc-800/80 text-zinc-400";
}

function extractQuote(r: Record<string, unknown>): {
  quote_min?: number;
  quote_max?: number;
} {
  const sel =
    r.selections && typeof r.selections === "object"
      ? (r.selections as Record<string, unknown>)
      : {};
  const min = Number(r.quote_min ?? sel.quote_min ?? sel.quoteMin);
  const max = Number(r.quote_max ?? sel.quote_max ?? sel.quoteMax);
  return {
    ...(Number.isFinite(min) && min > 0 ? { quote_min: min } : {}),
    ...(Number.isFinite(max) && max > 0 ? { quote_max: max } : {}),
  };
}

function formatQuote(row: LeadRow): string | null {
  const min = row.quote_min;
  const max = row.quote_max;
  if (min != null && max != null && min > 0) {
    if (max > min) return `Est. ${formatUsd(min)}–${formatUsd(max)}`;
    return `Est. ${formatUsd(min)}`;
  }
  if (min != null && min > 0) return `Est. ${formatUsd(min)}`;
  if (max != null && max > 0) return `Est. ${formatUsd(max)}`;
  return null;
}

/** Dates / Quote column — never put city names here. */
function formatDatesQuote(row: LeadRow): { dates: string; quote: string | null } {
  const start = row.tour_date ? String(row.tour_date).slice(0, 10) : "";
  const end = row.end_date ? String(row.end_date).slice(0, 10) : "";
  const sel =
    row.selections && typeof row.selections === "object" ? row.selections : {};
  const selEnd =
    typeof sel.endDate === "string"
      ? String(sel.endDate).slice(0, 10)
      : typeof sel.departureDate === "string"
        ? String(sel.departureDate).slice(0, 10)
        : "";
  const endResolved = end || selEnd;
  let dates = "—";
  if (start && endResolved && endResolved !== start) {
    dates = `${start} - ${endResolved}`;
  } else if (start) {
    dates = start;
  }
  return { dates, quote: formatQuote(row) };
}

function resolveDuration(row: LeadRow): string {
  if (row.duration_label?.trim()) return row.duration_label.trim();
  return (
    formatDurationLabel(row.type, row.duration_value) || "—"
  );
}

function resolveCities(row: LeadRow): string {
  if (row.cities_list?.trim()) return row.cities_list.trim();
  if (row.primary_city?.trim()) return row.primary_city.trim();
  const sel =
    row.selections && typeof row.selections === "object" ? row.selections : {};
  if (typeof sel.cityFocus === "string" && sel.cityFocus.trim()) {
    return sel.cityFocus.trim();
  }
  return "—";
}

function resolveGuestName(row: LeadRow): string {
  if (row.guest_name?.trim()) return row.guest_name.trim();
  const sel =
    row.selections && typeof row.selections === "object" ? row.selections : {};
  const fromSel = String(
    sel.guestName || sel.fullName || sel.contactName || ""
  ).trim();
  return fromSel || "—";
}

function formatAuditInfo(row: LeadRow): string {
  const v = Number(row.save_version) || 0;
  const sent = formatAuditSentLabel(
    row.last_email_sent_at || row.first_email_sent_at
  );
  if (!v && sent === "—") return "—";
  if (!v) return `Sent: ${sent}`;
  return `v${v} | Sent: ${sent}`;
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function exportBookingsToCSV(bookingsList: LeadRow[]) {
  const headers =
    "PNR,Guest Name,Email,Source,Dates,Duration,Cities,Version,First Email Sent,Last Saved\n";
  const rows = bookingsList
    .map((b) => {
      const { dates } = formatDatesQuote(b);
      const source =
        b.type === "single_day"
          ? "BUILDER S"
          : b.type === "multi_day"
            ? "BUILDER M"
            : "";
      return [
        b.booking_ref || "",
        resolveGuestName(b),
        b.email || "",
        source,
        dates,
        resolveDuration(b),
        resolveCities(b),
        `v${Number(b.save_version) || 0}`,
        b.first_email_sent_at || "",
        b.last_saved_at || b.updated || b.created || "",
      ]
        .map(csvEscape)
        .join(",");
    })
    .join("\n");

  const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Tokiotours_Bookings_Export_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function readLocalLeads(): LeadRow[] {
  if (typeof window === "undefined") return [];
  const out: LeadRow[] = [];
  for (const key of LOCAL_LEADS_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { items?: unknown }).items)
          ? (parsed as { items: unknown[] }).items
          : [];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const r = item as Record<string, unknown>;
        const booking_ref = String(
          r.booking_ref || r.bookingRef || r.reference || r.pnr || ""
        )
          .trim()
          .toUpperCase();
        if (!booking_ref) continue;
        const q = extractQuote(r);
        out.push({
          id: String(r.id || `local-${booking_ref}`),
          booking_ref,
          email: String(r.email || r.contact_email || r.contactEmail || "")
            .trim()
            .toLowerCase(),
          status: String(r.status || "lead"),
          type: String(r.type || "") as BookingLeadType,
          primary_city: String(r.primary_city || r.primaryCity || ""),
          tour_date: r.tour_date
            ? String(r.tour_date)
            : r.tourDate
              ? String(r.tourDate)
              : undefined,
          guests: (r.guests as LeadRow["guests"]) || undefined,
          duration_value:
            typeof r.duration_value === "number"
              ? r.duration_value
              : typeof r.durationValue === "number"
                ? r.durationValue
                : undefined,
          duration_label: String(r.duration_label || r.durationLabel || ""),
          cities_list: String(r.cities_list || r.citiesList || ""),
          guest_name: String(r.guest_name || r.guestName || r.full_name || ""),
          email_sent_count:
            typeof r.email_sent_count === "number"
              ? r.email_sent_count
              : undefined,
          save_version:
            typeof r.save_version === "number" ? r.save_version : undefined,
          first_email_sent_at: r.first_email_sent_at
            ? String(r.first_email_sent_at)
            : undefined,
          last_email_sent_at: r.last_email_sent_at
            ? String(r.last_email_sent_at)
            : undefined,
          last_saved_at: r.last_saved_at
            ? String(r.last_saved_at)
            : undefined,
          ...q,
          selections:
            r.selections && typeof r.selections === "object"
              ? (r.selections as Record<string, unknown>)
              : undefined,
          created: r.created ? String(r.created) : undefined,
          source: "local",
        });
      }
    } catch {
      /* ignore corrupt local cache */
    }
  }
  return out;
}

function combineAndDedupeLeads(
  serverRecords: LeadRow[],
  localRecords: LeadRow[]
): LeadRow[] {
  const map = new Map<string, LeadRow>();

  for (const record of serverRecords) {
    const pnr = String(record.booking_ref || "")
      .trim()
      .toUpperCase();
    if (!pnr) continue;
    if (!map.has(pnr)) {
      map.set(pnr, { ...record, booking_ref: pnr });
    }
  }

  for (const record of localRecords) {
    const pnr = String(record.booking_ref || "")
      .trim()
      .toUpperCase();
    if (!pnr || map.has(pnr)) continue;
    map.set(pnr, { ...record, booking_ref: pnr });
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.created ? Date.parse(a.created) : 0;
    const tb = b.created ? Date.parse(b.created) : 0;
    return tb - ta;
  });
}

/**
 * Lists lightweight Builder M / Builder S snapshots from `bookings_and_leads`.
 * ACTIONS: Mark Confirmed toggle + Download PDF.
 */
export function BookingsManagementTable({
  getClient,
}: {
  getClient: () => PocketBase;
}) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "multi_day" | "single_day">(
    "all"
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      if (!pb.authStore.token) {
        throw new Error("Admin session expired. Please sign in again.");
      }

      // Prefer server-side admin list (uses Docker-internal PB + admin auth).
      let pbRows: LeadRow[] = [];
      let usedServerApi = false;
      try {
        const res = await fetch("/api/admin/bookings-and-leads", {
          headers: {
            Authorization: `Bearer ${pb.authStore.token}`,
          },
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          records?: LeadRow[];
          error?: string;
        };
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Admin list failed (${res.status})`);
        }
        pbRows = (data.records || []).map((r) => {
          const q = extractQuote(r as unknown as Record<string, unknown>);
          return {
            ...r,
            ...q,
            source: "bookings_and_leads" as const,
            status: normalizeBookingStatus(r.status),
          };
        });
        usedServerApi = true;
      } catch (apiErr) {
        console.warn(
          "[BookingsManagementTable] server list failed, trying browser PB:",
          apiErr
        );
        // Avoid sort=-created — collection may lack autodate fields (PB 400).
        let records;
        try {
          records = await pb.collection("bookings_and_leads").getFullList({
            sort: "-created",
            requestKey: null,
          });
        } catch {
          records = await pb.collection("bookings_and_leads").getFullList({
            sort: "-id",
            requestKey: null,
          });
        }
        pbRows = (records as LeadRow[]).map((r) => {
          const q = extractQuote(r as unknown as Record<string, unknown>);
          return {
            ...r,
            ...q,
            source: "bookings_and_leads" as const,
            status: normalizeBookingStatus(r.status),
          };
        });
      }

      pbRows = [...pbRows].sort((a, b) => {
        const ta = a.created ? Date.parse(a.created) : 0;
        const tb = b.created ? Date.parse(b.created) : 0;
        if (tb !== ta) return tb - ta;
        return String(b.id).localeCompare(String(a.id));
      });

      // Merge local only as supplemental gaps (same-browser drafts), never as primary.
      const merged = combineAndDedupeLeads(pbRows, readLocalLeads());
      setRows(merged);
      const localOnlyCount = merged.filter((r) => r.source === "local").length;
      if (localOnlyCount > 0 && usedServerApi) {
        setError(
          `Notice: ${localOnlyCount} draft(s) only in this browser — not yet on PocketBase.`
        );
      } else {
        setError(null);
      }
    } catch (err) {
      console.warn(
        "[BookingsManagementTable] PocketBase fetch failed, using local cache:",
        err
      );
      const localOnly = combineAndDedupeLeads(
        [],
        readLocalLeads().map((r) => ({
          ...r,
          status: normalizeBookingStatus(r.status),
        }))
      );
      setRows(localOnly);
      const msg =
        err instanceof Error ? err.message : "Could not load bookings & leads.";
      if (localOnly.length > 0) {
        setError(
          `PocketBase unreachable (${msg}). Showing ${localOnly.length} local draft(s) from this browser only.`
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyStatusLocally = (row: LeadRow, next: BookingStatus) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ||
        String(r.booking_ref || "").toUpperCase() ===
          String(row.booking_ref || "").toUpperCase()
          ? { ...r, status: next }
          : r
      )
    );
    patchLocalLeadStatus(
      String(row.booking_ref || ""),
      toCollectionStatus(next),
      {
        email: row.email,
        type: (row.type as BookingLeadType) || undefined,
        primary_city: row.primary_city,
        tour_date: row.tour_date,
        guests: row.guests
          ? {
              adults: row.guests.adults ?? 0,
              kids: row.guests.kids ?? 0,
            }
          : undefined,
        duration_value: row.duration_value,
        quote_min: row.quote_min,
        quote_max: row.quote_max,
        selections: row.selections,
        id: row.id,
      }
    );
  };

  const toggleConfirmed = async (row: LeadRow) => {
    const current = normalizeBookingStatus(row.status);
    const next: BookingStatus =
      current === "confirmed" ? "in_progress" : "confirmed";
    const busyKey = row.id || String(row.booking_ref);
    setSavingId(busyKey);
    setError(null);
    try {
      if (row.source !== "local" && row.id && !row.id.startsWith("local-")) {
        const pb = getClient();
        if (!pb.authStore.token) {
          throw new Error("Admin session expired. Please sign in again.");
        }
        await pb.collection("bookings_and_leads").update(
          row.id,
          { status: toCollectionStatus(next) },
          { requestKey: null }
        );
      }
      applyStatusLocally(row, next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update lead status."
      );
    } finally {
      setSavingId(null);
    }
  };

  const downloadPdf = async (row: LeadRow) => {
    const busyKey = row.id || String(row.booking_ref);
    setPdfBusyId(busyKey);
    setError(null);
    try {
      let selections = row.selections;
      if (row.source !== "local" && row.id && !row.id.startsWith("local-")) {
        try {
          const pb = getClient();
          const fresh = await pb
            .collection("bookings_and_leads")
            .getOne(row.id, { requestKey: null });
          if (fresh?.selections && typeof fresh.selections === "object") {
            selections = fresh.selections as Record<string, unknown>;
          }
        } catch {
          /* use row snapshot */
        }
      }
      await generateDossierPdf({
        booking_ref: String(row.booking_ref || ""),
        email: row.email,
        status: row.status,
        type: String(row.type || ""),
        primary_city: row.primary_city,
        tour_date: row.tour_date,
        guests: row.guests,
        duration_value: row.duration_value,
        quote_min: row.quote_min,
        quote_max: row.quote_max,
        selections: selections || null,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate itinerary PDF."
      );
    } finally {
      setPdfBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;
      return [
        r.booking_ref,
        r.email,
        r.guest_name,
        r.primary_city,
        r.cities_list,
        r.status,
        r.type,
        r.type === "single_day" ? "builder s" : "",
        r.type === "multi_day" ? "builder m" : "",
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, q, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-white">Bookings & Leads</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Builder M / Builder S snapshots from{" "}
            <span className="font-mono text-zinc-300">bookings_and_leads</span>.
            Use Actions to mark{" "}
            <span className="text-emerald-300">confirmed</span> or download the
            dossier PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportBookingsToCSV(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
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
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[16rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by PNR, email, city, status…"
            className="w-full rounded-xl border border-[#2C2C2E] bg-[#121212] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#075473]"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "all" | "multi_day" | "single_day")
          }
          className="rounded-xl border border-[#2C2C2E] bg-[#121212] px-3 py-2.5 text-sm text-white outline-none focus:border-[#075473]"
        >
          <option value="all">All trip types</option>
          <option value="multi_day">Builder M</option>
          <option value="single_day">Builder S</option>
        </select>
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#2C2C2E] text-[0.65rem] uppercase tracking-wider text-[#075473]/80">
            <tr>
              <th className="px-4 py-3 font-semibold">PNR</th>
              <th className="px-4 py-3 font-semibold">Guest / Email</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Dates / Quote</th>
              <th className="px-4 py-3 font-semibold">Duration</th>
              <th className="px-4 py-3 font-semibold">Cities</th>
              <th className="px-4 py-3 font-semibold">Audit Info</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#075473]" />
                  Loading bookings…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-zinc-500"
                >
                  No bookings or leads found.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const status = normalizeBookingStatus(row.status);
                const pnr = String(row.booking_ref || "—").toUpperCase();
                const email = row.email || "No email";
                const guestName = resolveGuestName(row);
                const { dates, quote } = formatDatesQuote(row);
                const busyKey = row.id || String(row.booking_ref);
                const saving = savingId === busyKey;
                const pdfBusy = pdfBusyId === busyKey;
                const isConfirmed = status === "confirmed";

                return (
                  <tr
                    key={String(row.booking_ref || row.id).toUpperCase()}
                    className="border-b border-[#2C2C2E]/80 last:border-0 hover:bg-[#121212]/60"
                  >
                    <td className="px-4 py-3">
                      <span className="font-godiva text-sm font-bold uppercase tracking-wider text-[#075473]">
                        {pnr}
                      </span>
                      {row.source === "local" ? (
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-600">
                          local cache
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{guestName}</p>
                      <p className="text-xs text-zinc-400">{email}</p>
                      <p className="text-xs text-zinc-500">
                        {formatGuests(row.guests)}
                      </p>
                    </td>
                    <td className="px-4 py-3">{sourceBadge(row.type)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      <p>{dates}</p>
                      {quote ? (
                        <p className="mt-0.5 text-[#075473]">{quote}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300">
                      {resolveDuration(row)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-300">
                      {resolveCities(row)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {formatAuditInfo(row)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadgeClass(status)}`}
                      >
                        {isConfirmed
                          ? "Confirmed ✓"
                          : bookingStatusLabel(status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void toggleConfirmed(row)}
                          className={
                            isConfirmed
                              ? "inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition hover:bg-emerald-500/30 disabled:opacity-60"
                              : "inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 transition hover:border-[#075473]/50 hover:text-white disabled:opacity-60"
                          }
                          title={
                            isConfirmed
                              ? "Click to set In Progress"
                              : "Mark booking as Confirmed"
                          }
                        >
                          {saving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          {isConfirmed ? "Confirmed ✓" : "Mark Confirmed"}
                        </button>
                        <button
                          type="button"
                          disabled={pdfBusy}
                          onClick={() => void downloadPdf(row)}
                          className="inline-flex items-center gap-1 rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-60"
                          title="Download itinerary PDF"
                        >
                          {pdfBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
