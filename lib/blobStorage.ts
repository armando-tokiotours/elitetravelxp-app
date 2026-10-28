/**
 * Local VPS ticket voucher storage (filesystem under public/uploads/tickets).
 *
 * Disk:   {cwd}/public/uploads/tickets/{PNR}/{itemId}/{timestamp}-{file}.{pdf|jpg|…}
 * Public: /uploads/tickets/{PNR}/{itemId}/{timestamp}-{file}.{pdf|jpg|…}
 *
 * Docker: mount a host volume on /app/public/uploads/tickets so files survive
 * container rebuilds (see docker-compose.vps.yml). No cloud token required.
 */

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const TICKET_VOUCHER_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isTicketVoucherMime(type: string | null | undefined): boolean {
  const t = String(type || "")
    .trim()
    .toLowerCase();
  if (!t) return true; // allow empty (some browsers omit)
  return TICKET_VOUCHER_MIME.has(t);
}

function extensionForTicketFile(
  filename: string,
  mime?: string | null
): string {
  const fromName = path.extname(filename).toLowerCase();
  if (
    fromName === ".pdf" ||
    fromName === ".jpg" ||
    fromName === ".jpeg" ||
    fromName === ".png" ||
    fromName === ".webp" ||
    fromName === ".gif"
  ) {
    return fromName === ".jpeg" ? ".jpg" : fromName;
  }
  const m = String(mime || "").toLowerCase();
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  return ".pdf";
}

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
  const rawName = String(opts.filename || "ticket.pdf").trim() || "ticket.pdf";
  const ext = extensionForTicketFile(rawName);
  const stem =
    sanitizePathSegment(rawName.replace(/\.[^.]+$/, "")) || "ticket";
  return `${PUBLIC_URL_PREFIX}/${pnr}/${itemId}/${Date.now()}-${stem}${ext}`;
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
  const mime =
    opts.file instanceof File ? opts.file.type : null;
  if (opts.file instanceof File && mime && !isTicketVoucherMime(mime)) {
    throw new Error("Only PDF or image vouchers are accepted (PDF/JPG/PNG/WebP)");
  }
  const filename =
    String(opts.filename || "").trim() ||
    (opts.file instanceof File ? opts.file.name : "ticket.pdf") ||
    "ticket.pdf";
  const withExt = (() => {
    const ext = extensionForTicketFile(filename, mime);
    if (/\.(pdf|jpe?g|png|webp|gif)$/i.test(filename)) return filename;
    return `${filename}${ext}`;
  })();

  const publicPath = ticketVoucherPublicPath({
    pnr: opts.pnr,
    itemId: opts.itemId,
    filename: withExt,
  });
  const abs = publicUrlToAbsolutePath(publicPath);
  if (!abs) throw new Error("Invalid ticket storage path");

  await mkdir(path.dirname(abs), { recursive: true });
  const buf = Buffer.from(await opts.file.arrayBuffer());
  await writeFile(abs, buf);

  return {
    url: publicPath,
    pathname: publicPath,
    filename: withExt.slice(0, 240),
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
