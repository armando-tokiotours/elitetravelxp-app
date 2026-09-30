"use client";

import { useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";

export function TourCompletionReportForm({
  pb,
  pnr,
  assignmentId,
  onSaved,
}: {
  pb: PocketBase;
  pnr: string;
  assignmentId: string;
  onSaved?: () => void;
}) {
  const [hours, setHours] = useState("8");
  const [expenses, setExpenses] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState("5");
  const [files, setFiles] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("assignment", assignmentId);
      fd.append("pnr", pnr);
      fd.append("actual_hours_worked", String(Number(hours) || 0));
      fd.append("actual_expenses_jpy", String(Number(expenses) || 0));
      fd.append("guide_tour_notes", notes.trim());
      fd.append("client_rating", String(Number(rating) || 5));
      fd.append("is_verified_by_admin", "false");
      fd.append("extra_hours_approved", "false");
      if (files) {
        for (let i = 0; i < files.length; i++) {
          fd.append("receipts", files[i]);
        }
      }
      await pb.collection("tour_completion_reports").create(fd, {
        requestKey: null,
      });
      setMsg("Completion report submitted.");
      onSaved?.();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-black/30 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Post-tour report
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-[10px] uppercase text-zinc-500">
          Actual hours
          <input
            type="number"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </label>
        <label className="text-[10px] uppercase text-zinc-500">
          Expenses JPY
          <input
            type="number"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={expenses}
            onChange={(e) => setExpenses(e.target.value)}
          />
        </label>
        <label className="text-[10px] uppercase text-zinc-500">
          Client rating
          <input
            type="number"
            min={1}
            max={5}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </label>
        <label className="text-[10px] uppercase text-zinc-500">
          Receipts
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="mt-1 block w-full text-[10px] text-zinc-400"
            onChange={(e) => setFiles(e.target.files)}
          />
        </label>
        <label className="text-[10px] uppercase text-zinc-500 sm:col-span-2">
          Notes
          <textarea
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-2 rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] text-zinc-200 disabled:opacity-40"
      >
        {saving ? "Submitting…" : "Submit report"}
      </button>
      {msg ? <p className="mt-1 text-[11px] text-emerald-400">{msg}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}
