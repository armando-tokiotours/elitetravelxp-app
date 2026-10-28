"use client";

import type { ReactNode } from "react";
import { CurrencyProvider } from "@/components/providers/CurrencyProvider";
import { GoogleTranslateScript } from "@/components/i18n/GoogleTranslateScript";
import { CurtainWipe } from "@/components/navigation/CurtainWipe";

/** Client providers mounted once from the root layout. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <CurrencyProvider>
      {children}
      <GoogleTranslateScript />
      <CurtainWipe />
    </CurrencyProvider>
  );
}
