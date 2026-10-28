/**
 * Public FX snapshot for CEO dashboard — no API keys / .env secrets.
 * Source: @fawazahmed0/currency-api (CDN + Cloudflare mirror), free & keyless.
 * Cached in-memory ~15 minutes.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ForexPair = {
  pair: string;
  rate: number;
  changePct: number | null;
  base: string;
  quote: string;
};

type ForexCache = {
  at: number;
  pairs: ForexPair[];
  source: string;
  asOf: string;
  approximate: boolean;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: ForexCache | null = null;

function ymdUtc(d: Date): string {
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function fetchCurrencyJson(
  date: "latest" | string,
  currency: "eur" | "usd"
): Promise<Record<string, number> | null> {
  const tag = date === "latest" ? "latest" : date;
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/${currency}.min.json`,
    `https://${tag}.currency-api.pages.dev/v1/currencies/${currency}.min.json`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;
      const block = json[currency];
      if (block && typeof block === "object") {
        return block as Record<string, number>;
      }
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

function pctChange(today: number, yesterday: number | null | undefined): number | null {
  if (yesterday == null || !Number.isFinite(yesterday) || yesterday === 0)
    return null;
  if (!Number.isFinite(today) || today <= 0) return null;
  return Math.round(((today - yesterday) / yesterday) * 10000) / 100;
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({
        ok: true,
        cached: true,
        ...cache,
        fetchedAt: new Date(cache.at).toISOString(),
      });
    }

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const ymd = ymdUtc(yesterday);

    const [eurLatest, usdLatest, eurPrev, usdPrev] = await Promise.all([
      fetchCurrencyJson("latest", "eur"),
      fetchCurrencyJson("latest", "usd"),
      fetchCurrencyJson(ymd, "eur"),
      fetchCurrencyJson(ymd, "usd"),
    ]);

    if (!eurLatest || !usdLatest) {
      return NextResponse.json(
        {
          ok: false,
          error: "Public FX feed unavailable",
          pairs: [],
        },
        { status: 502 }
      );
    }

    const eurJpy = Number(eurLatest.jpy) || 0;
    const usdCop = Number(usdLatest.cop) || 0;
    const eurCop = Number(eurLatest.cop) || 0;

    const pairs: ForexPair[] = [
      {
        pair: "EUR/JPY",
        base: "EUR",
        quote: "JPY",
        rate: eurJpy,
        changePct: pctChange(eurJpy, Number(eurPrev?.jpy) || null),
      },
      {
        pair: "USD/COP",
        base: "USD",
        quote: "COP",
        rate: usdCop,
        changePct: pctChange(usdCop, Number(usdPrev?.cop) || null),
      },
      {
        pair: "EUR/COP",
        base: "EUR",
        quote: "COP",
        rate: eurCop,
        changePct: pctChange(eurCop, Number(eurPrev?.cop) || null),
      },
    ].filter((p) => p.rate > 0);

    cache = {
      at: now,
      pairs,
      source: "@fawazahmed0/currency-api (jsDelivr / Cloudflare)",
      asOf: new Date().toISOString().slice(0, 10),
      approximate: false,
    };

    return NextResponse.json({
      ok: true,
      cached: false,
      ...cache,
      fetchedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[ops/forex]", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to fetch FX rates",
        pairs: [],
      },
      { status: 500 }
    );
  }
}
