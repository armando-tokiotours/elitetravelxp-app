/// <reference path="../pb_data/types.d.ts" />
/**
 * Audit + display fields for bookings_and_leads:
 * email send tracking, save versioning, cities list, duration label.
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("bookings_and_leads");

  const addIfMissing = (field) => {
    if (!col.fields.getByName(field.name)) {
      col.fields.add(new Field(field));
    }
  };

  addIfMissing({
    type: "date",
    name: "first_email_sent_at",
    required: false,
  });
  addIfMissing({
    type: "date",
    name: "last_email_sent_at",
    required: false,
  });
  addIfMissing({
    type: "number",
    name: "email_sent_count",
    required: false,
    min: 0,
  });
  addIfMissing({
    type: "number",
    name: "save_version",
    required: false,
    min: 0,
  });
  addIfMissing({
    type: "date",
    name: "last_saved_at",
    required: false,
  });
  addIfMissing({
    type: "text",
    name: "cities_list",
    required: false,
    max: 500,
  });
  // Display string (e.g. "10 Days", "6 Hours") — numeric duration_value kept for math.
  addIfMissing({
    type: "text",
    name: "duration_label",
    required: false,
    max: 64,
  });

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("bookings_and_leads");
    for (const name of [
      "first_email_sent_at",
      "last_email_sent_at",
      "email_sent_count",
      "save_version",
      "last_saved_at",
      "cities_list",
      "duration_label",
    ]) {
      const f = col.fields.getByName(name);
      if (f) col.fields.removeById(f.id);
    }
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
