"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Global click guard:
 * - External http(s) links → “Leaving Tokiotours” confirm
 * - Does not hijack internal app navigation (builders must stay fast)
 */
export function AppLinkInterceptor() {
  const [externalHref, setExternalHref] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) {
        return;
      }
      const el = (e.target as Element | null)?.closest?.("a[href]");
      if (!el) return;
      const anchor = el as HTMLAnchorElement;
      if (anchor.dataset.allowExternal === "1") return;
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (href.startsWith("/") || href.startsWith("?")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin === window.location.origin) return;

      e.preventDefault();
      e.stopPropagation();
      setExternalHref(url.toString());
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!mounted || !externalHref) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-tokiotours-title"
    >
      <div className="glass-panel w-full max-w-sm rounded-3xl border border-white/15 bg-[#0A1017]/90 p-6 text-center text-white shadow-2xl">
        <p
          id="leave-tokiotours-title"
          className="font-godiva text-sm tracking-wide text-white uppercase"
        >
          Leaving Tokiotours Web Platform
        </p>
        <p className="mt-3 break-all text-xs text-white/55">{externalHref}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setExternalHref(null)}
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
          >
            Keep Open Here
          </button>
          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            data-allow-external="1"
            onClick={() => setExternalHref(null)}
            className="w-full rounded-xl bg-[#075473] py-2.5 text-xs font-bold uppercase tracking-wider text-white"
          >
            Open in New Tab →
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
