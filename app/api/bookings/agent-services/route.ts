import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  mergeExtrasPatch,
  normalizeServiceLineItem,
  parseOpsHubExtras,
  sumAcceptedAgentServicesEur,
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
      });
    }

    const extras = parseOpsHubExtras(hub.extras);
    return NextResponse.json({
      pnr,
      opsHubId: hub.id,
      services: extras.agent_services || [],
      finalApprovedPrice: extras.final_approved_price ?? null,
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
 * { pnr, services?, finalApprovedPrice?, agentName? }
 * Replaces agent_services list and optionally bumps estimated_total_eur.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pnr?: string;
      services?: unknown[];
      finalApprovedPrice?: number | null;
      agentName?: string;
      /** Absolute package base (guest + agent) to cache */
      estimatedTotalEur?: number | null;
      /** Guest catalog base before agent extras — used to recompute cache */
      guestBaseTotalEur?: number | null;
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

    const services: ServiceLineItem[] = Array.isArray(body.services)
      ? body.services
          .map((s) => normalizeServiceLineItem(s))
          .filter((s): s is ServiceLineItem => Boolean(s))
      : parseOpsHubExtras(hub.extras).agent_services || [];

    const nextExtras = mergeExtrasPatch(hub.extras, {
      agent_services: services,
      final_approved_price:
        body.finalApprovedPrice !== undefined
          ? body.finalApprovedPrice
          : undefined,
    });

    const prev = parseOpsHubExtras(hub.extras);
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
    } else {
      patch.estimated_total_eur =
        guestBase + sumAcceptedAgentServicesEur(services);
    }

    await pb.collection("ops_hub").update(hub.id, patch, { requestKey: null });

    return NextResponse.json({
      ok: true,
      pnr,
      services: nextExtras.agent_services || [],
      finalApprovedPrice: nextExtras.final_approved_price ?? null,
      estimatedTotalEur: patch.estimated_total_eur ?? hub.estimated_total_eur,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
