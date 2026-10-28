/**
 * Browser helper: upload a File to /api/upload and get /uploads/... URL.
 */

export type VpsUploadFolder =
  | "tickets"
  | "vouchers"
  | "comms"
  | "catalog"
  | "profiles"
  | "general"
  | "hero-panels"
  | "branding";

export async function uploadToVps(
  file: File,
  folder: VpsUploadFolder,
  token: string,
  opts?: {
    /**
     * Stable slot key (e.g. "hero-panel-p1"): server overwrites the same
     * file in place, so the returned URL never changes across re-uploads.
     */
    stableKey?: string;
  }
): Promise<{
  url: string;
  fileName: string;
  size: number;
  mimeType: string;
  mobileUrl?: string;
}> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  if (opts?.stableKey) fd.append("stableKey", opts.stableKey);

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
    fileName?: string;
    size?: number;
    mimeType?: string;
    mobileUrl?: string;
  };

  if (!res.ok || !data.url) {
    throw new Error(data.error || `Upload failed (${res.status})`);
  }

  return {
    url: data.url,
    fileName: data.fileName || file.name,
    size: data.size || file.size,
    mimeType: data.mimeType || file.type,
    mobileUrl: data.mobileUrl || undefined,
  };
}
