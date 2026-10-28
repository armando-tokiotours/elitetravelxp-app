"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  HardDrive,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useTeamAuth } from "@/store/useTeamAuth";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import type { VpsMediaFile } from "@/lib/vpsMediaTypes";

const FOLDERS = [
  "ALL",
  "tickets",
  "vouchers",
  "comms",
  "catalog",
  "profiles",
  "general",
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MediaStorageInspector() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [files, setFiles] = useState<VpsMediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] =
    useState<(typeof FOLDERS)[number]>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileToDelete, setFileToDelete] = useState<VpsMediaFile | null>(null);
  const [batchDelete, setBatchDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const authHeaders = useCallback((): HeadersInit => {
    const token = getClient().authStore.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getClient]);

  const fetchMediaFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/media-manager", {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = (await res.json()) as {
        files?: VpsMediaFile[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setFiles(data.files || []);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch media");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void fetchMediaFiles();
  }, [fetchMediaFiles]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      if (selectedFolder !== "ALL" && f.folder !== selectedFolder) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.fileName.toLowerCase().includes(q) ||
        f.folder.toLowerCase().includes(q) ||
        f.url.toLowerCase().includes(q)
      );
    });
  }, [files, selectedFolder, searchQuery]);

  const totalStorageBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

  const confirmDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const urls = batchDelete
        ? Array.from(selected)
        : fileToDelete
          ? [fileToDelete.url]
          : [];
      if (!urls.length) return;

      const res = await fetch("/api/media-manager", {
        method: "DELETE",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          urls.length === 1 ? { fileUrl: urls[0] } : { fileUrls: urls }
        ),
      });
      const data = (await res.json()) as {
        success?: boolean;
        deleted?: string[];
        errors?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setMsg(
        `Deleted ${data.deleted?.length || 0} file(s)${
          data.errors?.length ? ` · ${data.errors.length} error(s)` : ""
        }`
      );
      setFileToDelete(null);
      setBatchDelete(false);
      await fetchMediaFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const copyUrl = async (url: string) => {
    const full =
      typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
    try {
      await navigator.clipboard.writeText(full);
      setMsg("URL copied");
    } catch {
      setError("Could not copy URL");
    }
  };

  return (
    <div className="space-y-6 p-4 text-white sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#075473]">
            VPS disk
          </p>
          <h1 className="flex items-center gap-2 font-mono text-lg font-bold">
            <HardDrive className="h-5 w-5 text-[#F6A724]" />
            Media &amp; file storage inspector
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Browse, preview, copy URLs, and delete files under{" "}
            <code className="text-zinc-300">/public/uploads</code>. PocketBase
            keeps URL pointers only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={() => {
                setBatchDelete(true);
                setFileToDelete(null);
              }}
              className="rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300"
            >
              Delete selected ({selected.size})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void fetchMediaFiles()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh scan
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0A1017] p-4">
        <BoxGradingGlow />
        <div className="relative z-10 grid grid-cols-2 gap-4 font-mono text-xs sm:grid-cols-4">
          <div>
            <span className="block text-[10px] font-bold uppercase text-zinc-500">
              Total files
            </span>
            <span className="text-base font-bold text-white">
              {files.length}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-zinc-500">
              Storage used
            </span>
            <span className="text-base font-bold text-emerald-400">
              {formatFileSize(totalStorageBytes)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-zinc-500">
              Ticket vouchers
            </span>
            <span className="text-base font-bold text-[#F6A724]">
              {files.filter((f) => f.folder === "tickets" || f.folder === "vouchers").length}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-zinc-500">
              Catalog &amp; comms
            </span>
            <span className="text-base font-bold text-sky-400">
              {
                files.filter(
                  (f) => f.folder === "catalog" || f.folder === "comms"
                ).length
              }
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FOLDERS.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setSelectedFolder(folder)}
              className={`rounded px-3 py-1 font-mono text-[11px] font-bold uppercase ${
                selectedFolder === folder
                  ? "bg-[#F6A724] text-black"
                  : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              {folder}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search filename or path…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs text-white outline-none focus:border-[#F6A724] sm:w-64"
        />
      </div>

      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Scanning disk…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredFiles.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-black/30 p-8 text-center text-xs italic text-zinc-500">
              No media files found in this category.
            </div>
          ) : (
            filteredFiles.map((file) => (
              <div
                key={file.url}
                className="flex flex-col justify-between space-y-3 rounded-xl border border-white/10 bg-[#0A1017] p-3 transition hover:border-white/25"
              >
                <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-black/60">
                  {file.isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.url}
                      alt={file.fileName}
                      className="h-full w-full object-cover"
                    />
                  ) : file.isVideo ? (
                    <video
                      src={file.url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : file.isPdf ? (
                    <div className="text-center font-mono text-[10px] font-bold uppercase text-red-400">
                      PDF
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-zinc-500">
                      FILE
                    </span>
                  )}
                  <span className="absolute left-2 top-2 rounded border border-white/20 bg-black/80 px-2 py-0.5 font-mono text-[9px] uppercase text-white">
                    {file.folder}
                  </span>
                  <label className="absolute right-2 top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-white/30 bg-black/70">
                    <input
                      type="checkbox"
                      checked={selected.has(file.url)}
                      onChange={() => toggleSelect(file.url)}
                      className="h-3 w-3 accent-[#F6A724]"
                    />
                  </label>
                </div>

                <div className="space-y-1 font-mono text-xs">
                  <span
                    className="block truncate text-[11px] font-bold text-white"
                    title={file.fileName}
                  >
                    {file.fileName}
                  </span>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>{formatFileSize(file.sizeBytes)}</span>
                    <span>
                      {new Date(file.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="truncate text-[9px] text-zinc-600" title={file.url}>
                    {file.url}
                  </p>
                </div>

                <div className="flex gap-2 border-t border-white/5 pt-2">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 bg-white/5 py-1 font-mono text-[10px] font-bold text-zinc-300 hover:bg-white/10"
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyUrl(file.url)}
                    className="rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-300 hover:bg-white/10"
                    title="Copy URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchDelete(false);
                      setFileToDelete(file);
                    }}
                    className="rounded border border-red-500/40 bg-red-500/20 px-2 py-1 text-red-400 hover:bg-red-500/30"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {(fileToDelete || batchDelete) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-red-500/40 bg-[#0A1017] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Confirm permanent deletion
            </h3>
            <p className="font-mono text-xs text-zinc-300">
              {batchDelete
                ? `Delete ${selected.size} selected file(s) from VPS disk? This cannot be undone.`
                : "Delete this file from VPS disk? Linked PocketBase records may keep a broken URL."}
            </p>
            {!batchDelete && fileToDelete ? (
              <div className="break-all rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-xs text-zinc-400">
                {fileToDelete.url}
              </div>
            ) : null}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFileToDelete(null);
                  setBatchDelete(false);
                }}
                className="flex-1 rounded border border-white/20 bg-white/5 py-2 text-xs font-bold text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={isDeleting}
                className="flex-1 rounded bg-red-600 py-2 text-xs font-bold uppercase text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
