/** Airport transfer vehicle tier based on passenger count. */

export type TransferVehicleTier =
  | "sedan"
  | "minivan"
  | "van"
  | "minibus";

export interface TransferVehicleResult {
  tier: TransferVehicleTier;
  label: string;
  /** Multiplier applied to hub base pickup/dropoff fee */
  multiplier: number;
}

/**
 * Map party size → transfer vehicle class + price multiplier.
 * Base hub fee is for a standard sedan (1–2 pax).
 */
export function calculateTransferVehicle(
  totalPax: number
): TransferVehicleResult {
  const pax = Math.max(0, Math.floor(totalPax));
  if (pax <= 2) {
    return { tier: "sedan", label: "Standard Sedan", multiplier: 1 };
  }
  if (pax <= 5) {
    return { tier: "minivan", label: "Minivan", multiplier: 1.5 };
  }
  if (pax <= 9) {
    return { tier: "van", label: "Full Van / HiAce", multiplier: 2 };
  }
  return {
    tier: "minibus",
    label: "Minibus / Multiple Vehicles",
    multiplier: 2.5,
  };
}

export function transferFeeForPax(baseFee: number, totalPax: number): number {
  const fee = Number(baseFee) || 0;
  if (fee <= 0) return 0;
  const { multiplier } = calculateTransferVehicle(totalPax);
  return Math.round(fee * multiplier);
}
