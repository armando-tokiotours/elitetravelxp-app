/**
 * Map Claude inquiry CSV rows → bookings_and_leads + ops_hub agent cart.
 */

import type PocketBase from "pocketbase";
import {
  createCustomServiceLine,
  mergeExtrasPatch,
  parseOpsHubExtras,
  sumAcceptedAgentServicesEur,
  type AgentServiceCategory,
  type ServiceLineItem,
} from "@/lib/agentServices";
import {
  upsertBookingsAndLeads,
  type MultiDaySelections,
} from "@/lib/bookingsAndLeads";
import {
  pipelineLabel,
  resolveIngestionPipeline,
  type IngestionCategory,
  type IngestionPipeline,
  type IngestionRow,
} from "@/lib/csvIngestionParser";
import { addDaysIso } from "@/lib/dateCascade";
import { syncGuideJobsForBooking } from "@/lib/guideJobs";
import { loadOpsGuestRequirements } from "@/lib/opsGuestRequirements";
import {
  formatGuestSummary,
  upsertOpsHubFromDirect,
} from "@/lib/opsHub";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import { generatePNR, isValidBookingPNR, normalizeBookingPNR } from "@/utils/pnr";

function categoryToAgent(cat: IngestionCategory): AgentServiceCategory {
  switch (cat) {
    case "TRANSIT":
      return "TRANSPORT";
    case "TICKET":
      return "TICKET";
    case "ACCOMMODATION":
      return "CONCIERGE_EXTRA";
    default:
      return "TOUR";
  }
}

function serviceDateForDay(
  startDate: string | null,
  dayNumber: number
): string | undefined {
  if (!startDate) return undefined;
  const n = Math.max(1, dayNumber);
  return n === 1 ? startDate : addDaysIso(startDate, n - 1);
}

