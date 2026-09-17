import { NextResponse } from "next/server";
import {
  getRevolutMerchantApiBase,
  getRevolutMerchantSecret,
  getRevolutMode,
} from "@/lib/revolutEnv";

/**
 * Creates a Revolut Merchant order and returns the public checkout token.
 * Secret key never leaves the server.
 *
 * Sandbox when NEXT_PUBLIC_REVOLUT_MODE is unset or "sandbox":
 *   https://sandbox-merchant.revolut.com/api/orders
 * Live when NEXT_PUBLIC_REVOLUT_MODE is "live" or "prod":
 *   https://merchant.revolut.com/api/orders
 *
 * Env:
 *   REVOLUT_MERCHANT_SECRET_KEY — Merchant API secret (preferred)
 *   REVOLUT_SECRET_KEY          — Legacy alias
 *   REVOLUT_API_VERSION         — e.g. 2024-09-01 (optional)
 *   NEXT_PUBLIC_REVOLUT_MODE    — "sandbox" | "live" | "prod"
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const amountMajor = Number(body?.amount);
    const currency = String(body?.currency || "EUR").toUpperCase();
    const bookingRef = String(body?.bookingRef || "").trim();
    // Accept both camelCase (modal) and short names (docs sample)
    const customerEmail = String(
      body?.customerEmail || body?.email || ""
    ).trim();
    const customerName = String(body?.customerName || body?.name || "").trim();
    const customerPhone = String(
      body?.customerPhone || body?.phone || ""
    ).trim();
    const paymentType = String(body?.paymentType || "deposit");
    const description = String(
      body?.description ||
        `Deposit/Payment for Booking ${bookingRef} (${customerName} - ${customerPhone})`
    ).trim();

    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      );
    }
    if (!bookingRef) {
      return NextResponse.json(
        { error: "bookingRef is required." },
        { status: 400 }
      );
    }
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json(
        { error: "Contact details (Email, Name, Phone) are required" },
        { status: 400 }
      );
    }
    if (!customerName) {
      return NextResponse.json(
        { error: "Contact details (Email, Name, Phone) are required" },
        { status: 400 }
      );
    }
    if (!customerPhone || customerPhone.replace(/\D/g, "").length < 7) {
      return NextResponse.json(
        { error: "Contact details (Email, Name, Phone) are required" },
        { status: 400 }
      );
    }

    const secret = getRevolutMerchantSecret();
    if (!secret) {
      return NextResponse.json(
        {
          error:
            "Payments are not configured yet. Set REVOLUT_MERCHANT_SECRET_KEY on the server.",
          code: "REVOLUT_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const mode = getRevolutMode(); // "sandbox" unless live/prod
    const base = getRevolutMerchantApiBase(mode);
    const apiVersion =
      process.env.REVOLUT_API_VERSION?.trim() || "2024-09-01";

    // Revolut amounts are minor units (cents)
    const amountMinor = Math.round(amountMajor * 100);

    const payload: Record<string, unknown> = {
      amount: amountMinor,
      currency,
      capture_mode: "automatic",
      merchant_order_data: {
        reference: bookingRef,
      },
      description: description.slice(0, 2000),
      customer: {
        email: customerEmail,
        full_name: customerName,
        phone: customerPhone,
      },
      metadata: {
        bookingRef,
        paymentType,
        customerPhone,
        customerName,
        customerEmail,
        revolutMode: mode,
      },
    };

    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "Revolut-Api-Version": apiVersion,
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      console.error("[revolut/create-order]", mode, res.status, data);
      return NextResponse.json(
        {
          error:
            (typeof data.message === "string" && data.message) ||
            (mode === "sandbox"
              ? "Revolut Sandbox Order Error"
              : "Could not create Revolut order."),
          details: data,
          mode,
        },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      );
    }

    const token =
      (typeof data.token === "string" && data.token) ||
      (typeof data.public_id === "string" && data.public_id) ||
      "";

    if (!token) {
      return NextResponse.json(
        { error: "Revolut order response missing checkout token." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      token,
      public_id: data.id ?? null,
      orderId: data.id ?? null,
      mode,
      amount: amountMajor,
      amountMinor,
      currency,
      bookingRef,
    });
  } catch (e) {
    console.error("[revolut/create-order]", e);
    const message =
      e instanceof Error ? e.message : "Unable to create payment order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
