import { redirect } from "next/navigation";

/** Email settings live under Team Access → Email Settings. */
export default function TeamConfigRedirectPage() {
  redirect("/team-access");
}
