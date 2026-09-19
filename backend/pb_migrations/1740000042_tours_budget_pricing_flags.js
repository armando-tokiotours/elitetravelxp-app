/// <reference path="../pb_data/types.d.ts" />
/**
 * Tours / experiences: budget-planner pricing flags
 * pricing_tier | is_self_guided | guide_required | base_price_eur | display_badge
 */
migrate((app) => {
  const tours = app.findCollectionByNameOrId("tours");

  const missing = (name) => {
    try {
      return !tours.fields.getByName(name);
    } catch (_) {
      return true;
    }
  };

  if (missing("pricing_tier")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "pricing_tier",
        required: false,
        maxSelect: 1,
        values: ["free", "low_cost", "standard", "luxury"],
      })
    );
  }

  if (missing("is_self_guided")) {
    tours.fields.add(
      new Field({
        type: "bool",
        name: "is_self_guided",
        required: false,
      })
    );
  }

  if (missing("guide_required")) {
    tours.fields.add(
      new Field({
        type: "bool",
        name: "guide_required",
        required: false,
      })
    );
  }

  if (missing("base_price_eur")) {
    tours.fields.add(
      new Field({
        type: "number",
        name: "base_price_eur",
        required: false,
        min: 0,
      })
    );
  }

  if (missing("display_badge")) {
    tours.fields.add(
      new Field({
        type: "select",
        name: "display_badge",
        required: false,
        maxSelect: 1,
        values: ["FREE / LOW-COST", "POPULAR", "SELF-GUIDED"],
      })
    );
  }

  app.save(tours);

  // Soft backfill: direct_ticket / zero-price rows → self-guided low-cost
  const rows = app.findAllRecords(tours);
  for (const row of rows) {
    let dirty = false;
    const access = String(row.get("access_type") || "");
    const p1 = Number(row.get("price_1_pax") ?? 0);
    const baseEur = Number(row.get("base_price_eur") ?? 0);

    if (access === "direct_ticket" && row.get("is_self_guided") !== true) {
      row.set("is_self_guided", true);
      row.set("guide_required", false);
      dirty = true;
    }

    if (
      !row.get("pricing_tier") &&
      (p1 === 0 || (baseEur > 0 && baseEur <= 50) || access === "direct_ticket")
    ) {
      row.set("pricing_tier", p1 === 0 && baseEur === 0 ? "free" : "low_cost");
      dirty = true;
    }

    if (
      !row.get("display_badge") &&
      (row.get("is_self_guided") === true ||
        p1 === 0 ||
        (baseEur > 0 && baseEur <= 50) ||
        row.get("pricing_tier") === "free" ||
        row.get("pricing_tier") === "low_cost")
    ) {
      row.set("display_badge", "FREE / LOW-COST");
      dirty = true;
    }

    if (dirty) app.save(row);
  }
}, (app) => {
  /* keep fields on down */
});
