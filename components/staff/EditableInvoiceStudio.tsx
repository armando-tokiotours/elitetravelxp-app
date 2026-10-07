"use client";

import { useEffect, useMemo, useState } from "react";
import type PocketBase from "pocketbase";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import {
  FlatInvoiceBrief,
  splitInvoicePayments,
  type InvoiceRow,
} from "@/components/ops/FlatInvoiceBrief";
import { InvoiceBriefEstimateBox } from "@/components/invoice/InvoiceBriefChrome";
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
  exactPriceBand,
  exactPriceBandViolation,
  itemExceedsAgentDiscount,
  listExactPriceBandViolations,
  MAX_AGENT_DISCOUNT_PCT,
  MAX_AGENT_INCREASE_PCT,
  parseOpsHubExtras,
  sumAcceptedAgentServicesEur,
  type CartCatalogItem,
  type PriceMode,
  type ServiceLineItem,
} from "@/lib/agentServices";
import { sendBookingMessage } from "@/lib/bookingMessages";
import { DEFAULT_CONCIERGE_FEE_EUR } from "@/lib/conciergeEstimateFlow";
import { formatEur } from "@/lib/singleDayPricing";
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

/** Initial exact unit price when collapsing a range row. */
function exactUnitFromRange(item: ServiceLineItem): number {
  if (item.isBonus) return 0;
  const min = Math.max(0, Math.round(Number(item.finalPriceEur) || 0));
  const max = lineMax(item);
  if (min === max) return min;
  // Prefer max when it looks like a real quote; else mid
  if (max > min) return Math.round((min + max) / 2);
  return min;
}

function collapseItemsToExact(list: ServiceLineItem[]): ServiceLineItem[] {
  return list.map((item) => {
    if (item.isBonus) {
      return { ...item, finalPriceEur: 0, estimateMaxEur: 0 };
    }
    const exact = Math.max(0, Math.round(Number(item.finalPriceEur) || 0));
    return { ...item, finalPriceEur: exact, estimateMaxEur: exact };
  });
}

