import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  mergeExtrasPatch,
  normalizeServiceLineItem,
  parseOpsHubExtras,
  preserveVoucherFieldsOnReplace,
  sumAcceptedAgentServicesEur,
  type PriceMode,
  type ServiceLineItem,
} from "@/lib/agentServices";

function normalizePnr(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

/**
 * GET /api/bookings/agent-services?pnr=
 * Guest + ops hydrate of agent custom lines / bonuses / approved price.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = normalizePnr(
      searchParams.get("pnr") || searchParams.get("bookingRef")
    );
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }

    const pb = await getAdminPocketBase();
    let hub: {
      id: string;
      extras?: unknown;
      estimated_total_eur?: number;
      assigned_agent?: string;
    } | null = null;
    try {
      hub = await pb
        .collection("ops_hub")
        .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
    } catch {
      hub = null;
    }

    if (!hub) {
      return NextResponse.json({
        pnr,
        services: [] as ServiceLineItem[],
        finalApprovedPrice: null,
        priceMode: "estimate" as PriceMode,
      });
    }

    const extras = parseOpsHubExtras(hub.extras);
    return NextResponse.json({
      pnr,
      opsHubId: hub.id,
      services: extras.agent_services || [],
      finalApprovedPrice: extras.final_approved_price ?? null,
      priceMode: extras.price_mode === "exact" ? "exact" : "estimate",
      estimatedTotalEur: Number(hub.estimated_total_eur) || 0,
      assignedAgent: hub.assigned_agent || null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/agent-services
 * { pnr, services?, finalApprovedPrice?, agentName?, mode? }
 * mode=replace (default): replaces agent_services list.
 * mode=seed_if_empty: writes services only when extras.agent_services is empty
 *   (guest estimate → Ops Pricing Studio); never overwrites Ops edits.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pnr?: string;
      services?: unknown[];
      finalApprovedPrice?: number | null;
      /** estimate | exact — Ops Pricing Studio price mode */
      priceMode?: PriceMode | string | null;
      agentName?: string;
      /** Absolute package base (guest + agent) to cache */
      estimatedTotalEur?: number | null;
      /** Guest catalog base before agent extras — used to recompute cache */
      guestBaseTotalEur?: number | null;
      /** replace (default) | seed_if_empty */
      mode?: "replace" | "seed_if_empty";
    };

    const pnr = normalizePnr(body.pnr);
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }

    const pb = await getAdminPocketBase();
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem<{
        id: string;
        extras?: unknown;
        estimated_total_eur?: number;
      }>(`pnr="${pnr}"`, { requestKey: null });

    const prev = parseOpsHubExtras(hub.extras);
    const existingServices = prev.agent_services || [];
    const seedIfEmpty = body.mode === "seed_if_empty";

    if (seedIfEmpty && existingServices.length > 0) {
      // Ops (or a prior guest seed) already owns the cart — do not wipe.
      const patch: Record<string, unknown> = {};
      if (
        body.estimatedTotalEur != null &&
        Number.isFinite(Number(body.estimatedTotalEur)) &&
        !(Math.max(0, Math.round(Number(hub.estimated_total_eur) || 0)) > 0)
      ) {
        patch.estimated_total_eur = Math.max(
          0,
          Math.round(Number(body.estimatedTotalEur))
        );
        await pb
          .collection("ops_hub")
          .update(hub.id, patch, { requestKey: null });
      }
      return NextResponse.json({
        ok: true,
        pnr,
        seeded: false,
        services: existingServices,
        finalApprovedPrice: prev.final_approved_price ?? null,
        priceMode: prev.price_mode === "exact" ? "exact" : "estimate",
        estimatedTotalEur:
          patch.estimated_total_eur ?? hub.estimated_total_eur,
      });
    }

    let services: ServiceLineItem[] = Array.isArray(body.services)
      ? preserveVoucherFieldsOnReplace(
          body.services
            .map((s) => normalizeServiceLineItem(s))
            .filter((s): s is ServiceLineItem => Boolean(s)),
          existingServices
        )
      : existingServices;

    const priceMode: PriceMode | undefined =
      body.priceMode === "exact"
        ? "exact"
        : body.priceMode === "estimate"
          ? "estimate"
          : undefined;

    // Exact mode: collapse ranges on every ACCEPTED line and ensure deal-lock total.
    let finalApprovedPrice =
      body.finalApprovedPrice !== undefined
        ? body.finalApprovedPrice
        : undefined;
    if (priceMode === "exact") {
      services = services.map((item) => {
        if (item.isBonus) {
          return { ...item, finalPriceEur: 0, estimateMaxEur: 0 };
        }
        const exact = Math.max(0, Math.round(Number(item.finalPriceEur) || 0));
        return { ...item, finalPriceEur: exact, estimateMaxEur: exact };
      });
      const exactSum = sumAcceptedAgentServicesEur(services);
      if (
        (finalApprovedPrice == null ||
          !Number.isFinite(Number(finalApprovedPrice)) ||
          Number(finalApprovedPrice) <= 0) &&
        exactSum > 0
      ) {
        finalApprovedPrice = exactSum;
      }
    }

    const nextExtras = mergeExtrasPatch(hub.extras, {
      agent_services: services,
      final_approved_price: finalApprovedPrice,
      price_mode: priceMode,
    });

    const prevAgentSum = sumAcceptedAgentServicesEur(prev.agent_services);
    const cached = Math.max(
      0,
      Math.round(Number(hub.estimated_total_eur) || 0)
    );
    let guestBase = Math.max(0, cached - prevAgentSum);
    if (
      body.guestBaseTotalEur != null &&
      Number.isFinite(Number(body.guestBaseTotalEur))
    ) {
      const passed = Math.max(0, Math.round(Number(body.guestBaseTotalEur)));
      // Strip previously cached agent extras if the caller passed the full package total
      guestBase = Math.max(0, passed - prevAgentSum);
    }

    const patch: Record<string, unknown> = {
      extras: nextExtras,
    };

    if (
      body.estimatedTotalEur != null &&
      Number.isFinite(Number(body.estimatedTotalEur))
    ) {
      patch.estimated_total_eur = Math.max(
        0,
        Math.round(Number(body.estimatedTotalEur))
      );
    } else if (!seedIfEmpty) {
      patch.estimated_total_eur =
        guestBase + sumAcceptedAgentServicesEur(services);
    } else if (!(cached > 0)) {
      patch.estimated_total_eur = sumAcceptedAgentServicesEur(services);
    }

    await pb.collection("ops_hub").update(hub.id, patch, { requestKey: null });

    // Keep per-day guide_jobs in sync when tour lines change.
    if (!seedIfEmpty) {
      try {
        const { syncGuideJobsForBooking } = await import("@/lib/guideJobs");
        const { loadOpsGuestRequirements } = await import(
          "@/lib/opsGuestRequirements"
        );
        const reqs = await loadOpsGuestRequirements(pb, pnr).catch(() => null);
        await syncGuideJobsForBooking(pb, {
          pnr,
          reqs,
          hub: { ...hub, extras: nextExtras } as never,
          services,
        });
      } catch {
        /* guide_jobs optional until migration applied */
      }
    }

    const saved = parseOpsHubExtras(nextExtras);
    return NextResponse.json({
      ok: true,
      pnr,
      seeded: seedIfEmpty,
      services: saved.agent_services || [],
      finalApprovedPrice: saved.final_approved_price ?? null,
      priceMode: saved.price_mode === "exact" ? "exact" : "estimate",
      estimatedTotalEur: patch.estimated_total_eur ?? hub.estimated_total_eur,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
