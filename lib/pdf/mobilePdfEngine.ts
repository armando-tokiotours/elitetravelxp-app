/**
 * Mobile-first PDF via headless Chromium (Puppeteer).
 * Page size ~430px wide for iPhone viewing; printBackground keeps dark theme.
 *
 * VPS safety: single-flight queue so concurrent email/PDF jobs cannot spawn
 * multiple Chromium pages and thrash a small host.
 */

import puppeteer, { type Browser } from "puppeteer-core";
import {
  chromiumLaunchArgs,
  resolveChromiumExecutable,
} from "@/lib/pdf/chromium";

const MOBILE_WIDTH_PX = 430;
/** 1.5 balances sharpness vs VPS RAM (was 2). */
const DEVICE_SCALE = 1.5;

let sharedBrowser: Browser | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.connected) return sharedBrowser;

  const executablePath = resolveChromiumExecutable();
  if (!executablePath) {
    throw new Error(
      "Chromium not found. Install Chrome locally or set PUPPETEER_EXECUTABLE_PATH (Docker: /usr/bin/chromium-browser)."
    );
  }

  sharedBrowser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: chromiumLaunchArgs(),
    protocolTimeout: 90_000,
  });
  return sharedBrowser;
}

async function htmlToMobilePdfUnqueued(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: MOBILE_WIDTH_PX,
      height: 932,
      deviceScaleFactor: DEVICE_SCALE,
    });
    await page.emulateMediaType("screen");
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await new Promise((r) => setTimeout(r, 80));

    const pdf = await page.pdf({
      width: `${MOBILE_WIDTH_PX}px`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Serialize Chromium work — max one PDF page at a time on the VPS. */
export function htmlToMobilePdf(html: string): Promise<Buffer> {
  const run = queue.then(() => htmlToMobilePdfUnqueued(html));
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function mobilePdfAvailable(): boolean {
  return Boolean(resolveChromiumExecutable());
}
