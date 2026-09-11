/**
 * One-shot: ensure site_branding typography fields + font defaults on VPS.
 * Usage: PB_URL=... PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/seed-branding-fonts.mjs
 */
import PocketBase from "pocketbase";

const pb = new PocketBase(process.env.PB_URL || "http://127.0.0.1:8090");

await pb.collection("_superusers").authWithPassword(
  process.env.PB_ADMIN_EMAIL,
  process.env.PB_ADMIN_PASSWORD
);

const cols = await pb.collections.getFullList();
const col = cols.find((c) => c.name === "site_branding");
if (!col) throw new Error("site_branding missing");

const have = new Set((col.fields || []).map((f) => f.name));
const addText = (name, max = 200) => {
  if (have.has(name)) return false;
  col.fields.push({
    name,
    type: "text",
    required: false,
    max,
    min: 0,
    presentable: false,
    system: false,
    hidden: false,
  });
  have.add(name);
  console.log("add", name);
  return true;
};

let changed = false;
changed = addText("font_h1", 120) || changed;
changed = addText("font_h2", 120) || changed;
changed = addText("font_body", 120) || changed;
changed = addText("google_fonts_url", 800) || changed;
if (changed) {
  await pb.collections.update(col.id, { fields: col.fields });
  console.log("schema updated");
} else {
  console.log("schema ok");
}

const rows = await pb.collection("site_branding").getFullList();
const row = rows[0];
if (!row) throw new Error("no branding row");

const patch = {
  font_h1: "Montserrat ExtraBold",
  font_h2: "Century Gothic",
  font_body: "Poppins",
  google_fonts_url:
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@100;400;700;800&display=swap",
  hero_title_main: row.hero_title_main || "Build Your",
  hero_title_highlight: row.hero_title_highlight || "Perfect Japan Trip",
  hero_subtitle:
    row.hero_subtitle ||
    "Design every detail. We'll take care of the rest.",
};
await pb.collection("site_branding").update(row.id, patch);
console.log("fonts", patch);
