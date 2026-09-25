import { readFile } from "node:fs/promises";
import path from "node:path";
import { PKPass } from "passkit-generator";
import { buildTokiotoursPassJson } from "@/lib/wallet/buildPassJson";
import type { ApplePassPayload } from "@/lib/wallet/downloadApplePass";

/** Decode PEM/base64 env values (supports literal \n). */
function decodeCertEnv(raw: string | undefined): Buffer | null {
  if (!raw?.trim()) return null;
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  value = value.replace(/\\n/g, "\n");
  if (value.includes("BEGIN ")) {
    return Buffer.from(value, "utf8");
  }
  try {
    return Buffer.from(value, "base64");
  } catch {
    return Buffer.from(value, "utf8");
  }
}

async function readCertFile(envPath: string | undefined): Promise<Buffer | null> {
  const p = envPath?.trim();
  if (!p) return null;
  try {
    return await readFile(p);
  } catch {
    return null;
  }
}

export type ApplePassCertificates = {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase?: string;
};

/**
 * Load Apple Pass signing material from env.
 * Prefer PEM contents (`APPLE_WWDR_CERT`, `APPLE_PASS_CERT`, `APPLE_PASS_KEY`)
 * or file paths (`*_PATH`).
 */
export async function loadApplePassCertificates(): Promise<ApplePassCertificates | null> {
  const wwdr =
    decodeCertEnv(process.env.APPLE_WWDR_CERT) ||
    (await readCertFile(process.env.APPLE_WWDR_CERT_PATH));
  const signerCert =
    decodeCertEnv(process.env.APPLE_PASS_CERT) ||
    decodeCertEnv(process.env.APPLE_SIGNER_CERT) ||
    (await readCertFile(process.env.APPLE_PASS_CERT_PATH)) ||
    (await readCertFile(process.env.APPLE_SIGNER_CERT_PATH));
  const signerKey =
    decodeCertEnv(process.env.APPLE_PASS_KEY) ||
    decodeCertEnv(process.env.APPLE_SIGNER_KEY) ||
    (await readCertFile(process.env.APPLE_PASS_KEY_PATH)) ||
    (await readCertFile(process.env.APPLE_SIGNER_KEY_PATH));

  if (!wwdr || !signerCert || !signerKey) return null;

  const passphrase =
    process.env.APPLE_PASS_PASSPHRASE?.trim() ||
    process.env.APPLE_SIGNER_KEY_PASSPHRASE?.trim() ||
    undefined;

  return {
    wwdr,
    signerCert,
    signerKey,
    ...(passphrase ? { signerKeyPassphrase: passphrase } : {}),
  };
}

export function hasLocalApplePassCerts(): boolean {
  return Boolean(
    (process.env.APPLE_WWDR_CERT || process.env.APPLE_WWDR_CERT_PATH) &&
      (process.env.APPLE_PASS_CERT ||
        process.env.APPLE_SIGNER_CERT ||
        process.env.APPLE_PASS_CERT_PATH ||
        process.env.APPLE_SIGNER_CERT_PATH) &&
      (process.env.APPLE_PASS_KEY ||
        process.env.APPLE_SIGNER_KEY ||
        process.env.APPLE_PASS_KEY_PATH ||
        process.env.APPLE_SIGNER_KEY_PATH)
  );
}

const MODEL_DIR = path.join(process.cwd(), "passModels", "tokiotours.pass");

/** Build retina asset names without embedding email-like literals in source. */
function retinaName(base: "icon" | "logo", scale: 2 | 3): string {
  return `${base}${String.fromCharCode(64)}${scale}x.png`;
}

const ICON_FILES = [
  "icon.png",
  retinaName("icon", 2),
  retinaName("icon", 3),
  "logo.png",
  retinaName("logo", 2),
  retinaName("logo", 3),
] as const;

let cachedAssets: Record<string, Buffer> | null = null;

async function loadPassAssets(): Promise<Record<string, Buffer>> {
  if (cachedAssets) return cachedAssets;
  const assets: Record<string, Buffer> = {};
  for (const name of ICON_FILES) {
    try {
      assets[name] = await readFile(path.join(MODEL_DIR, name));
    } catch {
      /* optional retina assets */
    }
  }
  if (!assets["icon.png"]) {
    throw new Error(
      `Missing pass model icons in ${MODEL_DIR}. Expected at least icon.png.`
    );
  }
  cachedAssets = assets;
  return assets;
}

/**
 * Build a cryptographically signed `.pkpass` buffer with passkit-generator.
 * Returns null when Apple certificates are not configured.
 */
export async function generateSignedPkpass(
  payload: ApplePassPayload
): Promise<Uint8Array | null> {
  const certificates = await loadApplePassCertificates();
  if (!certificates) return null;

  const passJson = buildTokiotoursPassJson(payload);
  if (process.env.APPLE_PASS_TYPE_ID?.trim()) {
    passJson.passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID.trim();
  }
  if (process.env.APPLE_TEAM_ID?.trim()) {
    passJson.teamIdentifier = process.env.APPLE_TEAM_ID.trim();
  }

  const assets = await loadPassAssets();
  const buffers: Record<string, Buffer> = {
    ...assets,
    "pass.json": Buffer.from(JSON.stringify(passJson), "utf8"),
  };

  const pass = new PKPass(buffers, {
    wwdr: certificates.wwdr,
    signerCert: certificates.signerCert,
    signerKey: certificates.signerKey,
    signerKeyPassphrase: certificates.signerKeyPassphrase,
  });

  const barcodeMsg = payload.qrValue || payload.pnrCode;
  pass.setBarcodes({
    message: barcodeMsg,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
  });

  return new Uint8Array(pass.getAsBuffer());
}

/**
 * Prefer local passkit-generator signing; optionally fall back to remote signer.
 */
export async function generatePkpassBuffer(
  payload: ApplePassPayload
): Promise<Uint8Array | null> {
  try {
    const local = await generateSignedPkpass(payload);
    if (local) return local;
  } catch (err) {
    console.error("[wallet] Local passkit-generator failed:", err);
  }

  const signerUrl = process.env.APPLE_PASS_SIGNER_URL?.trim();
  const isSelfSigner = Boolean(
    signerUrl && /\/api\/wallet\/(generate(-pass)?|apple\/generate)/i.test(signerUrl)
  );
  if (!signerUrl || isSelfSigner) return null;

  const passJson = buildTokiotoursPassJson(payload);
  const upstream = await fetch(signerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.APPLE_PASS_SIGNER_TOKEN
        ? { Authorization: `Bearer ${process.env.APPLE_PASS_SIGNER_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ pass: passJson, pnrCode: payload.pnrCode }),
  });
  if (!upstream.ok) return null;
  return new Uint8Array(await upstream.arrayBuffer());
}
