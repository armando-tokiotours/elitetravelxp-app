/**
 * Credential / profile photos — small 3:4 JPEG for fast load.
 * Display via /api/staff/avatar so PocketBase auth rules don't blank <img>.
 */

export const CREDENTIAL_PHOTO = {
  width: 360,
  height: 480,
  quality: 0.82,
  maxBytes: 180_000,
} as const;

export function staffAvatarSrc(
  staffId: string | null | undefined,
  opts?: { updated?: string | null; photo?: string | null }
): string | null {
  const id = String(staffId || "").trim();
  if (!id) return null;
  if (opts && "photo" in (opts || {}) && !String(opts?.photo || "").trim()) {
    return null;
  }
  const v = String(opts?.updated || opts?.photo || Date.now())
    .replace(/[^\w.-]/g, "")
    .slice(0, 40);
  return `/api/staff/avatar/${encodeURIComponent(id)}${v ? `?v=${encodeURIComponent(v)}` : ""}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo. Use JPG or PNG."));
    };
    img.src = url;
  });
}

export type CroppedAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not read that photo. Use JPG or PNG."));
    img.src = src;
  });
}

/**
 * Draw a user-positioned 1:1 crop region onto a 480×480 JPEG.
 * Do NOT pass the result through optimizeCredentialPhoto — that would
 * re-crop to portrait and undo the user's positioning.
 */
export async function getCroppedSquareFile(
  imageSrc: string,
  areaPixels: CroppedAreaPixels
): Promise<File> {
  if (!imageSrc) throw new Error("Choose a photo first.");
  const { x, y, width, height } = areaPixels;
  if (!width || !height) throw new Error("Photo has no dimensions.");

  const img = await loadImageFromSrc(imageSrc);

  const size = 480;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process photo.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x, y, width, height, 0, 0, size, size);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode JPEG."))),
      "image/jpeg",
      0.85
    );
  });
  return new File([blob], `avatar-${Date.now()}.jpg`, {
    type: "image/jpeg",
  });
}

/** Cover-crop to passport 360×480 JPEG (fast, PB-safe mime). */
export async function optimizeCredentialPhoto(file: File): Promise<File> {
  if (!file || file.size === 0) throw new Error("Choose a photo first.");
  const { width, height, quality } = CREDENTIAL_PHOTO;
  let bitmap: HTMLImageElement | ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file);
    }
  } catch {
    bitmap = null;
  }
  const src = bitmap || (await loadImage(file));
  const sw = "width" in src ? src.width : (src as HTMLImageElement).naturalWidth;
  const sh =
    "height" in src ? src.height : (src as HTMLImageElement).naturalHeight;
  if (!sw || !sh) throw new Error("Photo has no dimensions.");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process photo.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = Math.max(width / sw, height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, (width - dw) / 2, (height - dh) / 2, dw, dh);
  if ("close" in src && typeof src.close === "function") src.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode JPEG."))),
      "image/jpeg",
      quality
    );
  });
  const name = `credential-${Date.now()}.jpg`;
  return new File([blob], name, { type: "image/jpeg" });
}
