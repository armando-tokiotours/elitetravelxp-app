import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import { canAccessOpsBoard } from "@/lib/staffRoles";

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function requireOpsExportActor(request: Request) {
  const actor = await verifyCredentialActor(request);
  if (!actor) return null;
  if (actor.isSuperuser || canAccessOpsBoard(actor.role)) return actor;
  return null;
}

/**
 * GET /api/ops/export-catalog
 * Downloads tokiotours_catalog_latest.csv for Claude (tours, vehicles, transport).
 * Auth: Bearer required (ops / agent / owner / superuser).
 */
export async function GET(request: Request) {
  try {
    const actor = await requireOpsExportActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pb = await getAdminPocketBase();
    const [tours, vehicles, transports, cities] = await Promise.all([
      pb
        .collection("tours")
        .getFullList<{
          id: string;
          title?: string;
          city_id?: string;
          duration_hours?: number;
          price_1_pax?: number;
          base_price_eur?: number;
          is_active?: boolean;
          is_bonus?: boolean;
          category?: string;
        }>({
          filter: "is_active != false",
          requestKey: null,
        })
        .catch(() => []),
      pb
        .collection("vehicles")
        .getFullList<{
          id: string;
          name?: string;
          max_passengers?: number;
          max_pax?: number;
          price_per_day?: number;
        }>({ requestKey: null })
        .catch(() => []),
      pb
        .collection("transport_products")
        .getFullList<{
          id: string;
          name?: string;
          transport_type?: string;
          price_per_person?: number;
          duration_hours?: number;
          city_id?: string;
          is_active?: boolean;
        }>({
          filter: "is_active != false",
          requestKey: null,
        })
        .catch(() => []),
      pb
        .collection("cities")
        .getFullList<{ id: string; name?: string }>({
          fields: "id,name",
          requestKey: null,
        })
        .catch(() => []),
    ]);

    const cityName = new Map(
      cities.map((c) => [c.id, String(c.name || "").trim() || c.id])
    );

    const lines = [
      "type,id,title,city,capacity_or_duration,base_price_eur,notes",
    ];

    for (const t of tours) {
      const price =
        Number(t.price_1_pax) ||
        Number(t.base_price_eur) ||
        0;
      const hours = Number(t.duration_hours) || 0;
      lines.push(
        [
          "TOUR",
          t.id,
          csvEscape(t.title || ""),
          csvEscape(cityName.get(String(t.city_id || "")) || "Tokyo"),
          csvEscape(hours > 0 ? `${hours}h` : ""),
          String(Math.round(price)),
          csvEscape(
            [
              t.category || "",
              t.is_bonus ? "bonus" : "",
            ]
              .filter(Boolean)
              .join(" · ")
          ),
        ].join(",")
      );
    }

    for (const v of vehicles) {
      const pax = Number(v.max_pax ?? v.max_passengers) || 0;
      const price = Number(v.price_per_day) || 0;
      lines.push(
        [
          "VEHICLE",
          v.id,
          csvEscape(v.name || "Vehicle"),
          "Tokyo",
          csvEscape(pax > 0 ? `${pax} pax` : ""),
          String(Math.round(price)),
          "per day",
        ].join(",")
      );
    }

    for (const k of transports) {
      const price = Number(k.price_per_person) || 0;
      const hours = Number(k.duration_hours) || 0;
      lines.push(
        [
          "TICKET",
          k.id,
          csvEscape(k.name || ""),
          csvEscape(cityName.get(String(k.city_id || "")) || "Tokyo"),
          csvEscape(hours > 0 ? `${hours}h` : "1 pax"),
          String(Math.round(price)),
          csvEscape(k.transport_type || ""),
        ].join(",")
      );
    }

    const csvContent = `${lines.join("\n")}\n`;
    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tokiotours_catalog_${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export-catalog]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
