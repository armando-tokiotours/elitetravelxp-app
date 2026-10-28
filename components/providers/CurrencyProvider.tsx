"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CURRENCY_STORAGE_KEY,
  formatPriceInCurrency,
  isDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/currency";

type CurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
  /** Format an amount stored in EUR using the active display currency. */
  formatPrice: (amountInEur: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readStoredCurrency(): DisplayCurrency {
  if (typeof window === "undefined") return "EUR";
  try {
    const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (isDisplayCurrency(raw)) return raw;
  } catch {
    /* private mode / blocked storage */
  }
  return "EUR";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("EUR");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCurrencyState(readStoredCurrency());
    setHydrated(true);
  }, []);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const formatPrice = useCallback(
    (amountInEur: number) => formatPriceInCurrency(amountInEur, currency),
    [currency]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency: hydrated ? currency : "EUR",
      setCurrency,
      formatPrice,
    }),
    [currency, formatPrice, hydrated, setCurrency]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}

/** Safe fallback when a tree may render outside the provider (e.g. tests). */
export function useCurrencyOptional(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;
  return {
    currency: "EUR",
    setCurrency: () => {},
    formatPrice: (amountInEur: number) =>
      formatPriceInCurrency(amountInEur, "EUR"),
  };
}
