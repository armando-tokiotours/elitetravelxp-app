"use client";

import { useEffect, useState } from "react";

/** Keep a dynamically-imported modal mounted after first open so exit animations can finish. */
export function useLazyModalMount(open: boolean): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  return mounted;
}
