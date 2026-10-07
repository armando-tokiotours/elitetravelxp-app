/**
 * Local VPS ticket voucher storage (filesystem under public/uploads/tickets).
 *
 * Disk:   {cwd}/public/uploads/tickets/{PNR}/{itemId}/{timestamp}-{file}.pdf
 * Public: /uploads/tickets/{PNR}/{itemId}/{timestamp}-{file}.pdf
 *
 * Docker: mount a host volume on /app/public/uploads/tickets so PDFs survive
 * container rebuilds (see docker-compose.vps.yml). No cloud token required.
 */

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_TICKET_PDF_BYTES = 15 * 1024 * 1024;
const PUBLIC_URL_PREFIX = "/uploads/tickets";

/** Always ready — local disk; kept for API/UI compat with former blobTokenConfigured. */
export function ticketStorageReady(): boolean {
  return true;
}

/** @deprecated Use ticketStorageReady — alias for older callers. */
export function blobTokenConfigured(): boolean {
  return ticketStorageReady();
}

function sanitizePathSegment(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/** Absolute directory for ticket PDFs inside the app public tree. */
export function ticketUploadsRootDir(): string {
  return path.join(process.cwd(), "public", "uploads", "tickets");
}

/**
 * Relative public URL path (starts with /uploads/tickets/...).
 * Also stored on agent_services[].voucherBlobPathname for purge/delete.
 */
export function ticketVoucherPublicPath(opts: {
  pnr: string;
  itemId: string;
  filename: string;
}): string {
  const pnr = sanitizePathSegment(opts.pnr).toUpperCase() || "PNR";
  const itemId = sanitizePathSegment(opts.itemId) || "item";
  const base = sanitizePathSegment(opts.filename) || "ticket.pdf";
  const withExt = /\.pdf$/i.test(base) ? base : `${base}.pdf`;
  return `${PUBLIC_URL_PREFIX}/${pnr}/${itemId}/${Date.now()}-${withExt}`;
}

/** @deprecated Prefer ticketVoucherPublicPath — same shape without leading slash historically. */
export function ticketVoucherBlobPathname(opts: {
  pnr: string;
  itemId: string;
  filename: string;
}): string {
  return ticketVoucherPublicPath(opts).replace(/^\//, "");
}

function publicUrlToAbsolutePath(urlOrPath: string): string | null {
  const raw = String(urlOrPath || "").trim();
  if (!raw) return null;

  let pathname = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      pathname = new URL(raw).pathname;
    }
  } catch {
    return null;
  }

  // Accept /uploads/tickets/... or uploads/tickets/...
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!normalized.startsWith(`${PUBLIC_URL_PREFIX}/`)) {
    return null;
  }

  const rel = normalized.slice(1); // uploads/tickets/...
  const abs = path.resolve(process.cwd(), "public", rel);
  const root = path.resolve(ticketUploadsRootDir());
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    return null;
  }
  return abs;
}

export async function uploadTicketPdfBlob(opts: {
  pnr: string;
  itemId: string;
  file: File | Blob;
  filename?: string;
}): Promise<{ url: string; pathname: string; filename: string }> {
  const size =
    opts.file instanceof File
      ? opts.file.size
      : Number((opts.file as Blob).size || 0);
  if (!(size > 0)) throw new Error("Empty file");
  if (size > MAX_TICKET_PDF_BYTES) {
    throw new Error("PDF exceeds 15MB limit");
  }
  const filename =
    String(opts.filename || "").trim() ||
    (opts.file instanceof File ? opts.file.name : "ticket.pdf") ||
    "ticket.pdf";
  if (
    opts.file instanceof File &&
    opts.file.type &&
    opts.file.type !== "application/pdf"
  ) {
    throw new Error("Only PDF vouchers are accepted");
  }

  const publicPath = ticketVoucherPublicPath({
    pnr: opts.pnr,
    itemId: opts.itemId,
    filename,
  });
  const abs = publicUrlToAbsolutePath(publicPath);
  if (!abs) throw new Error("Invalid ticket storage path");

  await mkdir(path.dirname(abs), { recursive: true });
  const buf = Buffer.from(await opts.file.arrayBuffer());
  await writeFile(abs, buf);

  return {
    url: publicPath,
    pathname: publicPath,
    filename: filename.slice(0, 240),
  };
}

export async function deleteBlobByUrlOrPathname(
  urlOrPathname: string | null | undefined
): Promise<void> {
  const abs = publicUrlToAbsolutePath(String(urlOrPathname || ""));
  if (!abs) return;
  try {
    await unlink(abs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return;
    console.warn(
      "[ticketStorage] delete failed:",
      abs,
      err instanceof Error ? err.message : err
    );
  }
}
