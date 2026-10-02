import type { ReactNode } from "react";
import { AppNavDock } from "@/components/navigation/AppNavDock";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNavDock context="MULTIDAY" />
      <main className="pb-20 sm:pb-0 sm:pl-20">{children}</main>
    </>
  );
}
