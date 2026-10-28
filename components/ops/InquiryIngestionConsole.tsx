"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Package,
  Zap,
} from "lucide-react";
import { parseIngestionCSV } from "@/lib/csvIngestionParser";
import { INGESTION_AI_PROMPT_INSTRUCTIONS } from "@/lib/ingestionAiPrompt";
import type { RuleAuditConflict, RuleAuditSummary } from "@/lib/ruleComplianceAuditor";
import { useTeamAuth } from "@/store/useTeamAuth";

export function InquiryIngestionConsole({
  onBookingCreated,
}: {
  onBookingCreated?: (pnr: string) => void;
}) {
  const token = useTeamAuth((s) => s.token);
  const [csvText, setCsvText] = useState("");
  const [parsedReady, setParsedReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [audit, setAudit] = useState<RuleAuditSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const authHeaders = useCallback((): HeadersInit => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const clearAudit = () => {
    setAudit(null);
    setParsedReady(false);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ""));
      setError(null);
      clearAudit();
      setMessage(`Loaded ${file.name}`);
    };
    reader.onerror = () => setError("Could not read that file");
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    e.target.value = "";
  };

  const handleCopyPrompt = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(INGESTION_AI_PROMPT_INSTRUCTIONS);
      setMessage(
        "AI ingestion prompt copied — paste into Claude with the client email (+ Master Knowledge JSON)."
      );
    } catch {
      setError("Could not copy to clipboard — select/copy manually from the tip below.");
    }
  };

  const handleExportMaster = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/export-master-knowledge", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tokiotours_master_knowledge_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Master knowledge JSON downloaded for Claude");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleRunAudit = async () => {
    if (!csvText.trim()) {
      setError("Paste or upload a CSV file first.");
      return;
    }
    setAuditing(true);
    setError(null);
    setMessage(null);
    try {
      const parsedRows = parseIngestionCSV(csvText);
      if (parsedRows.length === 0) {
        throw new Error("Invalid CSV format — no usable rows.");
      }
      const res = await fetch("/api/ops/audit-csv", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        audit?: RuleAuditSummary;
      };
      if (!res.ok || !data.ok || !data.audit) {
        throw new Error(data.error || "Audit failed");
      }
      setAudit(data.audit);
      setParsedReady(true);
      setMessage(
        `Rule check: ${data.audit.matchCount} match · ${data.audit.discrepancyCount} discrepancy · ${data.audit.customCount} custom`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
      setAudit(null);
      setParsedReady(false);
    } finally {
      setAuditing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const parsedRows = parseIngestionCSV(csvText);
      if (parsedRows.length === 0) {
        throw new Error("Invalid CSV format — no usable rows.");
      }

      const res = await fetch("/api/ops/ingest-csv", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        pnr?: string;
        pipelineLabel?: string;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Ingestion failed");
      }

      setMessage(
        `PNR ${data.pnr} created · ${data.pipelineLabel || "routed"}`
      );
      if (data.pnr && onBookingCreated) onBookingCreated(data.pnr);
      setCsvText("");
      clearAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-[#0A1017] p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">
            Agent Ingestion Console
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Give Claude the CSV template + Master Knowledge JSON, then import
            the inquiry CSV with a rule compliance check before locking the
            PNR.
          </p>
        </div>
        <div className="flex flex-wrap shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void handleCopyPrompt()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-3 py-2 text-[11px] font-bold tracking-wider text-emerald-400 uppercase transition hover:bg-emerald-600/30"
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copy AI Prompt
          </button>
          <a
            href="/api/ops/download-csv-template"
            download="tokiotours_ingestion_template.csv"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[11px] font-bold tracking-wider text-zinc-300 uppercase transition hover:bg-white/10 hover:text-white"
          >
            <FileDown className="h-3.5 w-3.5" />
            CSV Template
          </a>
          <button
            type="button"
            onClick={() => void handleExportMaster()}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#F6A724]/40 bg-[#F6A724]/15 px-3 py-2 text-[11px] font-bold tracking-wider text-[#F6A724] uppercase transition hover:bg-[#F6A724]/25 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Package className="h-3.5 w-3.5" />
            )}
            Master Knowledge (.JSON)
          </button>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) readFile(file);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? "border-[#F6A724]/60 bg-[#F6A724]/5"
            : "border-white/15 bg-black/20 hover:border-[#F6A724]/40"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileUpload}
          className="hidden"
          id="ops-csv-file-upload"
        />
        <label
          htmlFor="ops-csv-file-upload"
          className="block cursor-pointer space-y-2"
        >
          <FileSpreadsheet className="mx-auto h-7 w-7 text-[#F6A724]/80" />
          <span className="block text-xs text-zinc-300">
            Drop Claude{" "}
            <span className="font-bold text-[#F6A724]">.CSV</span> here, or
            click to browse
          </span>
        </label>
      </div>

      <p className="text-center text-[9px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
        Or paste raw CSV
      </p>

      <textarea
        value={csvText}
        onChange={(e) => {
          setCsvText(e.target.value);
          clearAudit();
        }}
        placeholder="record_type,pnr,guest_name,guest_email,pax_count,start_date,day_number,time_slot,category,item_title,price_eur,is_bonus"
        spellCheck={false}
        className="h-28 w-full rounded-lg border border-white/10 bg-black/50 p-3 font-mono text-[11px] text-emerald-400/90 outline-none placeholder:text-zinc-600 focus:border-[#F6A724]/50"
      />

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {message ? <p className="text-xs text-[#7ec8e3]">{message}</p> : null}

      {!audit ? (
        <button
          type="button"
          onClick={() => void handleRunAudit()}
          disabled={auditing || !csvText.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#F6A724] py-3 text-xs font-bold tracking-wider text-black uppercase transition hover:bg-[#e0961f] disabled:opacity-45"
        >
          {auditing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running rule compliance check…
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5" />
              Check rules &amp; preview import
            </>
          )}
        </button>
      ) : null}

      {audit ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-[10px] font-bold tracking-wider text-white uppercase">
                Rule compliance check
              </h4>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Pax {audit.paxCount}
                {audit.startDate ? ` · start ${audit.startDate}` : " · undated"}
                {audit.seasonTierLabel
                  ? ` · ${audit.seasonTierLabel}`
                  : ""}
                {audit.seasonalMultiplier !== 1
                  ? ` · season ×${audit.seasonalMultiplier.toFixed(2)}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wider">
              <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                {audit.matchCount} match
              </span>
              <span className="rounded border border-[#F6A724]/40 bg-[#F6A724]/15 px-2 py-0.5 text-[#F6A724]">
                {audit.discrepancyCount} discrepancy
              </span>
              <span className="rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-zinc-400">
                {audit.customCount} custom
              </span>
            </div>
          </div>

          <div className="max-h-56 space-y-1.5 overflow-y-auto">
            {audit.conflicts.map((conflict, idx) => (
              <AuditRow key={`${conflict.itemTitle}-${idx}`} conflict={conflict} />
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleConfirmImport()}
              disabled={loading || !parsedReady}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold tracking-wider text-white uppercase transition hover:bg-emerald-500 disabled:opacity-45"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating PNR…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accept &amp; create PNR
                </>
              )}
            </button>
            <button
              type="button"
              onClick={clearAudit}
              disabled={loading}
              className="rounded-lg border border-white/15 px-4 py-2.5 text-xs font-bold tracking-wider text-zinc-400 uppercase hover:bg-white/5 disabled:opacity-45"
            >
              Re-edit CSV
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-[10px] text-zinc-600">
        Copy AI Prompt + download Master Knowledge (.JSON). The JSON embeds the
        same ai_prompt_instructions plus live catalog rates. Paste both into
        Claude with the client email, then import the CSV here.
      </p>
    </div>
  );
}

function AuditRow({ conflict }: { conflict: RuleAuditConflict }) {
  const tone =
    conflict.status === "MATCH"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : conflict.status === "DISCREPANCY"
        ? "border-[#F6A724]/35 bg-[#F6A724]/10"
        : "border-zinc-700 bg-black/40";
  const priceTone =
    conflict.status === "MATCH"
      ? "text-emerald-400"
      : conflict.status === "DISCREPANCY"
        ? "text-[#F6A724]"
        : "text-zinc-300";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border px-2.5 py-2 text-xs ${tone}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {conflict.status === "MATCH" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#F6A724]" />
          )}
          <span className="truncate font-semibold text-white">
            {conflict.itemTitle}
          </span>
          <span className="shrink-0 text-[9px] text-zinc-500 uppercase">
            Day {conflict.dayNumber}
          </span>
        </div>
        <p className="mt-0.5 pl-5 text-[10px] text-zinc-500">
          {conflict.ruleApplied}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className={`font-mono font-bold ${priceTone}`}>
          €{conflict.importedPrice}
        </span>
        {conflict.status === "DISCREPANCY" &&
        conflict.expectedPrice != null ? (
          <span className="block text-[9px] text-zinc-400">
            System €{conflict.expectedPrice}
            {conflict.deltaEur != null
              ? ` (${conflict.deltaEur > 0 ? "+" : ""}${conflict.deltaEur})`
              : ""}
          </span>
        ) : null}
        {conflict.status === "CUSTOM_OVERRIDE" ? (
          <span className="block text-[9px] text-zinc-500">Custom override</span>
        ) : null}
      </div>
    </div>
  );
}
