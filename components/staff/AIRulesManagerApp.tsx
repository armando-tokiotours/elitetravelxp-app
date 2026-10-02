"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

type DocRow = {
  id: string;
  title: string;
  category: string;
  is_active: boolean;
  uploaded_by?: string | null;
  updated?: string | null;
  has_text?: boolean;
  text_preview?: string;
};

const CATEGORIES = [
  { value: "PRICING", label: "Pricing & Discount Rules" },
  { value: "TRANSIT", label: "Transit & Suica Policies" },
  { value: "DISPATCH", label: "Guide & Driver Workload Rules" },
  { value: "GENERAL_SOP", label: "General Operations SOP" },
] as const;

export function AIRulesManagerApp() {
  return (
    <StaffPortalShell
      title="AI Knowledge & Rules"
      allow={canAccessOpsBoard}
      wide
    >
      <AIRulesManagerInner />
    </StaffPortalShell>
  );
}

function AIRulesManagerInner() {
  const email = useTeamAuth((s) => s.email);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("GENERAL_SOP");
  const [isUploading, setIsUploading] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/ai-knowledge");
      const data = (await res.json().catch(() => ({}))) as {
        docs?: DocRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not load knowledge docs");
        return;
      }
      setDocs(data.docs || []);
    } catch {
      setError("Could not load knowledge docs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const handleUploadSOP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setIsUploading(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("category", category);
      formData.append("document_file", file);
      if (email) formData.append("uploaded_by", email);

      const res = await fetch("/api/ops/ai-knowledge/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setNotice("✅ SOP document uploaded to Gemini knowledge base.");
      setTitle("");
      setFile(null);
      await loadDocs();
    } catch {
      setError("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleActive = async (id: string, next: boolean) => {
    setError(null);
    try {
      const res = await fetch("/api/ops/ai-knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not update");
        return;
      }
      await loadDocs();
    } catch {
      setError("Could not update");
    }
  };

  const removeDoc = async (id: string) => {
    if (!window.confirm("Delete this knowledge document?")) return;
    setError(null);
    try {
      const res = await fetch("/api/ops/ai-knowledge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Could not delete");
        return;
      }
      await loadDocs();
    } catch {
      setError("Could not delete");
    }
  };

  return (
    <div className="space-y-6 text-xs text-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="min-w-0 max-w-2xl">
          <span className="block text-[10px] font-bold tracking-widest text-[#F6A724] uppercase">
            AI Knowledge & Operating System
          </span>
          <h1 className="text-xl font-bold uppercase">
            System Rules & Document Upload Studio
          </h1>
          <p className="mt-1 text-[11px] text-gray-400">
            Upload pricing sheets, transit rules, and SOP documents (.pdf, .txt,
            .md). Gemini Assist reads active files when staff ask questions, and
            can use Google Search for live Tokyo info.
          </p>
        </div>
        <Link
          href="/staff/logic-dictionary"
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Logic dictionary →
        </Link>
      </div>

      <form
        onSubmit={(e) => void handleUploadSOP(e)}
        className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-[#0A1017] p-6 shadow-xl"
      >
        <div>
          <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
            Document title *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 2026_Pricing_And_Discount_SOP"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
            Rule category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-white outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
            Upload document (.pdf, .txt, .md) *
          </label>
          <input
            type="file"
            required
            accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1117] p-2 text-[11px] text-gray-300"
          />
          {file ? (
            <p className="mt-1 text-[10px] text-zinc-500">
              Selected: {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isUploading || !file || !title.trim()}
          className="w-full rounded-xl bg-[#075473] py-3.5 text-xs font-bold text-white uppercase shadow-lg transition hover:bg-[#075473]/80 active:scale-[0.98] disabled:opacity-40"
        >
          {isUploading
            ? "Extracting & indexing file…"
            : "📤 Upload document to AI engine →"}
        </button>
      </form>

      {notice ? (
        <p className="text-[11px] text-emerald-400">{notice}</p>
      ) : null}
      {error ? <p className="text-[11px] text-red-400">{error}</p> : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Indexed knowledge documents ({docs.length})
          </span>
          <button
            type="button"
            onClick={() => void loadDocs()}
            className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-bold text-zinc-300 uppercase hover:text-white"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-[11px] text-zinc-500">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-zinc-500">
            No documents yet. Upload an SOP above — also see{" "}
            <code className="text-zinc-400">docs/sops/*.md</code> in the repo as
            starter content.
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#0A1017] p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-bold text-cyan-400 uppercase">
                      {d.category}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        d.is_active
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {d.is_active ? "Active" : "Off"}
                    </span>
                    {!d.has_text ? (
                      <span className="text-[9px] text-amber-400">
                        Limited text extract
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs font-bold text-white">{d.title}</p>
                  {d.text_preview ? (
                    <p className="line-clamp-2 text-[10px] text-zinc-500">
                      {d.text_preview}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(d.id, !d.is_active)}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold text-zinc-300 uppercase hover:text-white"
                  >
                    {d.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeDoc(d.id)}
                    className="rounded-lg border border-red-500/30 px-2.5 py-1 text-[10px] font-bold text-red-300 uppercase hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
