/// <reference path="../pb_data/types.d.ts" />
/**
 * Daily midnight: clear ticket voucher PDFs + chat image attachments
 * 2+ days after tour end date.
 */
cronAdd("cleanup_expired_ticket_vouchers", "0 0 * * *", () => {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const y = cutoff.getUTCFullYear();
  const m = String(cutoff.getUTCMonth() + 1).padStart(2, "0");
  const d = String(cutoff.getUTCDate()).padStart(2, "0");
  const isoDay = `${y}-${m}-${d}`;

  // 1) Ticket voucher PDFs on ops_tickets
  let voucherRecords = [];
  try {
    voucherRecords = $app.findRecordsByFilter(
      "ops_tickets",
      `tour_end_date != "" && tour_end_date < "${isoDay}" && voucher_pdf != ""`,
      "-tour_end_date",
      200,
      0
    );
  } catch (e) {
    console.log("[cleanup_ticket_vouchers] voucher query failed:", e);
  }

  for (const record of voucherRecords) {
    try {
      record.set("voucher_pdf", null);
      record.set("voucher_filename", "");
      $app.save(record);
      console.log(
        "[cleanup_ticket_vouchers] purged voucher",
        record.get("pnr"),
        record.get("tour_end_date")
      );
    } catch (err) {
      console.log("[cleanup_ticket_vouchers] voucher save failed:", err);
    }
  }

  // 2) Chat image attachments for expired PNRs (ops_hub.end_date or ops_tickets.tour_end_date)
  const expiredPnrs = new Set();

  try {
    const hubs = $app.findRecordsByFilter(
      "ops_hub",
      `end_date != "" && end_date < "${isoDay}"`,
      "-end_date",
      500,
      0
    );
    for (const hub of hubs) {
      const pnr = String(hub.get("pnr") || "")
        .trim()
        .toUpperCase();
      if (pnr) expiredPnrs.add(pnr);
    }
  } catch (e) {
    console.log("[cleanup_media] ops_hub end_date query failed:", e);
  }

  try {
    const tickets = $app.findRecordsByFilter(
      "ops_tickets",
      `tour_end_date != "" && tour_end_date < "${isoDay}"`,
      "-tour_end_date",
      500,
      0
    );
    for (const row of tickets) {
      const pnr = String(row.get("pnr") || "")
        .trim()
        .toUpperCase();
      if (pnr) expiredPnrs.add(pnr);
    }
  } catch (e) {
    console.log("[cleanup_media] ops_tickets date query failed:", e);
  }

  for (const pnr of expiredPnrs) {
    const safe = String(pnr).replace(/"/g, "");
    let chatImages = [];
    try {
      chatImages = $app.findRecordsByFilter(
        "booking_messages",
        `pnr = "${safe}" && attachment != ""`,
        "-created",
        200,
        0
      );
    } catch (e) {
      console.log("[cleanup_media] booking_messages query failed:", safe, e);
      continue;
    }

    for (const msg of chatImages) {
      try {
        msg.set("attachment", null);
        $app.save(msg);
        console.log("[cleanup_media] purged chat attachment", safe, msg.id);
      } catch (err) {
        console.log("[cleanup_media] chat attachment save failed:", err);
      }
    }
  }
});
