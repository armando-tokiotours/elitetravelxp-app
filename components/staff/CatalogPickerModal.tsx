"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CartCatalogItem } from "@/lib/agentServices";
import {
  DEFAULT_SERVICE_CATALOG,
  loadOpsCartCatalog,
} from "@/lib/opsCartCatalog";
import type PocketBase from "pocketbase";

type CatalogFilter = "ALL" | "TOUR" | "TRANSPORT" | "TICKET";

type Props = {
  pb: PocketBase;
  onClose: () => void;
  onSelectService: (service: CartCatalogItem) => void;
};

/**
 * External catalog picker — keeps Section 3 invoice clean.
 */
export function CatalogPickerModal({ pb, onClose, onSelectService }: Props) {
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<CatalogFilter>("ALL");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<CartCatalogItem[]>(
    DEFAULT_SERVICE_CATALOG
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadOpsCartCatalog(pb)
      .then((items) => {
        if (!cancelled) {
          setCatalog(items.length > 0 ? items : DEFAULT_SERVICE_CATALOG);
        }
      })
      .catch(() => {
        if (!cancelled) setCatalog(DEFAULT_SERVICE_CATALOG);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pb]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      if (
        item.category !== "TOUR" &&
        item.category !== "TRANSPORT" &&
        item.category !== "TICKET"
      ) {
        if (filter !== "ALL") return false;
      }
      const matchesFilter =
        filter === "ALL" || item.category === filter;
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        String(item.subtitle || "")
          .toLowerCase()
          .includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [catalog, filter, search]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Service catalog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl space-y-5 rounded-3xl border border-white/20 bg-[#0A1017] p-6 text-xs text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <span className="block text-[10px] font-bold tracking-widest text-[#F6A724] uppercase">
              TokioTours service catalog
            </span>
            <h2 className="text-base font-bold uppercase">
              Select services &amp; tickets to add
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-lg font-bold text-gray-400 hover:text-white"
            aria-label="Close catalog"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search catalog by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0D141F] px-4 py-2 text-white outline-none focus:border-cyan-400"
          />
          <div className="flex flex-wrap gap-1">
            {(
              ["ALL", "TOUR", "TRANSPORT", "TICKET"] as const
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase ${
                  filter === cat
                    ? "bg-[#075473] text-white"
                    : "bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {loading ? (
            <p className="col-span-full py-8 text-center text-zinc-500">
              Loading catalog…
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="col-span-full py-8 text-center text-zinc-500">
              No matches — try another filter or search.
            </p>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0D141F] p-4 transition-all hover:border-cyan-500/50"
              >
                <div className="min-w-0">
                  <span className="block text-[9px] font-bold text-cyan-400 uppercase">
                    {item.category}
                  </span>
                  <span className="block text-xs font-bold text-white">
                    {item.title}
                  </span>
                  <span className="mt-1 block font-mono text-xs font-bold text-emerald-400">
                    €{item.priceEur}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectService(item)}
                  className="shrink-0 rounded-xl bg-[#075473] px-3.5 py-2 text-[10px] font-bold text-white uppercase hover:bg-[#075473]/80"
                >
                  + Add
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
