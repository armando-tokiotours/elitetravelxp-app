"use client";

import { useEffect, useMemo, useState } from "react";
import type PocketBase from "pocketbase";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import { CatalogPickerModal } from "@/components/staff/CatalogPickerModal";
import {
  NewCustomExperienceWizard,
  type CustomExperienceWizardPayload,
} from "@/components/staff/NewCustomExperienceWizard";
import {
  canBypassDiscountGuard,
  cartBillableTotals,
  categoryLabel,
  createCustomServiceLine,
  itemExceedsAgentDiscount,
  MAX_AGENT_DISCOUNT_PCT,
  parseOpsHubExtras,
  type CartCatalogItem,
  type ServiceLineItem,
} from "@/lib/agentServices";
import { sendBookingMessage } from "@/lib/bookingMessages";
import type { StaffRole } from "@/lib/staffRoles";

const CONTINGENCY = 1.3;

type Props = {
  pb: PocketBase;
  row: OpsHubRow;
  agentName?: string | null;
  staffId?: string | null;
  staffRole?: StaffRole | null;
  guestBaseTotalEur?: number;
  leadGuest?: string | null;
  paxCount?: number;
  onSaved?: (services: ServiceLineItem[]) => void;
};

function displayCategory(cat: string): string {
  switch (String(cat || "").toUpperCase()) {
    case "TOUR":
      return "TOURS";
    case "TRANSPORT":
      return "TRANSIT";
    case "TICKET":
      return "TICKET / EXTRA";
    case "CONCIERGE_EXTRA":
      return "ADDON";
    default:
      return categoryLabel(cat).toUpperCase();
  }
}

function parseLeadGuest(summary?: string | null): string {
  const s = String(summary || "").trim();
  if (!s) return "Valued Guest";
  return s.split(/[·|•]/)[0]?.trim() || "Valued Guest";
}

function parsePax(summary?: string | null, fallback = 2): number {
  const s = String(summary || "");
  const m =
    s.match(/(\d+)\s*(?:guests?|pax)/i) ||
    s.match(/(\d+)\s*A/i) ||
    s.match(/\b(\d+)\b/);
  const n = m ? Number(m[1]) : fallback;
  return Number.isFinite(n) && n > 0 ? Math.min(99, Math.round(n)) : fallback;
}

function lineMax(item: ServiceLineItem): number {
  if (item.isBonus) return 0;
  const stored = Number(item.estimateMaxEur);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return Math.round(Math.max(0, item.finalPriceEur) * CONTINGENCY);
}

/**
 * Section 3 — Invoice Brief editor + catalog modal (no permanent grid clutter).
 */
