import PocketBase from "pocketbase";

/**
 * Server-only PocketBase client authenticated as admin.
 * Used for PNR uniqueness checks and email+PNR itinerary retrieval.
 *
 * Prefer the Docker-internal URL so auth does not depend on public nginx.
 */
export async function getAdminPocketBase(): Promise<PocketBase> {
  const url =
    process.env.POCKETBASE_INTERNAL_URL?.trim() ||
    process.env.POCKETBASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim() ||
    process.env.PUBLIC_URL?.trim() ||
    "http://127.0.0.1:8090";

  const email = process.env.PB_ADMIN_EMAIL?.trim();
  const password = process.env.PB_ADMIN_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error(
      "PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set for itinerary APIs."
    );
  }

  const pb = new PocketBase(url);
  pb.autoCancellation(false);

  try {
    await pb.collection("_superusers").authWithPassword(email, password);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `PocketBase admin auth failed against ${url}: ${msg}. ` +
        `After pb:push, run: docker exec elite-pocketbase ./pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD"`
    );
  }

  return pb;
}
