/// <reference path="../pb_data/types.d.ts" />
/**
 * Specialist direct guest chat flags on ops_hub + chat image attachments.
 */
migrate((app) => {
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    if (!hub.fields.getByName("ticketer_direct_chat_enabled")) {
      hub.fields.add(
        new Field({
          type: "bool",
          name: "ticketer_direct_chat_enabled",
          required: false,
        })
      );
    }
    if (!hub.fields.getByName("driver_direct_chat_enabled")) {
      hub.fields.add(
        new Field({
          type: "bool",
          name: "driver_direct_chat_enabled",
          required: false,
        })
      );
    }
    app.save(hub);
  } catch (e) {
    console.log("[1791030000] ops_hub direct flags:", e);
  }

  try {
    const msgs = app.findCollectionByNameOrId("booking_messages");
    if (!msgs.fields.getByName("attachment")) {
      msgs.fields.add(
        new Field({
          type: "file",
          name: "attachment",
          required: false,
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "application/pdf",
          ],
        })
      );
    }
    if (!msgs.fields.getByName("is_direct_specialist")) {
      msgs.fields.add(
        new Field({
          type: "bool",
          name: "is_direct_specialist",
          required: false,
        })
      );
    }
    // Allow image-only posts
    const message = msgs.fields.getByName("message");
    if (message) {
      message.required = false;
    }
    app.save(msgs);
  } catch (e) {
    console.log("[1791030000] booking_messages attachment:", e);
  }
}, (app) => {
  try {
    const hub = app.findCollectionByNameOrId("ops_hub");
    for (const name of [
      "ticketer_direct_chat_enabled",
      "driver_direct_chat_enabled",
    ]) {
      try {
        hub.fields.removeByName(name);
      } catch (_) {
        /* ignore */
      }
    }
    app.save(hub);
  } catch (_) {
    /* ignore */
  }
  try {
    const msgs = app.findCollectionByNameOrId("booking_messages");
    for (const name of ["attachment", "is_direct_specialist"]) {
      try {
        msgs.fields.removeByName(name);
      } catch (_) {
        /* ignore */
      }
    }
    app.save(msgs);
  } catch (_) {
    /* ignore */
  }
});
