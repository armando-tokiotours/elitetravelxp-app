import type { ReactNode } from "react";
import { BuilderNavDock } from "@/components/navigation/AppNavDock";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Dynamic: /builder/** hosts japan-journey, day-pass and vip-access.
          BuilderNavDock picks SINGLE / MULTIDAY / BUILDER_E from the route
          + active booking tripMode instead of forcing MULTIDAY. */}
      <BuilderNavDock />
      {/* Rail is lg-only (w-16); below lg the top chrome + bottom dock own nav, so no left reserve. pl-16 exactly matches the rail — no dead gutter. */}
      <main className="pb-20 lg:pb-0 lg:pl-16">{children}</main>
    </>
  );
}
