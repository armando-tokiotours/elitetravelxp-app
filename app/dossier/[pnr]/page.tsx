import { redirect } from "next/navigation";
import { normalizeBookingPNR } from "@/utils/pnr";

/** Live booking pass — never serve a stale cached shell. */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Canonical guest dossier pass:
 * /dossier/JPN-XXXXXX?email=…
 * Opens the manage/retrieve flow (cache: no-store).
 */
export default async function DossierPassPage({
  params,
  searchParams,
}: {
  params: Promise<{ pnr?: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { pnr: rawPnr } = await params;
  const { email: rawEmail } = await searchParams;
  const pnr = normalizeBookingPNR(decodeURIComponent(String(rawPnr || "")));
  const email = String(rawEmail || "")
    .trim()
    .toLowerCase();
  const q = new URLSearchParams();
  if (pnr) q.set("pnr", pnr);
  if (email) q.set("email", email);
  redirect(`/manage?${q.toString()}`);
}
