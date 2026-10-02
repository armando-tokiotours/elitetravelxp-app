/**
 * Builder S private chauffeur sizing (guest-facing copy; € math stays internal).
 */

export const SINGLE_DAY_CHAUFFEUR_DAILY_EUR = 480;

export function recommendChauffeurFleet(partySize: number): {
  vehiclesNeeded: number;
  fleetLabel: string;
  capacityBand: string;
} {
  const pax = Math.max(1, Math.round(Number(partySize) || 1));
  const vehiclesNeeded = Math.max(1, Math.ceil(pax / 6));

  if (pax <= 5) {
    return {
      vehiclesNeeded: 1,
      fleetLabel: "1× Luxury Alphard / MPV",
      capacityBand: "1–5 guests",
    };
  }
  if (pax <= 9) {
    return {
      vehiclesNeeded: 1,
      fleetLabel: "1× HiAce VIP Van",
      capacityBand: "6–9 guests",
    };
  }
  return {
    vehiclesNeeded,
    fleetLabel:
      vehiclesNeeded >= 3
        ? `${vehiclesNeeded}× Vans / Coaster Bus option`
        : `${vehiclesNeeded}× Luxury Vans`,
    capacityBand: "10+ guests",
  };
}

/** Internal estimate only — do not show raw € to draft guests. */
export function estimateChauffeurHiddenEur(
  partySize: number,
  daysCount = 1
): number {
  const { vehiclesNeeded } = recommendChauffeurFleet(partySize);
  const days = Math.max(1, Math.round(Number(daysCount) || 1));
  return vehiclesNeeded * days * SINGLE_DAY_CHAUFFEUR_DAILY_EUR;
}

export const SUICA_PRELOAD_OPTIONS_EUR = [15, 25, 40] as const;
