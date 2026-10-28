import { redirect } from "next/navigation";

/** Alias — canonical desk lives at /ops/money */
export default function OpsFinanceAliasPage() {
  redirect("/ops/money");
}