function normTitle(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type CatalogTour = {
  id: string;
  title: string;
  city_id?: string;
  duration_hours?: number;
  access_type?: string;
};

type CatalogTransport = {
  id: string;
  name: string;
  transport_type?: string;
  price_per_person?: number;
  city_id?: string;
};

async function loadCatalog(pb: PocketBase): Promise<{
  tours: CatalogTour[];
  transports: CatalogTransport[];
  tokyoCityId: string;
}> {
  const [tours, transports, cities] = await Promise.all([
    pb
      .collection("tours")
      .getFullList<CatalogTour>({
        filter: "is_active != false",
        fields: "id,title,city_id,duration_hours,access_type",
        requestKey: null,
      })
      .catch(() => [] as CatalogTour[]),
    pb
      .collection("transport_products")
      .getFullList<CatalogTransport>({
        filter: "is_active != false",
        fields: "id,name,transport_type,price_per_person,city_id",
        requestKey: null,
      })
      .catch(() => [] as CatalogTransport[]),
    pb
      .collection("cities")
      .getFullList<{ id: string; name?: string }>({
        filter: "is_active != false",
        fields: "id,name",
        requestKey: null,
      })
      .catch(() => [] as { id: string; name?: string }[]),
  ]);

  const tokyo =
    cities.find((c) => /tokyo/i.test(String(c.name || "")))?.id ||
    cities[0]?.id ||
    "";

  return { tours, transports, tokyoCityId: tokyo };
}

function matchTour(
  tours: CatalogTour[],
  title: string
): CatalogTour | undefined {
  const needle = normTitle(title);
  if (!needle) return undefined;
  return (
    tours.find((t) => normTitle(t.title) === needle) ||
    tours.find(
      (t) =>
        normTitle(t.title).includes(needle) ||
        needle.includes(normTitle(t.title))
    )
  );
}

function matchTransport(
  transports: CatalogTransport[],
  title: string
): CatalogTransport | undefined {
  const needle = normTitle(title);
  if (!needle) return undefined;
  return (
    transports.find((t) => normTitle(t.name) === needle) ||
    transports.find(
      (t) =>
        normTitle(t.name).includes(needle) ||
        needle.includes(normTitle(t.name))
    )
  );
}

export type IngestCsvResult = {
  ok: true;
  pnr: string;
  pipeline: IngestionPipeline;
  pipelineLabel: string;
  dossierUrl: string;
  opsUrl: string;
  lineCount: number;
  estimatedTotalEur: number;
  created: boolean;
};

export async function ingestInquiryCsv(
  pb: PocketBase,
  rows: IngestionRow[],
  opts?: { agentName?: string }
): Promise<IngestCsvResult> {
  if (!rows.length) {
    throw new Error("No CSV rows found");
  }

  const header =
    rows.find((r) => r.record_type === "HEADER") || rows[0];
  const lineItems = rows.filter(
    (r) => r.record_type === "LINE_ITEM" && String(r.item_title || "").trim()
  );

  const email = String(header.guest_email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("HEADER row needs a valid guest_email");
  }

  const guestName = String(header.guest_name || "").trim() || "Guest";
  const pax = Math.max(1, Number(header.pax_count) || 1);
  const startDate = header.start_date;
  const pipeline = resolveIngestionPipeline(startDate);

  let pnr = normalizeBookingPNR(header.pnr || "");
  if (
    !pnr ||
    pnr === "JPN-AUTO" ||
    pnr === "AUTO" ||
    !isValidBookingPNR(pnr)
  ) {
    pnr = generatePNR();
  }

  const { tours, transports, tokyoCityId } = await loadCatalog(pb);
  const maxDay = Math.max(
    1,
    ...lineItems.map((l) => Math.max(1, Number(l.day_number) || 1)),
    1
  );

  const agentName = String(opts?.agentName || "CSV Ingest").trim();
  const services: ServiceLineItem[] = lineItems.map((item, index) => {
    const cat = categoryToAgent(item.category);
    const tour =
      item.category === "TOURS" ? matchTour(tours, item.item_title) : undefined;
    const transport =
      item.category === "TRANSIT" || item.category === "TICKET"
        ? matchTransport(transports, item.item_title)
        : undefined;
    const price = Math.max(0, Math.round(Number(item.price_eur) || 0));
    const svcDate = serviceDateForDay(startDate, item.day_number);
    const line = createCustomServiceLine({
      title: item.item_title,
      category: cat,
      priceEur: item.is_bonus ? 0 : price,
      isBonus: item.is_bonus,
      addedByAgent: agentName,
      catalogSourceId: tour?.id || transport?.id,
      notes: [
        `Day ${item.day_number}`,
        item.time_slot,
        item.category,
        svcDate ? `Date ${svcDate}` : "Date TBD",
      ].join(" · "),
    });
    return {
      ...line,
      id: `ingest-${Date.now()}-${index}`,
      status: "ACCEPTED" as const,
      serviceDate: svcDate,
      scheduledDate: svcDate,
      estimateMaxEur: item.is_bonus ? 0 : price,
    };
  });

  const experienceSchedule: NonNullable<
    MultiDaySelections["experienceSchedule"]
  > = [];
  const experienceIds: string[] = [];
  const transportTickets: NonNullable<
    MultiDaySelections["transportTickets"]
  > = [];

  for (const item of lineItems) {
    const svcDate = serviceDateForDay(startDate, item.day_number);
    if (item.category === "TOURS") {
      const tour = matchTour(tours, item.item_title);
      const tourId = tour?.id || `ingest-tour-${normTitle(item.item_title).slice(0, 24)}`;
      experienceIds.push(tourId);
      experienceSchedule.push({
        tourId,
        cityId: tour?.city_id || tokyoCityId || "tokyo",
        date: svcDate,
        title: item.item_title,
        durationHours: tour?.duration_hours,
        accessType: tour?.access_type,
      });
    } else if (item.category === "TRANSIT" || item.category === "TICKET") {
      const transport = matchTransport(transports, item.item_title);
      transportTickets.push({
        productId: transport?.id || `ingest-${normTitle(item.item_title).slice(0, 20)}`,
        name: item.item_title,
        transportType: transport?.transport_type || (item.category === "TICKET" ? "other" : "other"),
        pricePerPerson: item.price_eur,
        quantity: pax,
        cityId: transport?.city_id || tokyoCityId || undefined,
      });
    }
  }

  const cityId = tokyoCityId || "tokyo";
  const endDate =
    startDate && maxDay > 1 ? addDaysIso(startDate, maxDay - 1) : startDate || undefined;

  const locationStops: NonNullable<MultiDaySelections["locationStops"]> = [
    {
      cityId,
      cityName: "Tokyo",
      nights: Math.max(0, maxDay - 1),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      hotelArrangement: lineItems.some((l) => l.category === "ACCOMMODATION")
        ? "tokiotours"
        : "unset",
      hotelName:
        lineItems.find((l) => l.category === "ACCOMMODATION")?.item_title ||
        undefined,
    },
  ];

  const selections = {
    locationCityIds: cityId ? [cityId] : [],
    hotelByCity: {},
    locationStops,
    experienceIds: Array.from(new Set(experienceIds)),
    experienceSchedule,
    transportTickets,
    durationDays: maxDay,
    source: "agent_csv_ingestion",
    pipeline,
    guestName,
    guestEmail: email,
  } as MultiDaySelections;

  const estimatedTotalEur = sumAcceptedAgentServicesEur(services);
  const adults = pax;
  const guests = { adults, kids: 0 };

  const bal = await upsertBookingsAndLeads({
    bookingRef: pnr,
    email,
    type: "multi_day",
    status: "quoted",
    primaryCity: "Tokyo",
    tourDate: startDate,
    guests,
    durationValue: maxDay,
    durationLabel: `${maxDay} Day${maxDay === 1 ? "" : "s"}`,
    citiesList: "Tokyo",
    selections,
  });

  if (!bal.ok || !bal.id) {
    throw new Error(bal.error || "Failed to create bookings_and_leads row");
  }

  const guestSummary = [guestName, formatGuestSummary(guests)]
    .filter(Boolean)
    .join(" · ");

  const hubResult = await upsertOpsHubFromDirect({
    pnr,
    detailId: bal.id,
    status: "quoted",
    primaryCity: "Tokyo",
    tourDate: startDate,
    endDate: endDate || startDate,
    durationDays: maxDay,
    guestSummary,
    estimatedTotalEur,
    markUnread: true,
  });

  if (!hubResult.ok || !hubResult.id) {
    throw new Error(hubResult.error || "Failed to create ops_hub row");
  }

  const hub = await pb.collection("ops_hub").getOne<OpsHubRow>(hubResult.id, {
    requestKey: null,
  });

  const nextExtras: Record<string, unknown> = {
    ...mergeExtrasPatch(hub.extras, {
      agent_services: services,
      final_approved_price: estimatedTotalEur > 0 ? estimatedTotalEur : null,
      price_mode: "exact",
    }),
    ingestion: {
      pipeline,
      source: "claude_csv",
      importedAt: new Date().toISOString(),
      guestName,
    },
  };

  await pb.collection("ops_hub").update(
    hub.id,
    {
      extras: nextExtras,
      estimated_total_eur: estimatedTotalEur,
      guest_summary: guestSummary,
      ...(startDate ? { tour_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    },
    { requestKey: null }
  );

  try {
    const hubForSync: OpsHubRow = { ...hub, extras: nextExtras };
    const reqs = await loadOpsGuestRequirements(pb, hubForSync).catch(
      () => null
    );
    await syncGuideJobsForBooking(pb, {
      pnr,
      reqs,
      hub: hubForSync,
      services,
    });
  } catch {
    /* guide_jobs optional until migration applied */
  }

  // Confirm extras parsed
  parseOpsHubExtras(nextExtras);

  return {
    ok: true,
    pnr,
    pipeline,
    pipelineLabel: pipelineLabel(pipeline),
    dossierUrl: `/dossier/${pnr}`,
    opsUrl: `/ops?pnr=${encodeURIComponent(pnr)}`,
    lineCount: services.length,
    estimatedTotalEur,
    created: Boolean(bal.created || hubResult.created),
  };
}
