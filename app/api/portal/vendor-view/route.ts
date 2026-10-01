import { NextResponse } from "next/server";
import { loadVendorViewByToken } from "@/lib/vendorDispatch";

/**
 * GET ?token= — sanitized vendor dispatch payload (no financials).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = String(searchParams.get("token") || "").trim();
    const result = await loadVendorViewByToken(token);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({ view: result.view });
  } catch (e) {
    const message = e instanceof Error ? e.message : "vendor view failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
