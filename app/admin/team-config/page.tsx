import { redirect } from "next/navigation";

/** Email settings live under /admin?tab=email (private dashboard tab). */
export default function TeamConfigRedirectPage() {
  redirect("/admin?tab=email");
}
