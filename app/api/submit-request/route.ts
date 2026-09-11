import { NextResponse } from "next/server";

/**
 * Receives itinerary designer payloads for concierge follow-up.
 * Wire SMTP / CRM / webhook via env vars in production.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.clientEmail || typeof body.clientEmail !== "string") {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const email = String(body.clientEmail).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Log for ops / future email integration
    console.info("[itinerary-request]", {
      email,
      name: body.clientName,
      durationDays: body.durationDays,
      totalGuests: body.totalGuests,
      cities: body.cityNights,
      quoteMin: body.quotation?.min,
      quoteMax: body.quotation?.max,
      submittedAt: body.submittedAt,
    });

    // Optional webhook (e.g. Zapier, Make, Slack, transactional email)
    const webhook = process.env.ITINERARY_WEBHOOK_URL;
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch((err) => {
        console.error("[itinerary-webhook]", err);
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        "Your request has been received. Our concierge team will respond shortly.",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process this request." },
      { status: 500 }
    );
  }
}
