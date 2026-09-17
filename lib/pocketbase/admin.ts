import PocketBase from "pocketbase";

/**
 * Server-only PocketBase client authenticated as admin.
 * Used for PNR uniqueness checks and email+PNR itinerary retrieval.
 */
export async function getAdminPocketBase(): Promise<PocketBase> {
  const url =
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    process.env.PUBLIC_URL ||
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
  await pb.collection("_superusers").authWithPassword(email, password);
  return pb;
}
