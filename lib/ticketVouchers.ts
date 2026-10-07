/**
 * Per-cart-item ticket voucher PDFs on local VPS disk
 * (public/uploads/tickets → /uploads/tickets/... URLs).
 * PocketBase only keeps URL strings on ops_hub.extras.agent_services[].
 *
 * Optional CRON_SECRET protects /api/cron/cleanup-tickets.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  isTicketServiceItem,
  mergeExtrasPatch,
  normalizeServiceLineItem,
  parseOpsHubExtras,
  type ServiceLineItem,
} from "@/lib/agentServices";
import {
  deleteBlobByUrlOrPathname,
  uploadTicketPdfBlob,
} from "@/lib/blobStorage";
import { ensureTicketsRow } from "@/lib/opsTickets";

export type TicketVoucherItem = {
  itemId: string;
  title: string;
  url: string;
  filename: string;
  /** Relative public path used for local unlink on replace/purge */
  blobPathname?: string;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

function itemVoucher(item: ServiceLineItem): TicketVoucherItem | null {
  const url = String(item.voucherUrl || "").trim();
  if (!url) return null;
  return {
    itemId: item.id,
    title: item.title,
    url,
    filename:
      String(item.voucherFilename || "").trim() ||
      `${item.title.replace(/\s+/g, "_").slice(0, 80) || "ticket"}.pdf`,
    blobPathname: String(item.voucherBlobPathname || "").trim() || undefined,
  };
}

export async function loadTicketVouchersByPnr(
  pnrRaw: string
): Promise<{
  pnr: string;
  vouchers: TicketVoucherItem[];
  tourEndDate: string | null;
}> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) {
    return { pnr: "", vouchers: [], tourEndDate: null };
  }
  try {
    const pb = await getAdminPocketBase();
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem<{
        extras?: unknown;
        tour_date?: string;
        end_date?: string;
      }>(`pnr="${pnr}"`, { requestKey: null });
    const extras = parseOpsHubExtras(hub.extras);
    const vouchers = (extras.agent_services || [])
      .filter(isTicketServiceItem)
      .map(itemVoucher)
      .filter((v): v is TicketVoucherItem => Boolean(v));
    const tourEndDate =
      String(hub.end_date || hub.tour_date || "").slice(0, 10) || null;
    return { pnr, vouchers, tourEndDate };
  } catch {
    return { pnr, vouchers: [], tourEndDate: null };
  }
}

/** @deprecated Prefer loadTicketVouchersByPnr — kept for single-banner callers. */
export async function loadTicketVoucherByPnr(
  pnrRaw: string
): Promise<{
  pnr: string;
  filename: string;
  url: string | null;
  tourEndDate: string | null;
  vouchers: TicketVoucherItem[];
} | null> {
  const packed = await loadTicketVouchersByPnr(pnrRaw);
  if (!packed.pnr) return null;
  const first = packed.vouchers[0];
  if (!first) {
    return {
      pnr: packed.pnr,
      filename: "TokioTours_Ticket_Vouchers.pdf",
      url: null,
      tourEndDate: packed.tourEndDate,
      vouchers: [],
    };
  }
  return {
    pnr: packed.pnr,
    filename: first.filename,
    url: first.url,
    tourEndDate: packed.tourEndDate,
    vouchers: packed.vouchers,
  };
}

export async function listTicketCartItemsForPnr(
  pnrRaw: string
): Promise<{
  pnr: string;
  items: ServiceLineItem[];
  tourEndDate: string | null;
}> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) return { pnr: "", items: [], tourEndDate: null };
  try {
    const pb = await getAdminPocketBase();
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem<{
        extras?: unknown;
        tour_date?: string;
        end_date?: string;
      }>(`pnr="${pnr}"`, { requestKey: null });
    const extras = parseOpsHubExtras(hub.extras);
    const items = (extras.agent_services || []).filter(isTicketServiceItem);
    return {
      pnr,
      items,
      tourEndDate:
        String(hub.end_date || hub.tour_date || "").slice(0, 10) || null,
    };
  } catch {
    return { pnr, items: [], tourEndDate: null };
  }
}

