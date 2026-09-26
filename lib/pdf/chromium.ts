/**
 * Resolve Chromium for mobile PDF (Puppeteer).
 * Local: Chrome / Chromium install. VPS Docker: apk chromium + env path.
 */

import fs from "fs";

const CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROMIUM_PATH,
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter(Boolean) as string[];

export function resolveChromiumExecutable(): string | null {
  for (const p of CANDIDATES) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* continue */
    }
  }
  return null;
}

export function chromiumLaunchArgs(): string[] {
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--font-render-hinting=none",
  ];
}
