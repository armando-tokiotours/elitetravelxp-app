/**
 * Server-only: auto-placeholder for newly created catalog records that
 * have no photo yet.
 *
 * Renders the same design as the existing ad-hoc placeholder already on
 * disk for e.g. Teamlab (`w4eqow4c5cc5rw4_1.webp`): white 1200×900,
 * teal (#054F70) border, the slot ID in big type, the record title
 * below it, and a "PLACEHOLDER — replace {slot} photo" footer.
 * Stored via writeVpsMediaFile (folder "catalog", stableKey =
 * `{recordId}_1`), which produces the `{slot}.webp` +
 * `{slot}--mobile.webp` pair.
 *
 * Idempotent: if `/uploads/catalog/{slot}.webp` already exists the
 * file is left completely untouched — a real photo is never clobbered.
 */

import "server-only";

import { access } from "node:fs/promises";
import path from "node:path";
import { catalogMediaSlot } from "@/lib/catalogMedia";
import { uploadsRootDir, writeVpsMediaFile } from "@/lib/vpsMediaStorage";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word-wrap into at most `maxLines` lines (last line ellipsised). */
function wrapTitle(title: string, perLine = 34, maxLines = 2): string[] {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (lines.length >= maxLines) break;
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > perLine && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // Anything left over → ellipsis on the last line.
  const consumed = lines.join(" ").split(" ").filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/…?$/, "")}…`;
  }
  return lines;
}

export function renderCatalogPlaceholderSvg(slot: string, title: string): string {
  const safeSlot = xmlEscape(slot);
  const titleLines = wrapTitle(title || slot);
  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="600" y="${520 + i * 52}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="600" fill="#1a1a1a">${xmlEscape(line)}</text>`
    )
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect x="0" y="0" width="1200" height="900" fill="#ffffff"/>
  <rect x="24" y="24" width="1152" height="852" fill="none" stroke="#054F70" stroke-width="8"/>
  <text x="600" y="440" text-anchor="middle" font-family="Menlo, Consolas, monospace" font-size="62" font-weight="700" fill="#054F70">${safeSlot}</text>
  ${titleSvg}
  <text x="600" y="700" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#666666">PLACEHOLDER — replace ${safeSlot} photo</text>
</svg>`;
}

export async function ensureVpsCatalogPlaceholder(
  recordId: string,
  title: string
): Promise<{ created: boolean; slot: string; url?: string; mobileUrl?: string }> {
  const slot = catalogMediaSlot(recordId, 1);
  if (!slot) return { created: false, slot: "" };

  const webAbs = path.join(uploadsRootDir(), "catalog", `${slot}.webp`);
  const exists = await access(webAbs).then(
    () => true,
    () => false
  );
  if (exists) return { created: false, slot };

  const svg = renderCatalogPlaceholderSvg(slot, title);
  const sharp = (await import("sharp")).default;
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  // Re-check immediately before writing: never clobber a real photo
  // that landed while we were rendering.
  const existsNow = await access(webAbs).then(
    () => true,
    () => false
  );
  if (existsNow) return { created: false, slot };

  const saved = await writeVpsMediaFile({
    folder: "catalog",
    fileName: "placeholder.png",
    buffer: pngBuffer,
    stableKey: slot,
  });
  return { created: true, slot, url: saved.url, mobileUrl: saved.mobileUrl };
}
