import type { ReactNode } from "react";
import { AppNavDock } from "@/components/navigation/AppNavDock";

export default function BuilderSingleLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <AppNavDock context="SINGLE" />
      {/* Rail is lg-only (w-16); below lg the top chrome + bottom dock own nav, so no left reserve. pl-16 exactly matches the rail — no dead gutter. */}
      <main className="pb-20 lg:pb-0 lg:pl-16">{children}</main>
    </>
  );
}
