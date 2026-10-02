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
      <main className="pb-20 sm:pb-0 sm:pl-20">{children}</main>
    </>
  );
}
