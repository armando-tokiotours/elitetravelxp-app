import PocketBase from "pocketbase";

function envVal(key: string): string | undefined {
  const raw = process.env[key]?.trim();
  if (!raw) return undefined;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim() || undefined;
  }
  return raw;
}

/**
 * Server-only PocketBase client authenticated as admin.
 * Used for PNR uniqueness checks and email+PNR itinerary retrieval.
 *
 * Prefer the Docker-internal URL so auth does not depend on public nginx.
 */
export async function getAdminPocketBase(): Promise<PocketBase> {
  const url =
    envVal("POCKETBASE_INTERNAL_URL") ||
    envVal("POCKETBASE_URL") ||
    envVal("NEXT_PUBLIC_POCKETBASE_URL") ||
    envVal("PUBLIC_URL") ||
    "http://pocketbase:8090";

  const email =
    envVal("PB_ADMIN_EMAIL") || "admin@travelexperiencesgroup.com";
  const password =
    envVal("PB_ADMIN_PASSWORD") || "EliteTravelAdmin2026!";

  const pb = new PocketBase(url);
  pb.autoCancellation(false);

  try {
    await pb.collection("_superusers").authWithPassword(email, password);
  } catch (err) {
    console.error(
      "PocketBase Admin Auth Warning: Ensure superuser upsert script has executed.",
      err
    );
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `PocketBase admin auth failed against ${url}: ${msg}. ` +
        `After pb:push, run: docker exec elite-pocketbase ./pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"`
    );
  }

  return pb;
}
