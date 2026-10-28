"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearAliasSession,
  readAliasSession,
  syncAliasFromLocationSearch,
  writeAliasSession,
  type AliasSession,
} from "@/lib/aliasMode";

/** Sync URL → sessionStorage on mount; keep React state in sync. */
export function useAliasSession() {
  const [alias, setAliasState] = useState<AliasSession | null>(null);

  const refresh = useCallback(() => {
    setAliasState(syncAliasFromLocationSearch() ?? readAliasSession());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setAlias = useCallback((next: AliasSession | null) => {
    if (!next) {
      clearAliasSession();
      setAliasState(null);
      return;
    }
    writeAliasSession(next);
    setAliasState(next);
  }, []);

  const clearAlias = useCallback(() => {
    clearAliasSession();
    setAliasState(null);
  }, []);

  return { alias, setAlias, clearAlias, refresh };
}
