"use client";

import { useEffect } from "react";
import { BRAND_DESCRIPTION, BRAND_TITLE } from "@/lib/brand";
import { fetchSiteBranding } from "@/lib/pocketbase/client";

/**
 * Applies Team Brand Configuration → document_title / document_description
 * to the browser tab and meta description (falls back to lib/brand defaults).
 */
export function BrandDocumentMeta() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const row = await fetchSiteBranding();
      if (cancelled) return;

      const title = (row?.document_title || "").trim() || BRAND_TITLE;
      const description =
        (row?.document_description || "").trim() || BRAND_DESCRIPTION;

      document.title = title;

      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", description);

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", title);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", description);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
