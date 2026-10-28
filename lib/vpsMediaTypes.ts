/**
 * Client-safe VPS media types / folder constants (no Node fs).
 */

export const VPS_MEDIA_FOLDERS = [
  "tickets",
  "vouchers",
  "comms",
  "catalog",
  "profiles",
  "general",
  "hero-panels",
  "branding",
] as const;

export type VpsMediaFolder = (typeof VPS_MEDIA_FOLDERS)[number];

export type VpsMediaFile = {
  fileName: string;
  folder: string;
  url: string;
  sizeBytes: number;
  updatedAt: string;
  isImage: boolean;
  isVideo: boolean;
  isPdf: boolean;
};

export function isAllowedMediaFolder(folder: string): folder is VpsMediaFolder {
  return (VPS_MEDIA_FOLDERS as readonly string[]).includes(folder);
}
