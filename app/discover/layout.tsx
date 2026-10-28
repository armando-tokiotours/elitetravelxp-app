import type { ReactNode } from "react";
import { BuilderNavDock } from "@/components/navigation/AppNavDock";

export default function DiscoverLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {/* Discover lives outside app/builder/layout.tsx, so it never got the
          magic menu — mount the same dock here. BuilderNavDock resolves
          /discover to SINGLE when tripMode is single_day (Discover item
          active), else BUILDER_E (Explore → /discover). */}
      <BuilderNavDock />
      {/* Same clearance as app/builder/layout.tsx: pb-20 clears the mobile
          bottom dock (<lg), lg:pl-16 reserves the desktop rail (w-16). */}
      <main className="pb-20 lg:pb-0 lg:pl-16">{children}</main>
    </>
  );
}
