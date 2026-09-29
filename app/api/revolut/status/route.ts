import { NextResponse } from "next/server";
import { getRevolutMerchantSecret, getRevolutMode } from "@/lib/revolutEnv";

/** Public: whether Revolut Merchant secret is configured (no secrets leaked). */
export async function GET() {
  const configured = Boolean(getRevolutMerchantSecret());
  return NextResponse.json({
    configured,
    mode: getRevolutMode(),
  });
}