function toFlatInvoiceRow(item: ServiceLineItem): InvoiceRow {
  const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
  const minUnit = item.isBonus ? 0 : Math.max(0, Math.round(item.finalPriceEur));
  const maxUnit = item.isBonus ? 0 : lineMax(item);
  const status =
    item.approvalPending || item.status === "DECLINED"
      ? "PENDING"
      : item.status === "OPTIONAL"
        ? "OPTIONAL"
        : "ACCEPTED";
  const title = qty > 1 ? `${item.title} ×${qty}` : item.title;
  const giftUnit = Math.max(
    0,
    Math.round(Number(item.basePriceEur) || 0),
    Math.round(Number(item.finalPriceEur) || 0)
  );
  return {
    id: item.id,
    description: title,
    category: displayCategory(item.category),
    status,
    minPrice: minUnit * qty,
    maxPrice: maxUnit * qty,
    isBonus: Boolean(item.isBonus),
    listPriceEur: item.isBonus ? giftUnit * qty : undefined,
  };
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
  const [priceMode, setPriceMode] = useState<PriceMode>(() =>
    parseOpsHubExtras(row.extras).price_mode === "exact" ? "exact" : "estimate"
  );
  /** When true, Exact mode auto-fills FINAL APPROVED from accepted line sum. */
  const [dealLockManual, setDealLockManual] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bypassGuard = canBypassDiscountGuard(staffRole);
  const depositAmount = Math.max(
    0,
    Math.round(
      Number(row.concierge_fee_amount) ||
        Number(row.deposit_amount) ||
        DEFAULT_CONCIERGE_FEE_EUR
    )
  );
  const depositApplied = Boolean(row.concierge_fee_paid);
  const totalPaidTowardTour = Math.max(
    0,
    Math.round(Number(row.total_paid_eur) || 0),
    depositApplied ? depositAmount : 0
  );
  const pax = Math.max(1, paxProp || parsePax(row.guest_summary, 2));
  const leadGuest =
    String(leadGuestProp || "").trim() || parseLeadGuest(row.guest_summary);

  // row.extras (realtime): only apply when it carries cart data so an empty
  // list payload cannot wipe a successful admin-API hydrate.
  useEffect(() => {
    const extras = parseOpsHubExtras(row.extras);
    const services = extras.agent_services || [];
    if (services.length > 0) {
      setItems(services);
    }
    if (extras.final_approved_price != null) {
      setFinalApproved(String(extras.final_approved_price));
    }
    if (extras.price_mode === "exact" || extras.price_mode === "estimate") {
      setPriceMode(extras.price_mode);
    }
  }, [row.id, row.extras]);

  // Admin API is the source of truth for Pricing Studio (same path as guest).
  useEffect(() => {
    const pnr = String(row.pnr || "")
      .trim()
      .toUpperCase();
    if (!pnr) return;
    let cancelled = false;
    void fetch(`/api/bookings/agent-services?pnr=${encodeURIComponent(pnr)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          services?: ServiceLineItem[];
          finalApprovedPrice?: number | null;
          priceMode?: PriceMode;
        } | null) => {
          if (cancelled || !data) return;
          // Only adopt server cart when it has rows — empty GET must not wipe
          // a cart that was just seeded / saved via realtime extras.
          if (Array.isArray(data.services) && data.services.length > 0) {
            setItems(data.services);
          }
          if (
            data.finalApprovedPrice != null &&
            Number.isFinite(Number(data.finalApprovedPrice)) &&
            Number(data.finalApprovedPrice) > 0
          ) {
            setFinalApproved(
              String(Math.round(Number(data.finalApprovedPrice)))
            );
          }
          if (data.priceMode === "exact" || data.priceMode === "estimate") {
            setPriceMode(data.priceMode);
          }
        }
      )
      .catch(() => {
        /* keep row.extras state */
      });
    return () => {
      cancelled = true;
    };
  }, [row.pnr, row.id]);

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

  const feeCredit = depositApplied ? depositAmount : 0;
  const { amountPaid, baseDepositPaid, extraPaid } = splitInvoicePayments({
    totalPaidEur: totalPaidTowardTour,
    feeCreditEur: feeCredit,
  });
  const pendingMin = Math.max(0, subtotalMin - amountPaid);
  const pendingMax = Math.max(0, subtotalMax - amountPaid);
  const approvedLock =
    finalApproved.trim() !== "" &&
    Number.isFinite(Number(finalApproved)) &&
    Number(finalApproved) > 0
      ? Math.round(Number(finalApproved))
      : null;
  const pendingLocked =
    approvedLock != null ? Math.max(0, approvedLock - amountPaid) : null;

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
      const listForSave =
        priceMode === "exact" ? collapseItemsToExact(updatedList) : updatedList;

      if (priceMode === "exact" && !bypassGuard) {
        const violations = listExactPriceBandViolations(listForSave);
        if (violations.length > 0) {
          const names = violations
            .map((v) => v.item.title || "Untitled")
            .join("\n- ");
          const msg = `SAVE BLOCKED: Pricing rule violation\n\nYou cannot reduce a price by more than ${MAX_AGENT_DISCOUNT_PCT}% or increase it by more than ${MAX_AGENT_INCREASE_PCT}% of the catalog base.\n\nFix before saving:\n- ${names}`;
          setError(msg.replace(/\n/g, " · "));
          window.alert(msg);
          return false;
        }
      }

      let approved: number | null =
        finalApproved.trim() === ""
          ? null
          : Math.round(Number(finalApproved));
      if (priceMode === "exact") {
        const exactSum = sumAcceptedAgentServicesEur(listForSave);
        // Auto deal-lock from exact rows unless agent typed a different override
        if (!dealLockManual || !(approved != null && approved > 0)) {
          approved = exactSum > 0 ? exactSum : null;
        }
        if (approved != null && approved > 0) {
          setFinalApproved(String(approved));
        }
      }
      const res = await fetch("/api/bookings/agent-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pnr: row.pnr,
          services: listForSave,
          finalApprovedPrice: Number.isFinite(approved as number)
            ? approved
            : null,
          priceMode,
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
      const data = (await res.json()) as {
        services?: ServiceLineItem[];
        finalApprovedPrice?: number | null;
        priceMode?: PriceMode;
      };
      setItems(data.services || listForSave);
      setFinalApproved(
        data.finalApprovedPrice != null &&
          Number.isFinite(Number(data.finalApprovedPrice))
          ? String(Math.round(Number(data.finalApprovedPrice)))
          : finalApproved.trim() === ""
            ? ""
            : finalApproved
      );
      if (data.priceMode === "exact" || data.priceMode === "estimate") {
        setPriceMode(data.priceMode);
      }
      onSaved?.(data.services || listForSave);
      setNotice(
        priceMode === "exact"
          ? "Exact price saved — guest sees locked package total."
          : "Invoice brief saved — customer package synced."
      );
      return true;
    } catch {
      setError("Could not sync invoice");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const applyPriceMode = (mode: PriceMode) => {
    if (mode === priceMode) return;
    // Once Exact is locked (incl. after save/reload), cannot return to Estimate
    if (mode === "estimate" && priceMode === "exact") {
      setNotice(
        "Exact Real Price is locked for this booking — Estimate Range cannot be restored."
      );
      return;
    }
    if (mode === "exact") {
      const ok = window.confirm(
        "LOCK IN QUOTE?\n\nAre you sure you want to switch to the EXACT REAL PRICE?\n\nThis will remove the estimated ranges for the guest and present them with a firm final quote.\n\nYou cannot switch back to Estimate Range after this.\n\nDo you want to proceed?"
      );
      if (!ok) return;
    }
    setPriceMode(mode);
    if (mode === "exact") {
      setItems((prev) => {
        const next = prev.map((item) => {
          if (item.isBonus) {
            return { ...item, finalPriceEur: 0, estimateMaxEur: 0 };
          }
          const exact = exactUnitFromRange(item);
          return { ...item, finalPriceEur: exact, estimateMaxEur: exact };
        });
        const sum = sumAcceptedAgentServicesEur(next);
        if (!dealLockManual && sum > 0) {
          setFinalApproved(String(sum));
        }
        return next;
      });
      setNotice(
        "Exact Real Price locked — single € per line (−15% / +40% vs catalog). Deal lock follows the sum."
      );
    }
  };

  const handleUpdateExactPrice = (id: string, val: number) => {
    const raw = Math.max(0, Math.round(val));
    setItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== id || item.isBonus) return item;
        const base = Math.max(0, Math.round(Number(item.basePriceEur) || 0));
        const { minAllowed, maxAllowed } = exactPriceBand(base);
        let next = raw;
        // Soft-clamp while typing for non-bypass roles; UI still shows red if out of band
        if (!bypassGuard && base > 0) {
          if (next < minAllowed) next = minAllowed;
          if (next > maxAllowed) next = maxAllowed;
        }
        return {
          ...item,
          finalPriceEur: next,
          estimateMaxEur: next,
          approvalPending: base > 0 && next < minAllowed,
        };
      });
      if (!dealLockManual) {
        const sum = sumAcceptedAgentServicesEur(updated);
        if (sum > 0) setFinalApproved(String(sum));
      }
      return updated;
    });
  };

  const handleAddFromCatalog = (
    service: CartCatalogItem,
    opts?: { isBonus?: boolean }
  ) => {
    const asBonus = Boolean(opts?.isBonus);
    const added = createCustomServiceLine({
      title: service.title,
      category: service.category,
      priceEur: service.priceEur,
      estimateMaxEur: Math.round(service.priceEur * CONTINGENCY),
      isBonus: asBonus,
      addedByAgent: agentName || row.assigned_agent || "Agent",
      catalogSourceId: service.id,
      notes: asBonus
        ? "🎁 Complimentary Bonus granted by Concierge"
        : `Catalog add · ${service.subtitle || service.category}`,
    });
    setItems((prev) => {
      if (asBonus) return [...prev, added];
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
    setNotice(
      asBonus
        ? `🎁 Bonus “${service.title}” (€${service.priceEur} value) — save to sync guest invoice.`
        : `Added “${service.title}” — save to sync guest invoice.`
    );

    if (service.category === "TICKET" && !asBonus) {
      void notifyTicketer(service.title);
    }
  };

  const handleUpdateBonusValue = (id: string, val: number) => {
    const n = Math.max(0, Math.round(val));
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.isBonus
          ? { ...item, basePriceEur: n, finalPriceEur: 0, estimateMaxEur: 0 }
          : item
      )
    );
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
      {/* Sole highlight: Invoice Brief title + Estimated Package Range */}
      <InvoiceBriefEstimateBox
        pnr={row.pnr}
        guestName={leadGuest || "Guest"}
        partySize={pax}
        packageMinEur={subtotalMin}
        packageMaxEur={subtotalMax}
        finalApprovedPrice={approvedLock}
        priceMode={priceMode}
      />
      <p className="-mt-3 text-[10px] text-zinc-500">
        3. Booking cart &amp; pricing studio — edit lines directly on the
        invoice.
      </p>

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

      {/* Mobile — FlatInvoiceBrief is the only invoice box; remove rows below */}
      <div className="md:hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0E1622] px-3 py-2">
          <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Price Mode
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-white/15">
            <button
              type="button"
              disabled={priceMode === "exact"}
              onClick={
                priceMode === "exact"
                  ? undefined
                  : () => applyPriceMode("estimate")
              }
              className={`px-2 py-1 text-[10px] font-bold uppercase ${
                priceMode === "exact"
                  ? "cursor-not-allowed bg-transparent text-zinc-600 opacity-30 pointer-events-none"
                  : priceMode === "estimate"
                    ? "bg-[#075473] text-white"
                    : "text-zinc-400"
              }`}
              title={
                priceMode === "exact"
                  ? "Exact Real Price is locked — cannot return to Estimate"
                  : undefined
              }
            >
              Estimate
            </button>
            <button
              type="button"
              onClick={() => applyPriceMode("exact")}
              className={`px-2 py-1 text-[10px] font-bold uppercase ${
                priceMode === "exact"
                  ? "bg-[#F6A724]/90 text-[#0A1017]"
                  : "text-zinc-400"
              }`}
            >
              Exact
            </button>
          </div>
        </div>
        <FlatInvoiceBrief
          items={items.map(toFlatInvoiceRow)}
          depositAmount={feeCredit}
          totalPaidEur={amountPaid}
          finalApprovedPrice={approvedLock}
          priceMode={priceMode}
        />
        {items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={`edit-${item.id}`}
                className="flex items-center justify-between gap-2 px-1 py-1"
              >
                <span className="truncate text-[11px] text-zinc-400">
                  {item.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="shrink-0 px-1 text-[11px] font-bold text-gray-500 hover:text-red-400"
                  aria-label={`Remove ${item.title}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Desktop — editable table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#0B1017] md:block">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0E1622] px-4 py-2.5">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Pricing table
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Price Mode:
            </span>
            <div className="inline-flex overflow-hidden rounded-lg border border-white/15">
              <button
                type="button"
                disabled={priceMode === "exact"}
                onClick={
                  priceMode === "exact"
                    ? undefined
                    : () => applyPriceMode("estimate")
                }
                className={`px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase transition ${
                  priceMode === "exact"
                    ? "cursor-not-allowed bg-transparent text-zinc-600 opacity-30 pointer-events-none"
                    : priceMode === "estimate"
                      ? "bg-[#075473] text-white"
                      : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
                title={
                  priceMode === "exact"
                    ? "Exact Real Price is locked — cannot return to Estimate Range"
                    : undefined
                }
              >
                Estimate Range
              </button>
              <button
                type="button"
                onClick={() => applyPriceMode("exact")}
                className={`px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase transition ${
                  priceMode === "exact"
                    ? "bg-[#F6A724]/90 text-[#0A1017]"
                    : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                Exact Real Price
              </button>
            </div>
          </div>
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-[#0E1622]/80 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              <th className="px-4 py-3">Service description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Agreed status</th>
              <th className="px-4 py-3 text-right">
                {priceMode === "exact"
                  ? "Exact price (€)"
                  : "Estimated subtotal (€)"}
              </th>
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
                const band = exactPriceBandViolation(item);
                const isTooLow = Boolean(band?.tooLow);
                const isTooHigh = Boolean(band?.tooHigh);
                const bandInvalid = isTooLow || isTooHigh;
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
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded border border-[#F6A724]/40 bg-[#F6A724]/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#F6A724] uppercase">
                          🎁 Bonus Gift
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
                      ) : item.status === "OPTIONAL" ? (
                        <span className="rounded-lg border border-white/10 bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-gray-400">
                          OPTIONAL
                        </span>
                      ) : (
                        <span className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-300">
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
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[9px] font-bold text-[#F6A724]">
                              Value €
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={item.basePriceEur}
                              onChange={(e) =>
                                handleUpdateBonusValue(
                                  item.id,
                                  Number(e.target.value)
                                )
                              }
                              className="w-20 rounded border border-[#F6A724]/40 bg-[#0E1622] px-1.5 py-0.5 text-right font-mono text-xs text-[#F6A724]"
                            />
                          </div>
                          <span className="text-[9px] font-bold text-[#F6A724]">
                            FREE · not billed
                          </span>
                        </div>
                      ) : priceMode === "exact" ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center justify-end gap-1.5">
                            €
                            <input
                              type="number"
                              min={0}
                              value={item.finalPriceEur}
                              onChange={(e) =>
                                handleUpdateExactPrice(
                                  item.id,
                                  Number(e.target.value)
                                )
                              }
                              className={`w-20 rounded border bg-[#0E1622] px-1.5 py-0.5 text-right font-mono text-xs ${
                                bandInvalid
                                  ? "border-red-500 text-red-400"
                                  : exceeds
                                    ? "border-red-500 text-[#F6A724]"
                                    : "border-[#F6A724]/40 text-[#F6A724]"
                              }`}
                            />
                          </div>
                          {isTooLow ? (
                            <span className="text-[9px] font-bold text-red-400">
                              &gt;{MAX_AGENT_DISCOUNT_PCT}% reduction blocked
                            </span>
                          ) : null}
                          {isTooHigh ? (
                            <span className="text-[9px] font-bold text-red-400">
                              &gt;{MAX_AGENT_INCREASE_PCT}% increase blocked
                            </span>
                          ) : null}
                          {!bandInvalid && item.basePriceEur > 0 ? (
                            <span className="text-[8px] text-zinc-600">
                              Base €{Math.round(item.basePriceEur)} · band €
                              {exactPriceBand(item.basePriceEur).minAllowed}–
                              {exactPriceBand(item.basePriceEur).maxAllowed}
                            </span>
                          ) : null}
                        </div>
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

      {/* Footer — deal lock + desktop totals */}
      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <label className="block text-[10px] font-bold text-gray-400 uppercase">
            Final approved package (€)
            {priceMode === "exact"
              ? " — exact deal lock"
              : " — optional deal lock"}
          </label>
          <input
            type="number"
            min={0}
            value={finalApproved}
            onChange={(e) => {
              setDealLockManual(true);
              setFinalApproved(e.target.value);
            }}
            placeholder={
              priceMode === "exact"
                ? "Auto from exact line sum"
                : "Leave blank for estimate range"
            }
            className="w-full max-w-xs rounded-lg border border-white/10 bg-[#0A1017] px-3 py-2 font-mono text-white"
          />
          {priceMode === "exact" ? (
            <span className="text-[10px] text-zinc-500">
              Prefills from accepted exact lines. Exact mode is locked — prices
              must stay within −{MAX_AGENT_DISCOUNT_PCT}% / +
              {MAX_AGENT_INCREASE_PCT}% of catalog base
              {bypassGuard ? " (Ops may override)" : ""}.
            </span>
          ) : bypassGuard ? (
            <span className="text-[9px] font-bold text-cyan-300 uppercase">
              Ops override enabled
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500">
              Agents: max {MAX_AGENT_DISCOUNT_PCT}% off without Ops approval
            </span>
          )}
        </div>

        <div className="hidden w-full space-y-3 border-t border-white/10 pt-4 sm:w-96 md:block">
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>
              {approvedLock != null
                ? "Final Approved Package"
                : "Itemized estimate subtotal"}
            </span>
            <span className="font-mono font-bold">
              {approvedLock != null
                ? formatEur(approvedLock)
                : `${formatEur(subtotalMin)} ~ ${formatEur(subtotalMax)}`}
            </span>
          </div>
          {baseDepositPaid > 0 ? (
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span>
                Concierge Deposit
                <span className="block text-[10px] text-gray-400">
                  (100% credited)
                </span>
              </span>
              <span className="font-mono font-bold">
                −{formatEur(baseDepositPaid)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span>
                Concierge Deposit
                <span className="block text-[10px] text-gray-400">
                  (credited when fee paid)
                </span>
              </span>
              <span className="font-mono font-bold">{formatEur(0)}</span>
            </div>
          )}
          {extraPaid > 0 ? (
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span>
                30% Milestone Payment
                <span className="block text-[10px] text-gray-400">
                  (Installment received)
                </span>
              </span>
              <span className="font-mono font-bold">
                −{formatEur(extraPaid)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between pt-1 text-sm font-bold text-[#F6A724]">
            <span>Pending balance due</span>
            <span className="font-mono text-base">
              {pendingLocked != null
                ? formatEur(pendingLocked)
                : `${formatEur(pendingMin)} ~ ${formatEur(pendingMax)}`}
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
