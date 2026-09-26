/// <reference path="../pb_data/types.d.ts" />
/**
 * Expand agencies with company / VAT / bank fields (Silo 2 partner profile).
 */
migrate((app) => {
  let col;
  try {
    col = app.findCollectionByNameOrId("agencies");
  } catch (_) {
    return;
  }

  const addIfMissing = (field) => {
    if (!col.fields.getByName(field.name)) {
      col.fields.add(new Field(field));
    }
  };

  addIfMissing({ type: "text", name: "vat_number", required: false, max: 64 });
  addIfMissing({ type: "text", name: "phone", required: false, max: 64 });
  addIfMissing({ type: "text", name: "address", required: false, max: 1000 });
  addIfMissing({ type: "text", name: "country", required: false, max: 120 });
  addIfMissing({ type: "url", name: "website", required: false });
  addIfMissing({ type: "text", name: "bank_info", required: false, max: 2000 });
  addIfMissing({
    type: "text",
    name: "payment_terms",
    required: false,
    max: 2000,
  });
  addIfMissing({
    type: "file",
    name: "logo",
    required: false,
    maxSelect: 1,
    maxSize: 5242880,
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
  });

  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("agencies");
    for (const name of [
      "vat_number",
      "phone",
      "address",
      "country",
      "website",
      "bank_info",
      "payment_terms",
      "logo",
    ]) {
      const f = col.fields.getByName(name);
      if (f) col.fields.removeById(f.id);
    }
    app.save(col);
  } catch (_) {
    /* ignore */
  }
});
