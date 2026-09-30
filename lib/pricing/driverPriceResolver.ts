/**
 * Resolve transport net cost: driver rate sheet override → system fallback.
 */

import type PocketBase from "pocketbase";

export type ResolveTransportCostParams = {
  /** drivers collection id (not staff id) */
  assignedDriverId?: string;
  /** staff id — resolved to drivers row when assignedDriverId omitted */
  assignedStaffId?: string;
  rateType?: "transfer" | "intercity" | "hourly_chauffeur";
  vehicleId?: string;
  routeKey?: string;
  airportTransferId?: string;
  cityId?: string;
  fallbackBasePriceJPY: number;
};

export type ResolveTransportCostResult = {
  realCostJPY: number;
  isDriverOverride: boolean;
  sourceDriverName?: string;
  rateSheetId?: string;
};

async function resolveDriverId(
  pb: PocketBase,
  params: ResolveTransportCostParams
): Promise<{ driverId: string; name?: string } | null> {
  if (params.assignedDriverId) {
    try {
      const d = await pb.collection("drivers").getOne<{
        id: string;
        full_name?: string;
      }>(params.assignedDriverId, { requestKey: null });
      return { driverId: d.id, name: d.full_name };
    } catch {
      return { driverId: params.assignedDriverId };
    }
  }
  const staffId = String(params.assignedStaffId || "").trim();
  if (!staffId) return null;
  try {
    const d = await pb.collection("drivers").getFirstListItem<{
      id: string;
      full_name?: string;
    }>(`staff="${staffId}"`, { requestKey: null });
    return { driverId: d.id, name: d.full_name };
  } catch {
    return null;
  }
}

export async function resolveTransportCost(
  pb: PocketBase,
  params: ResolveTransportCostParams
): Promise<ResolveTransportCostResult> {
  const fallback = Math.max(0, Number(params.fallbackBasePriceJPY) || 0);
  const driver = await resolveDriverId(pb, params);
  if (!driver) {
    return { realCostJPY: fallback, isDriverOverride: false };
  }

  const parts: string[] = [
    `driver="${driver.driverId}"`,
    "is_active=true",
  ];
  if (params.rateType) parts.push(`rate_type="${params.rateType}"`);
  if (params.vehicleId) parts.push(`vehicle="${params.vehicleId}"`);
  if (params.routeKey) {
    const key = params.routeKey.replace(/"/g, "");
    parts.push(`route_key="${key}"`);
  }
  if (params.airportTransferId) {
    parts.push(`airport_transfer="${params.airportTransferId}"`);
  }
  if (params.cityId) parts.push(`city="${params.cityId}"`);

  try {
    const row = await pb.collection("driver_rate_sheet").getFirstListItem<{
      id: string;
      driver_cost_jpy?: number;
    }>(parts.join(" && "), { requestKey: null });
    const cost = Number(row.driver_cost_jpy);
    if (Number.isFinite(cost) && cost > 0) {
      return {
        realCostJPY: cost,
        isDriverOverride: true,
        sourceDriverName: driver.name,
        rateSheetId: row.id,
      };
    }
  } catch {
    /* no matching override */
  }

  return {
    realCostJPY: fallback,
    isDriverOverride: false,
    sourceDriverName: driver.name,
  };
}
