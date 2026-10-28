/**
 * GET /api/ops/download-csv-template
 * Universal 12-column ingestion CSV sample for Claude / Ops agents.
 * Public format guide — no auth required (contains only fictional sample data).
 */
export async function GET() {
  const sampleCSV = [
    "record_type,pnr,guest_name,guest_email,pax_count,start_date,day_number,time_slot,category,item_title,price_eur,is_bonus",
    "HEADER,JPN-SAMPLE,John Doe,john@example.com,4,2026-10-14,0,All Day,TOURS,Header Record,0,FALSE",
    'LINE_ITEM,JPN-SAMPLE,John Doe,john@example.com,4,2026-10-14,1,Morning,TOURS,"2 Faces of Tokyo Tour (6h)",408,FALSE',
    'LINE_ITEM,JPN-SAMPLE,John Doe,john@example.com,4,2026-10-14,1,All Day,TRANSIT,"Alphard Chauffeur Service",280,FALSE',
    'LINE_ITEM,JPN-SAMPLE,John Doe,john@example.com,4,2026-10-15,2,Afternoon,TICKET,"TeamLab Planets Entry Ticket",140,FALSE',
    "",
    "# RULES FOR CLAUDE / AI:",
    "# 1) Row 1 after header MUST be record_type=HEADER (PNR + guest + pax + start_date).",
    "# 2) Following rows MUST be record_type=LINE_ITEM (one service per row).",
    "# 3) Categories: TOURS | TRANSIT | TICKET | ACCOMMODATION",
    "# 4) time_slot: Morning | Mid-morning | Lunch | Afternoon | Evening | All Day",
    "# 5) start_date = YYYY-MM-DD or empty/null for Pipeline 2 (Flexible / Undated).",
    "# 6) Quote item_title when it contains commas (e.g. \"Guide, 8h, 10 pax\").",
    "# 7) Use JPN-AUTO for pnr if the system should mint a new PNR.",
    "# 8) is_bonus TRUE = €0 complimentary line.",
  ].join("\n");

  return new Response(sampleCSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="tokiotours_ingestion_template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
