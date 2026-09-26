/**
 * Mobile-first PDF via headless Chromium (Puppeteer).
 * Page size ~430px wide for iPhone viewing; printBackground keeps dark theme.
 */

import puppeteer, { type Browser } from "puppeteer-core";
import {
  chromiumLaunchArgs,
  resolveChromiumExecutable,
} from "@/lib/pdf/chromium";

const MOBILE_WIDTH_PX = 430;
const DEVICE_SCALE = 2;

let sharedBrowser: Browser | null = null;

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
  });
  return sharedBrowser;
}

export async function htmlToMobilePdf(html: string): Promise<Buffer> {
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
    // Allow fonts / QR data-URLs to settle
    await new Promise((r) => setTimeout(r, 120));

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

export function mobilePdfAvailable(): boolean {
  return Boolean(resolveChromiumExecutable());
}
