/**
 * Ticket voucher PDF helpers — ops_tickets.voucher_pdf + guest download URL.
 */

import type PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import { ensureTicketsRow, type OpsTicketsRow } from "@/lib/opsTickets";

export type OpsTicketsVoucherRow = OpsTicketsRow & {
  voucher_pdf?: string;
  voucher_filename?: string;
  tour_end_date?: string;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

export function voucherPublicUrl(
  pb: PocketBase,
  row: OpsTicketsVoucherRow
): string | null {
  const file = String(row.voucher_pdf || "").trim();
  if (!file || !row.id) return null;
  try {
    return pb.files.getURL(row as never, file);
  } catch {
    return null;
  }
}

export async function loadTicketVoucherByPnr(
  pnrRaw: string
): Promise<{
  pnr: string;
  filename: string;
  url: string | null;
  tourEndDate: string | null;
} | null> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) return null;
  try {
    const pb = await getAdminPocketBase();
    const row = await pb
      .collection("ops_tickets")
      .getFirstListItem<OpsTicketsVoucherRow>(`pnr="${pnr}"`, {
        requestKey: null,
      });
    const file = String(row.voucher_pdf || "").trim();
    if (!file) return null;
    return {
      pnr,
      filename:
        String(row.voucher_filename || "").trim() ||
        "TokioTours_Ticket_Vouchers.pdf",
      url: voucherPublicUrl(pb, row),
      tourEndDate: String(row.tour_end_date || "").slice(0, 10) || null,
    };
  } catch {
    return null;
  }
}

export async function uploadTicketVoucher(opts: {
  pnr: string;
  file: File | Blob;
  filename?: string;
  tourEndDate?: string | null;
}): Promise<OpsTicketsVoucherRow> {
  const pnr = safePnr(opts.pnr);
  if (!pnr) throw new Error("pnr required");
  const pb = await getAdminPocketBase();
  const row = await ensureTicketsRow(pb, pnr);
  const form = new FormData();
  const name =
    String(opts.filename || "").trim() ||
    (opts.file instanceof File ? opts.file.name : "tickets.pdf");
  form.append("voucher_pdf", opts.file, name);
  form.append("voucher_filename", name.slice(0, 240));
  const end = String(opts.tourEndDate || "").slice(0, 10);
  if (end) form.append("tour_end_date", end);

  return (await pb
    .collection("ops_tickets")
    .update(row.id, form, { requestKey: null })) as OpsTicketsVoucherRow;
}
