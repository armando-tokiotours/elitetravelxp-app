"use client";

import { useEffect, useState } from "react";
import { getPocketBase } from "@/lib/pocketbase/client";
import {
  formatTransportType,
  type TransportTicketLine,
} from "@/lib/transportProducts";
import { useBuilderStore } from "@/store/useBuilderStore";

type ProductRow = {
  id: string;
  name: string;
  transport_type?: string;
  price_per_person?: number;
  duration_hours?: number;
  total_hours_note?: string;
  explainer_url?: string;
  city_id?: string;
  is_active?: boolean;
};

/**
 * Pick catalog transport tickets (Suica, Shinkansen…) — same pattern as
 * adding experiences. Lines sync to Ticketer via ops demand.
 */
export function TransportProductPicker({
  adults = 2,
}: {
  adults?: number;
}) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const selected = useBuilderStore((s) => s.selectedTransportProducts);
  const add = useBuilderStore((s) => s.addTransportProduct);
  const remove = useBuilderStore((s) => s.removeTransportProduct);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pb = getPocketBase();
        const list = await pb.collection("transport_products").getFullList({
          filter: "is_active != false",
          sort: "sort_order,name",
          requestKey: null,
        });
        if (!cancelled) setProducts(list as unknown as ProductRow[]);
      } catch {
        if (!cancelled) setProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (products.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No transport tickets in catalog yet. Add them in Source wizard →
        Transport.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
        Transport tickets
      </p>
      <ul className="space-y-2">
        {products.map((p) => {
          const on = selected.some((s) => s.productId === p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  if (on) {
                    remove(p.id);
                    return;
                  }
                  const line: TransportTicketLine = {
                    productId: p.id,
                    name: p.name,
                    transportType: String(p.transport_type || "other"),
                    pricePerPerson: Number(p.price_per_person) || 0,
                    quantity: Math.max(1, adults),
                    durationHours: Number(p.duration_hours) || undefined,
                    hoursNote: p.total_hours_note || undefined,
                    explainerUrl: p.explainer_url || undefined,
                    cityId: p.city_id || undefined,
                  };
                  add(line);
                }}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${
                  on
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white"
                    : "border-white/10 bg-black/30 text-zinc-300"
                }`}
              >
                <span>
                  <span className="font-semibold">{p.name}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">
                    {formatTransportType(String(p.transport_type || ""))}
                    {p.duration_hours ? ` · ${p.duration_hours}h` : ""}
                  </span>
                </span>
                <span className="font-mono text-xs">
                  €{Number(p.price_per_person || 0).toFixed(0)}/pp
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
