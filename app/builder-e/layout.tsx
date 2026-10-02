import type { ReactNode } from "react";
import { AppNavDock } from "@/components/navigation/AppNavDock";

export default function BuilderELayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNavDock context="BUILDER_E" />
      <main className="pb-20 sm:pb-0 sm:pl-20">{children}</main>
    </>
  );
}
