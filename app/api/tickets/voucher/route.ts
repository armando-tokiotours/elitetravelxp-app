import { NextResponse } from "next/server";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  loadTicketVoucherByPnr,
  uploadTicketVoucher,
} from "@/lib/ticketVouchers";

/**
 * GET ?pnr= — guest/ops: resolve voucher PDF download URL when present.
 * POST multipart (pnr, ticket_pdf, tour_end_date?) — staff upload.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pnr = String(searchParams.get("pnr") || "").trim();
    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
    }
    const voucher = await loadTicketVoucherByPnr(pnr);
    if (!voucher?.url) {
      return NextResponse.json({ ok: true, voucher: null });
    }
    return NextResponse.json({
      ok: true,
      voucher: {
        pnr: voucher.pnr,
        filename: voucher.filename,
        url: voucher.url,
        tourEndDate: voucher.tourEndDate,
      },
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
    const file = form.get("ticket_pdf") || form.get("voucher_pdf");
    let tourEndDate = String(form.get("tour_end_date") || "").slice(0, 10);

    if (!pnr) {
      return NextResponse.json({ error: "pnr required" }, { status: 400 });
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
          .getFirstListItem<{ tour_date?: string }>(
            `pnr="${pnr.replace(/"/g, "").toUpperCase()}"`,
            { requestKey: null }
          );
        tourEndDate = String(hub.tour_date || "").slice(0, 10);
      } catch {
        /* optional */
      }
    }

    const row = await uploadTicketVoucher({
      pnr,
      file,
      filename: file.name,
      tourEndDate: tourEndDate || null,
    });

    const voucher = await loadTicketVoucherByPnr(pnr);
    return NextResponse.json({
      ok: true,
      id: row.id,
      voucher,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
