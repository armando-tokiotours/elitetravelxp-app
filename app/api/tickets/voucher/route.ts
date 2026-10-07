import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  listTicketCartItemsForPnr,
  loadTicketVouchersByPnr,
  uploadTicketVoucherForItem,
} from "@/lib/ticketVouchers";
import { ticketStorageReady } from "@/lib/blobStorage";

/**
 * GET ?pnr= — guest/ops: list per-item voucher download URLs from agent_services.
 * POST multipart (pnr, itemId, ticket_pdf, tour_end_date?) — Ops upload to local disk
 * under public/uploads/tickets (URL: /uploads/tickets/...).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = String(searchParams.get("pnr") || "").trim();
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }

    const includeCart = searchParams.get("cart") === "1";
    const packed = await loadTicketVouchersByPnr(pnr);
    const first = packed.vouchers[0] || null;

    let cartItems: unknown[] | undefined;
    if (includeCart) {
      const cart = await listTicketCartItemsForPnr(pnr);
      cartItems = cart.items.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        quantity: item.quantity ?? 1,
        voucherUrl: item.voucherUrl || null,
        voucherFilename: item.voucherFilename || null,
        fulfillmentStatus: item.fulfillmentStatus || null,
      }));
    }

    return NextResponse.json({
      ok: true,
      storageReady: ticketStorageReady(),
      vouchers: packed.vouchers,
      /** First voucher for legacy single-banner callers */
      voucher: first
        ? {
            pnr: packed.pnr,
            filename: first.filename,
            url: first.url,
            tourEndDate: packed.tourEndDate,
            itemId: first.itemId,
            title: first.title,
          }
        : null,
      tourEndDate: packed.tourEndDate,
      cartItems,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const pnr = String(form.get("pnr") || "").trim();
    const itemId = String(form.get("itemId") || form.get("item_id") || "").trim();
    const file = form.get("ticket_pdf") || form.get("voucher_pdf") || form.get("file");
    let tourEndDate = String(form.get("tour_end_date") || "").slice(0, 10);

    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    if (!itemId) {
      return NextResponse.json(
        {
          error:
            "itemId required — upload a PDF per invoice ticket/pass line, not a single generic file",
        },
        { status: 400 }
      );
    }
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json(
        { error: "PDF file required (ticket_pdf)" },
        { status: 400 }
      );
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF vouchers are accepted" },
        { status: 400 }
      );
    }

    if (!tourEndDate) {
      try {
        const pb = await getAdminPocketBase();
        const hub = await pb
          .collection("ops_hub")
          .getFirstListItem<{ tour_date?: string; end_date?: string }>(
            `pnr="${pnr.replace(/"/g, "").toUpperCase()}"`,
            { requestKey: null }
          );
        tourEndDate = String(hub.end_date || hub.tour_date || "").slice(0, 10);
      } catch {
        /* optional */
      }
    }

    const result = await uploadTicketVoucherForItem({
      pnr,
      itemId,
      file,
      filename: file.name,
      tourEndDate: tourEndDate || null,
    });

    const packed = await loadTicketVouchersByPnr(pnr);
    return NextResponse.json({
      ok: true,
      voucher: result.voucher,
      vouchers: packed.vouchers,
      item: {
        id: result.item.id,
        title: result.item.title,
        voucherUrl: result.item.voucherUrl,
        voucherFilename: result.item.voucherFilename,
        fulfillmentStatus: result.item.fulfillmentStatus,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
