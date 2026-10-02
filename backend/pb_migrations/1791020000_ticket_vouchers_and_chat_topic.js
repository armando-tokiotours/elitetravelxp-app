/// <reference path="../pb_data/types.d.ts" />
/**
 * Ticket PDF vouchers on ops_tickets + optional topic on booking_messages.
 * tour_end_date drives the 2-day post-tour purge cron.
 */
migrate((app) => {
  try {
    const tickets = app.findCollectionByNameOrId("ops_tickets");
    if (!tickets.fields.getByName("voucher_pdf")) {
      tickets.fields.add(
        new Field({
          type: "file",
          name: "voucher_pdf",
          required: false,
          maxSelect: 1,
          maxSize: 15728640,
          mimeTypes: ["application/pdf"],
        })
      );
    }
    if (!tickets.fields.getByName("voucher_filename")) {
      tickets.fields.add(
        new Field({
          type: "text",
          name: "voucher_filename",
          required: false,
          max: 240,
        })
      );
    }
    if (!tickets.fields.getByName("tour_end_date")) {
      tickets.fields.add(
        new Field({
          type: "date",
          name: "tour_end_date",
          required: false,
        })
      );
    }
    app.save(tickets);
  } catch (e) {
    console.log("[1791020000] ops_tickets voucher fields:", e);
  }

  try {
    const msgs = app.findCollectionByNameOrId("booking_messages");
    if (!msgs.fields.getByName("topic")) {
      msgs.fields.add(
        new Field({
          type: "select",
          name: "topic",
          required: false,
          maxSelect: 1,
          values: ["DRIVER", "TOUR", "TICKETS", "PAYMENT", "GENERAL"],
        })
      );
      app.save(msgs);
    }
  } catch (e) {
    console.log("[1791020000] booking_messages.topic:", e);
  }
}, (app) => {
  try {
    const tickets = app.findCollectionByNameOrId("ops_tickets");
    for (const name of ["voucher_pdf", "voucher_filename", "tour_end_date"]) {
      try {
        tickets.fields.removeByName(name);
      } catch (_) {
        /* ignore */
      }
    }
    app.save(tickets);
  } catch (_) {
    /* ignore */
  }
  try {
    const msgs = app.findCollectionByNameOrId("booking_messages");
    try {
      msgs.fields.removeByName("topic");
    } catch (_) {
      /* ignore */
    }
    app.save(msgs);
  } catch (_) {
    /* ignore */
  }
});
