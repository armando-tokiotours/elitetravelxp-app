"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { buildFaqHref } from "@/lib/faqReturn";

export interface FaqLinkProps {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  target?: string;
  rel?: string;
  ariaCurrent?: "page";
}

/**
 * Link to `/faq` that carries the current path + query as `?from=…`, so the
 * FAQ Back button can return the visitor (incl. dossier/itinerary pages
 * carrying `?ref=JPN-…`) to exactly where they came from.
 *
 * Uses `useSearchParams`, so render it via {@link FaqLinkSuspense} (or inside
 * an existing Suspense boundary) to avoid opting host pages into dynamic
 * rendering.
 */
export function FaqLink({ className, children, onClick, title, target, rel, ariaCurrent }: FaqLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const current = pathname ? `${pathname}${query ? `?${query}` : ""}` : null;

  return (
    <Link
      href={buildFaqHref(current)}
      className={className}
      onClick={onClick}
      title={title}
      target={target}
      rel={rel}
      aria-current={ariaCurrent}
    >
      {children}
    </Link>
  );
}

/** Suspense-wrapped {@link FaqLink} with a plain `/faq` link as fallback. */
export function FaqLinkSuspense(props: FaqLinkProps) {
  const { className, children, onClick, title, target, rel, ariaCurrent } = props;
  return (
    <Suspense
      fallback={
        <Link
          href="/faq"
          className={className}
          onClick={onClick}
          title={title}
          target={target}
          rel={rel}
          aria-current={ariaCurrent}
        >
          {children}
        </Link>
      }
    >
      <FaqLink {...props} />
    </Suspense>
  );
}
