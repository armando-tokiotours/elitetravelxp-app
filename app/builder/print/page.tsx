import { redirect } from "next/navigation";

/** Legacy print URL — summary page hosts dossier + invoice dual-view. */
export default function BuilderPrintPage() {
  redirect("/builder/itinerary?view=invoice");
}