export function EditableInvoiceStudio({
  pb,
  row,
  agentName,
  staffId,
  staffRole,
  guestBaseTotalEur = 0,
  leadGuest: leadGuestProp,
  paxCount: paxProp,
  onSaved,
}: Props) {
  const [items, setItems] = useState<ServiceLineItem[]>(
    () => parseOpsHubExtras(row.extras).agent_services || []
  );
  const [finalApproved, setFinalApproved] = useState<string>(() => {
    const v = parseOpsHubExtras(row.extras).final_approved_price;
    return v != null ? String(v) : "";
  });
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bypassGuard = canBypassDiscountGuard(staffRole);
  const depositAmount = Math.max(
    0,
    Math.round(
      Number(row.concierge_fee_amount) || Number(row.deposit_amount) || 60
    )
  );
  const depositApplied = Boolean(row.concierge_fee_paid);
  const pax = Math.max(1, paxProp || parsePax(row.guest_summary, 2));
  const leadGuest =
    String(leadGuestProp || "").trim() || parseLeadGuest(row.guest_summary);

  useEffect(() => {
    const extras = parseOpsHubExtras(row.extras);
    setItems(extras.agent_services || []);
    setFinalApproved(
      extras.final_approved_price != null
        ? String(extras.final_approved_price)
        : ""
    );
  }, [row.id, row.extras]);

  const accepted = useMemo(
    () => items.filter((i) => i.status === "ACCEPTED"),
    [items]
  );

  const subtotalMin = useMemo(
    () =>
      accepted.reduce((sum, item) => {
        if (item.isBonus) return sum;
        const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
        return sum + Math.max(0, Math.round(item.finalPriceEur)) * qty;
      }, 0),
    [accepted]
  );

  const subtotalMax = useMemo(
    () =>
      accepted.reduce((sum, item) => {
        if (item.isBonus) return sum;
        const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
        return sum + lineMax(item) * qty;
      }, 0),
    [accepted]
  );

  const depositCredit = depositApplied ? depositAmount : 0;
  const pendingMin = Math.max(0, subtotalMin - depositCredit);
  const pendingMax = Math.max(0, subtotalMax - depositCredit);

  const totals = useMemo(() => cartBillableTotals(items), [items]);
  const requiresOpsApproval = totals.requiresOpsApproval && !bypassGuard;

  const notifyTicketer = async (ticketTitle: string) => {
    try {
      await fetch("/api/ops/notify-ticketer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr: row.pnr,
          ticketTitle,
          opsHubId: row.id,
        }),
      });
    } catch {
      /* non-blocking */
    }
  };

  const saveCart = async (updatedList: ServiceLineItem[]) => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const approved =
        finalApproved.trim() === ""
          ? null
          : Math.round(Number(finalApproved));
      const res = await fetch("/api/bookings/agent-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr: row.pnr,
          services: updatedList,
          finalApprovedPrice: Number.isFinite(approved as number)
            ? approved
            : null,
          agentName: agentName || row.assigned_agent || "Ops Agent",
          guestBaseTotalEur,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error || "Could not sync invoice");
        return false;
      }
      const data = (await res.json()) as { services?: ServiceLineItem[] };
      setItems(data.services || updatedList);
      onSaved?.(data.services || updatedList);
      setNotice("Invoice brief saved — customer package synced.");
      return true;
    } catch {
      setError("Could not sync invoice");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFromCatalog = (service: CartCatalogItem) => {
    const added = createCustomServiceLine({
      title: service.title,
      category: service.category,
      priceEur: service.priceEur,
      estimateMaxEur: Math.round(service.priceEur * CONTINGENCY),
      addedByAgent: agentName || row.assigned_agent || "Agent",
      catalogSourceId: service.id,
      notes: `Catalog add · ${service.subtitle || service.category}`,
    });
    setItems((prev) => {
      const existing = prev.find(
        (i) =>
          !i.isBonus &&
          ((i.catalogSourceId && i.catalogSourceId === service.id) ||
            i.title.trim().toLowerCase() === service.title.trim().toLowerCase())
      );
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id
            ? {
                ...i,
                quantity: Math.max(1, Math.round(Number(i.quantity) || 1)) + 1,
              }
            : i
        );
      }
      return [...prev, added];
    });
    setIsCatalogOpen(false);
    setNotice(`Added “${service.title}” — save to sync guest invoice.`);

    if (service.category === "TICKET") {
      void notifyTicketer(service.title);
    }
  };

  const handleUpdateTitle = (id: string, title: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, title } : i))
    );
  };

  const handleUpdatePrice = (
    id: string,
    field: "minPrice" | "maxPrice",
    val: number
  ) => {
    const n = Math.max(0, Math.round(val));
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.isBonus) return item;

        if (field === "maxPrice") {
          return {
            ...item,
            estimateMaxEur: Math.max(n, Math.round(item.finalPriceEur)),
          };
        }

        let next = n;
        const floor = Math.round(
          item.basePriceEur * (1 - MAX_AGENT_DISCOUNT_PCT / 100)
        );
        if (!bypassGuard && item.basePriceEur > 0 && next < floor) {
          next = floor;
          setNotice(
            `⚠️ Agents max ${MAX_AGENT_DISCOUNT_PCT}% off (floor €${floor}).`
          );
        }
        const max = Math.max(next, lineMax({ ...item, finalPriceEur: next }));
        return {
          ...item,
          finalPriceEur: next,
          estimateMaxEur: max,
          approvalPending:
            item.basePriceEur > 0 &&
            next < item.basePriceEur * (1 - MAX_AGENT_DISCOUNT_PCT / 100),
        };
      })
    );
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const postOpsMessage = async (text: string) => {
    await sendBookingMessage(pb, {
      pnr: row.pnr,
      opsHubId: row.id,
      channel: "OPS",
      senderId: staffId,
      senderName: agentName || "Concierge Agent",
      senderRole: bypassGuard ? "OPS_COORDINATOR" : "CONCIERGE",
      message: text,
    });
  };

  const handleWizardRequest = async (
    payload: CustomExperienceWizardPayload
  ) => {
    await postOpsMessage(
      [
        `🆕 NEW CUSTOM EXPERIENCE REQUEST · ${payload.pnr}`,
        `From: ${agentName || "Concierge Agent"}`,
        `Title: ${payload.title}`,
        `Category: ${payload.category}`,
        `Proposed price: €${payload.proposedPriceEur}`,
        payload.description
          ? `Details:\n${payload.description}`
          : "No vendor details provided.",
      ].join("\n")
    );
    setNotice("Custom experience request sent to Ops Manager (OPS channel).");
  };

  const handleSave = async () => {
    if (requiresOpsApproval) {
      setError(
        `Discount exceeds ${MAX_AGENT_DISCOUNT_PCT}% — ask Ops Manager to save, or raise prices.`
      );
      return;
    }
    await saveCart(items);
  };

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-[#070C12] p-5 text-xs text-white sm:p-6">
      {/* Header — Invoice Brief */}
      <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start">
        <div>
          <span className="block text-[10px] font-bold tracking-widest text-[#F6A724] uppercase">
            Official estimated quotation
          </span>
          <h1 className="text-xl font-black tracking-wider text-white uppercase sm:text-2xl">
            Invoice brief · {row.pnr}
          </h1>
          <p className="mt-0.5 text-xs text-gray-400">
            Prepared for{" "}
            <strong className="text-white">{leadGuest}</strong> ({pax} Guest
            {pax === 1 ? "" : "s"})
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            3. Booking cart &amp; pricing studio — edit lines directly on the
            invoice.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0E1622] px-5 py-3 text-right">
          <span className="block text-[9px] font-bold tracking-widest text-gray-400 uppercase">
            Estimated package range
          </span>
          <span className="font-mono text-xl font-bold text-[#F6A724]">
            €{subtotalMin} ~ €{subtotalMax}
          </span>
          <span className="block font-mono text-[10px] text-gray-500">
            (€{Math.round(subtotalMin / pax)} ~ €{Math.round(subtotalMax / pax)}{" "}
            / person)
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0D141F] p-3">
        <span className="text-[11px] font-medium text-gray-300">
          Modify line items below or add catalog options.
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="rounded-xl border border-purple-500/40 bg-purple-600/30 px-3 py-2 text-[10px] font-bold tracking-wider text-purple-200 uppercase hover:bg-purple-600/50"
          >
            + Custom wizard
          </button>
          <button
            type="button"
            onClick={() => setIsCatalogOpen(true)}
            className="rounded-xl border border-cyan-400/30 bg-[#075473] px-4 py-2 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition hover:bg-[#075473]/80"
          >
            + Add services &amp; tickets
          </button>
        </div>
      </div>

      {/* Editable table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B1017]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-[#0E1622] text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              <th className="px-4 py-3">Service description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Agreed status</th>
              <th className="px-4 py-3 text-right">Estimated subtotal (€)</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[11px] text-zinc-500"
                >
                  No line items yet — click{" "}
                  <strong className="text-zinc-300">
                    + Add services &amp; tickets
                  </strong>{" "}
                  to build the package.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const exceeds = itemExceedsAgentDiscount(item);
                return (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-white/5"
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) =>
                          handleUpdateTitle(item.id, e.target.value)
                        }
                        className="w-full border-b border-transparent bg-transparent font-bold text-white outline-none hover:border-white/20 focus:border-cyan-400"
                      />
                      {item.isBonus ? (
                        <span className="mt-1 inline-block rounded border border-purple-500/40 bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold text-purple-300">
                          🎁 COMPLIMENTARY BONUS
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-gray-400 uppercase">
                      {displayCategory(item.category)}
                    </td>
                    <td className="px-4 py-3.5">
                      {item.status === "ACCEPTED" ? (
                        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                          ACCEPTED ✓
                        </span>
                      ) : (
                        <span className="rounded-lg border border-white/10 bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-gray-400">
                          {item.status}
                        </span>
                      )}
                      {exceeds ? (
                        <span className="mt-1 block text-[9px] font-bold text-red-300">
                          &gt;{MAX_AGENT_DISCOUNT_PCT}% needs Ops
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold">
                      {item.isBonus ? (
                        <span className="text-purple-300">€0 (Included)</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          €
                          <input
                            type="number"
                            min={0}
                            value={item.finalPriceEur}
                            onChange={(e) =>
                              handleUpdatePrice(
                                item.id,
                                "minPrice",
                                Number(e.target.value)
                              )
                            }
                            className={`w-16 rounded border bg-[#0E1622] px-1.5 py-0.5 text-right font-mono text-xs text-emerald-400 ${
                              exceeds
                                ? "border-red-500"
                                : "border-white/10"
                            }`}
                          />
                          <span className="text-zinc-500">~ €</span>
                          <input
                            type="number"
                            min={0}
                            value={lineMax(item)}
                            onChange={(e) =>
                              handleUpdatePrice(
                                item.id,
                                "maxPrice",
                                Number(e.target.value)
                              )
                            }
                            className="w-16 rounded border border-white/10 bg-[#0E1622] px-1.5 py-0.5 text-right font-mono text-xs text-emerald-400"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="px-1 font-bold text-gray-500 hover:text-red-400"
                        aria-label={`Remove ${item.title}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer totals */}
      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <label className="block text-[10px] font-bold text-gray-400 uppercase">
            Final approved package (€) — optional deal lock
          </label>
          <input
            type="number"
            min={0}
            value={finalApproved}
            onChange={(e) => setFinalApproved(e.target.value)}
            placeholder="Leave blank for estimate range"
            className="w-full max-w-xs rounded-lg border border-white/10 bg-[#0A1017] px-3 py-2 font-mono text-white"
          />
          {bypassGuard ? (
            <span className="text-[9px] font-bold text-cyan-300 uppercase">
              Ops override enabled
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500">
              Agents: max {MAX_AGENT_DISCOUNT_PCT}% off without Ops approval
            </span>
          )}
        </div>

        <div className="w-full space-y-3 rounded-2xl border border-white/10 bg-[#0E1622] p-5 sm:w-96">
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>Itemized estimate subtotal</span>
            <span className="font-mono font-bold">
              €{subtotalMin} ~ €{subtotalMax}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs text-emerald-400">
            <span>
              Deposit
              <span className="block text-[10px] text-gray-400">
                {depositApplied
                  ? "(100% credited)"
                  : "(credited when fee paid)"}
              </span>
            </span>
            <span className="font-mono font-bold">
              {depositApplied ? `−€${depositAmount}` : "€0"}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 text-sm font-bold text-[#F6A724]">
            <span>Pending balance due</span>
            <span className="font-mono text-base">
              €{pendingMin} ~ €{pendingMax}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={isSaving || requiresOpsApproval}
        onClick={() => void handleSave()}
        className="w-full rounded-xl bg-[#075473] py-3.5 text-xs font-bold tracking-wider text-white uppercase shadow-xl transition hover:bg-[#075473]/80 active:scale-[0.98] disabled:opacity-40"
      >
        {isSaving
          ? "Saving invoice…"
          : requiresOpsApproval
            ? `Locked — discount >${MAX_AGENT_DISCOUNT_PCT}%`
            : "Save cart & update customer booking →"}
      </button>

      {notice ? (
        <p className="text-[11px] text-emerald-400">{notice}</p>
      ) : null}
      {error ? <p className="text-[11px] text-red-400">{error}</p> : null}

      {isCatalogOpen ? (
        <CatalogPickerModal
          pb={pb}
          onClose={() => setIsCatalogOpen(false)}
          onSelectService={handleAddFromCatalog}
        />
      ) : null}

      {isWizardOpen ? (
        <NewCustomExperienceWizard
          pnr={row.pnr}
          onClose={() => setIsWizardOpen(false)}
          onRequestApproval={handleWizardRequest}
        />
      ) : null}
    </div>
  );
}

/** Back-compat alias for BookingStatusTab imports */
export { EditableInvoiceStudio as AgentServicesConsole };
export { EditableInvoiceStudio as CartPricingStudio };
