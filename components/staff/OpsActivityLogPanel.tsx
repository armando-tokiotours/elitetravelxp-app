"use client";

import { useCallback, useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import {
  appendBookingLog,
  bookingLogActionLabel,
  bookingLogActionStyle,
  formatRelativeLogTime,
  isoDateOnly,
  loadBookingLogsForPnr,
  type BookingLogRow,
} from "@/lib/bookingLogs";

export function OpsActivityLogPanel({
  pb,
  pnr,
  opsHubId,
  staffId,
  staffName,
}: {
  pb: PocketBase;
  pnr: string;
  opsHubId: string;
  staffId: string | null;
  staffName: string;
}) {
  const [logs, setLogs] = useState<BookingLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await loadBookingLogsForPnr(pb, pnr));
    } catch {
      setError("Could not load activity log.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [pb, pnr]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live timeline when other staff post notes / open the file
  useEffect(() => {
    const ref = String(pnr || "")
      .trim()
      .toUpperCase()
      .replace(/"/g, "");
    if (!ref) return;
    let unsub: (() => void) | undefined;
    void pb
      .collection("booking_logs")
      .subscribe("*", (e) => {
        const record = e.record as unknown as BookingLogRow;
        if (String(record?.pnr || "").toUpperCase() !== ref) return;
        if (e.action === "create") {
          setLogs((prev) => {
            if (prev.some((l) => l.id === record.id)) return prev;
            return [record, ...prev];
          });
        } else if (e.action === "update") {
          setLogs((prev) =>
            prev.map((l) => (l.id === record.id ? { ...l, ...record } : l))
          );
        } else if (e.action === "delete") {
          setLogs((prev) => prev.filter((l) => l.id !== record.id));
        }
      })
      .then((u) => {
        unsub = u;
      })
      .catch(() => {
        /* realtime optional */
      });
    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
      void pb.collection("booking_logs").unsubscribe("*").catch(() => {});
    };
  }, [pb, pnr]);

  const postNote = async () => {
    const text = note.trim();
    if (!text || posting) return;
    setPosting(true);
    setError(null);
    const optimistic: BookingLogRow = {
      id: `tmp-${Date.now()}`,
      pnr: String(pnr).toUpperCase(),
      ops_hub_id: opsHubId,
      staff_id: staffId || "",
      staff_name: staffName,
      action_type: "note_added",
      details: text,
      created: new Date().toISOString(),
    };
    setLogs((prev) => [optimistic, ...prev]);
    setNote("");
    try {
      const saved = await appendBookingLog(pb, {
        pnr,
        opsHubId,
        staffId,
        staffName,
        actionType: "note_added",
        details: text,
      });
      if (saved) {
        setLogs((prev) =>
          prev.map((l) => (l.id === optimistic.id ? saved : l))
        );
        // Touch hub so last-action stays visible in inbox
        try {
          await pb.collection("ops_hub").update(
            opsHubId,
            {
              last_action_by: staffId || "",
              last_action_date: isoDateOnly(),
            },
            { requestKey: null }
          );
        } catch {
          /* non-blocking */
        }
      } else {
        setLogs((prev) => prev.filter((l) => l.id !== optimistic.id));
        setNote(text);
        setError("Failed to save note.");
      }
    } catch {
      setLogs((prev) => prev.filter((l) => l.id !== optimistic.id));
      setNote(text);
      setError("Failed to save note.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="shrink-0 space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
        <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          Add staff note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Spoke to client on WhatsApp — need 2 days to think about budget"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder:text-zinc-600"
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-zinc-600">
            Notes are visible to all ops staff on this PNR.
          </p>
          <button
            type="button"
            disabled={posting || !note.trim()}
            onClick={() => void postNote()}
            className="rounded-lg bg-[#075473] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            {posting ? "Posting…" : "Post note"}
          </button>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500">Loading activity…</p>
      ) : logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500">
          No activity yet — open events and notes will appear here.
        </p>
      ) : (
        <ol className="relative ml-2 space-y-0 border-l border-zinc-700 pl-4">
          {logs.map((log) => (
            <li key={log.id} className="relative pb-5 last:pb-0">
              <span
                className="absolute top-1.5 -left-[1.3rem] h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-[#075473]"
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${bookingLogActionStyle(
                    String(log.action_type)
                  )}`}
                >
                  {bookingLogActionLabel(String(log.action_type))}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {formatRelativeLogTime(log.created)}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-zinc-300">
                {log.staff_name || "Staff"}
              </p>
              {log.details ? (
                <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                  {log.details}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
