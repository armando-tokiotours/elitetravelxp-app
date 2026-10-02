/// <reference path="../pb_data/types.d.ts" />
/**
 * Add OPS internal channel (+ OPS sender_role) to booking_messages.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("booking_messages");

  const channel = col.fields.getByName("channel");
  if (channel && Array.isArray(channel.values) && !channel.values.includes("OPS")) {
    const next = ["CUSTOMER", "OPS", "GUIDE", "DRIVER", "TICKETS"];
    for (const v of channel.values) {
      if (!next.includes(v)) next.push(v);
    }
    channel.values = next;
  }

  const senderRole = col.fields.getByName("sender_role");
  if (
    senderRole &&
    Array.isArray(senderRole.values) &&
    !senderRole.values.includes("OPS")
  ) {
    const next = ["CONCIERGE", "CUSTOMER", "GUIDE", "DRIVER", "TICKETS", "OPS"];
    for (const v of senderRole.values) {
      if (!next.includes(v)) next.push(v);
    }
    senderRole.values = next;
  }

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("booking_messages");
    const channel = col.fields.getByName("channel");
    if (channel && Array.isArray(channel.values)) {
      channel.values = channel.values.filter((v) => v !== "OPS");
    }
    const senderRole = col.fields.getByName("sender_role");
    if (senderRole && Array.isArray(senderRole.values)) {
      senderRole.values = senderRole.values.filter((v) => v !== "OPS");
    }
    app.save(col);
  } catch (_) {}
});