export async function uploadTicketVoucherForItem(opts: {
  pnr: string;
  itemId: string;
  file: File | Blob;
  filename?: string;
  tourEndDate?: string | null;
}): Promise<{
  item: ServiceLineItem;
  voucher: TicketVoucherItem;
  services: ServiceLineItem[];
}> {
  const pnr = safePnr(opts.pnr);
  const itemId = String(opts.itemId || "").trim();
  if (!pnr) throw new Error("pnr required");
  if (!itemId) throw new Error("itemId required");

  const pb = await getAdminPocketBase();
  const hub = await pb
    .collection("ops_hub")
    .getFirstListItem<{
      id: string;
      extras?: unknown;
      tour_date?: string;
      end_date?: string;
    }>(`pnr="${pnr}"`, { requestKey: null });

  const extras = parseOpsHubExtras(hub.extras);
  const services = [...(extras.agent_services || [])];
  const idx = services.findIndex((s) => s.id === itemId);
  if (idx < 0) {
    throw new Error(
      "Ticket line not found in invoice cart. Add the ticket/pass in Pricing Studio first."
    );
  }
  const current = services[idx];
  if (!isTicketServiceItem(current)) {
    throw new Error("Selected cart line is not a ticket/pass item");
  }

  // Replace prior local file for this line (best-effort)
  if (current.voucherBlobPathname || current.voucherUrl) {
    await deleteBlobByUrlOrPathname(
      current.voucherBlobPathname || current.voucherUrl
    );
  }

  const uploaded = await uploadTicketPdfBlob({
    pnr,
    itemId,
    file: opts.file,
    filename: opts.filename,
  });

  const next: ServiceLineItem = {
    ...current,
    voucherUrl: uploaded.url,
    voucherFilename: uploaded.filename,
    voucherBlobPathname: uploaded.pathname,
    fulfillmentStatus: "READY",
  };
  services[idx] = next;

  const nextExtras = mergeExtrasPatch(hub.extras, {
    agent_services: services,
  });
  await pb
    .collection("ops_hub")
    .update(hub.id, { extras: nextExtras }, { requestKey: null });

  // Keep tour_end_date on ops_tickets for legacy PB hook / dating; no PDF file field.
  const end =
    String(opts.tourEndDate || hub.end_date || hub.tour_date || "").slice(
      0,
      10
    ) || "";
  try {
    const tix = await ensureTicketsRow(pb, pnr);
    await pb.collection("ops_tickets").update(
      tix.id,
      {
        tour_end_date: end || tix.tour_end_date || "",
        voucher_filename: uploaded.filename,
        // Clear legacy PB file field — binaries live on local disk now
        voucher_pdf: null,
      },
      { requestKey: null }
    );
  } catch {
    /* optional silo */
  }

  const voucher = itemVoucher(next);
  if (!voucher) throw new Error("Upload succeeded but URL missing");
  return { item: next, voucher, services };
}

export async function clearExpiredTicketVouchers(opts?: {
  /** ISO day YYYY-MM-DD — purge when tour date is strictly before this */
  cutoffIsoDay?: string;
}): Promise<{
  scannedHubs: number;
  clearedItems: number;
  deletedBlobs: number;
}> {
  const cutoff =
    opts?.cutoffIsoDay ||
    (() => {
      const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();

  const pb = await getAdminPocketBase();
  // tour_date / end_date older than cutoff (tour + 2 days already baked into cutoff)
  const hubs = await pb.collection("ops_hub").getFullList<{
    id: string;
    pnr?: string;
    extras?: unknown;
    tour_date?: string;
    end_date?: string;
  }>({
    filter: `(tour_date != "" && tour_date < "${cutoff}") || (end_date != "" && end_date < "${cutoff}")`,
    fields: "id,pnr,extras,tour_date,end_date",
    requestKey: null,
  });

  let clearedItems = 0;
  let deletedBlobs = 0;

  for (const hub of hubs) {
    const extras = parseOpsHubExtras(hub.extras);
    const services = extras.agent_services || [];
    let changed = false;
    const nextServices = services.map((raw) => {
      const item = normalizeServiceLineItem(raw) || raw;
      if (!item.voucherUrl && !item.voucherBlobPathname) return item;
      changed = true;
      clearedItems += 1;
      return {
        ...item,
        voucherUrl: undefined,
        voucherFilename: undefined,
        voucherBlobPathname: undefined,
        fulfillmentStatus:
          item.fulfillmentStatus === "READY" ? "PENDING" : item.fulfillmentStatus,
      };
    });

    for (const item of services) {
      const target = item.voucherBlobPathname || item.voucherUrl;
      if (!target) continue;
      await deleteBlobByUrlOrPathname(target);
      deletedBlobs += 1;
    }

    if (changed) {
      const nextExtras = mergeExtrasPatch(hub.extras, {
        agent_services: nextServices.map(
          (s) => normalizeServiceLineItem(s) || s
        ),
      });
      // Strip undefined voucher keys so JSON does not keep stale URLs
      const cleanedServices = (nextExtras.agent_services as ServiceLineItem[]).map(
        (s) => {
          const copy = { ...s };
          delete copy.voucherUrl;
          delete copy.voucherFilename;
          delete copy.voucherBlobPathname;
          return copy;
        }
      );
      await pb.collection("ops_hub").update(
        hub.id,
        {
          extras: { ...nextExtras, agent_services: cleanedServices },
        },
        { requestKey: null }
      );
    }
  }

  // Legacy PB file field cleanup
  try {
    const legacy = await pb.collection("ops_tickets").getFullList<{
      id: string;
      voucher_pdf?: string;
    }>({
      filter: `tour_end_date != "" && tour_end_date < "${cutoff}" && voucher_pdf != ""`,
      fields: "id,voucher_pdf",
      requestKey: null,
    });
    for (const row of legacy) {
      await pb.collection("ops_tickets").update(
        row.id,
        { voucher_pdf: null, voucher_filename: "" },
        { requestKey: null }
      );
    }
  } catch {
    /* optional */
  }

  return {
    scannedHubs: hubs.length,
    clearedItems,
    deletedBlobs,
  };
}
