/// <reference path="../pb_data/types.d.ts" />
/**
 * Expand agencies for B2B ops/billing + agency_tour_rates junction.
 */
migrate((app) => {
  let agencies;
  try {
    agencies = app.findCollectionByNameOrId("agencies");
  } catch (_) {
    return;
  }

  const addIfMissing = (field) => {
    if (!agencies.fields.getByName(field.name)) {
      agencies.fields.add(new Field(field));
    }
  };

  addIfMissing({
    type: "text",
    name: "ops_contact_name",
    required: false,
    max: 200,
  });
  addIfMissing({ type: "email", name: "ops_contact_email", required: false });
  addIfMissing({
    type: "text",
    name: "ops_contact_phone",
    required: false,
    max: 64,
  });
  addIfMissing({
    type: "text",
    name: "billing_contact_name",
    required: false,
    max: 200,
  });
  addIfMissing({
    type: "email",
    name: "billing_contact_email",
    required: false,
  });
  addIfMissing({
    type: "text",
    name: "billing_contact_phone",
    required: false,
    max: 64,
  });
  addIfMissing({
    type: "select",
    name: "preferred_currency",
    required: false,
    maxSelect: 1,
    values: ["EUR", "JPY"],
  });
  addIfMissing({
    type: "select",
    name: "payment_method",
    required: false,
    maxSelect: 1,
    values: [
      "Bank Transfer / SEPA",
      "Credit Card",
      "WISE",
      "Invoice Net 30",
    ],
  });
  addIfMissing({
    type: "number",
    name: "commission_rate_percentage",
    required: false,
    min: 0,
  });
  addIfMissing({
    type: "select",
    name: "account_status",
    required: false,
    maxSelect: 1,
    values: ["Active", "Pending Review", "Suspended"],
  });

  app.save(agencies);

  let toursId = "";
  try {
    toursId = app.findCollectionByNameOrId("tours").id;
  } catch (_) {
    return;
  }

  try {
    app.findCollectionByNameOrId("agency_tour_rates");
  } catch (_) {
    const col = new Collection({
      type: "base",
      name: "agency_tour_rates",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: "agency",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: agencies.id,
          cascadeDelete: true,
        },
        {
          name: "tour",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: toursId,
          cascadeDelete: true,
        },
        { name: "item_title", type: "text", required: false, max: 300 },
        {
          name: "negotiated_price",
          type: "number",
          required: true,
          min: 0,
        },
        {
          name: "currency",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["EUR", "JPY"],
        },
        { name: "is_active", type: "bool", required: false },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_agency_tour_rates_agency_tour ON agency_tour_rates (`agency`, `tour`)",
      ],
    });
    app.save(col);
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("agency_tour_rates"));
  } catch (_) {}
  try {
    const col = app.findCollectionByNameOrId("agencies");
    for (const name of [
      "ops_contact_name",
      "ops_contact_email",
      "ops_contact_phone",
      "billing_contact_name",
      "billing_contact_email",
      "billing_contact_phone",
      "preferred_currency",
      "payment_method",
      "commission_rate_percentage",
      "account_status",
    ]) {
      const f = col.fields.getByName(name);
      if (f) col.fields.removeById(f.id);
    }
    app.save(col);
  } catch (_) {}
});
