"use client";

import type { PbCity } from "@/lib/pocketbase/client";
import { estimateSelfArrangeDailyEur } from "@/lib/interCityRoutes";

/**
 * Mode A — Self / On Your Own: out-of-pocket comparison (not on TokioTours invoice).
 */
export function SelfArrangeMicroTable({
  city,
  nights = 1,
  cityName,
}: {
  city?: PbCity | null;
  nights?: number;
  cityName: string;
}) {
  const est = estimateSelfArrangeDailyEur(city, nights);

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-amber-500/25 bg-amber-950/20">
      <div className="border-b border-amber-500/20 px-3 py-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#F6A724]">
          Self-arranged · local spend (not billed)
        </p>
        <p className="text-[11px] text-zinc-400">
          Typical out-of-pocket in {cityName} · TokioTours invoice +€0
        </p>
      </div>
      <table className="w-full text-left text-[11px] text-zinc-300">
        <tbody>
          <tr className="border-b border-white/5">
            <td className="px-3 py-1.5">Taxi / Uber (avg hop × days)</td>
            <td className="px-3 py-1.5 text-right font-medium text-white">
              ≈ €{Math.round(est.taxiEur)}
            </td>
          </tr>
          <tr className="border-b border-white/5">
            <td className="px-3 py-1.5">Subway / day pass</td>
            <td className="px-3 py-1.5 text-right font-medium text-white">
              ≈ €{Math.round(est.subwayEur)}
            </td>
          </tr>
          <tr>
            <td className="px-3 py-1.5">Typical wait / transfer</td>
            <td className="px-3 py-1.5 text-right font-medium text-white">
              ~{est.waitMins} min
            </td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-amber-500/20 px-3 py-1.5 text-[10px] text-zinc-500">
        Est. local total ≈ €{Math.round(est.totalEur)} · staff can edit city rates
        in Team Access → Cities
      </p>
    </div>
  );
}
