"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Ticket } from "lucide-react";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";

const LINKS = [
  { href: "/builder", label: "Home / Builder" },
  { href: "/discover", label: "Discover Experiences" },
  { href: "/builder/itinerary", label: "My Saved Itineraries" },
  { href: "/team-access", label: "Team Access (Admin)" },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  hideBottomPad,
  logoSrc,
  /** Builder hero layout: logo left, hamburger right, no page title in header */
  heroMode = false,
  transparentHeader = false,
  /** Luxury dark chrome (builder / discover-aligned) */
  dark = false,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  hideBottomPad?: boolean;
  logoSrc?: string;
  heroMode?: boolean;
  transparentHeader?: boolean;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const headerClass = transparentHeader
    ? dark
      ? "absolute inset-x-0 top-0 z-40 border-b border-white/10 bg-black/50 backdrop-blur-md"
      : "absolute inset-x-0 top-0 z-40 border-b border-white/10 bg-[#FBF8F2]/88 backdrop-blur-md"
    : dark
      ? "sticky top-0 z-40 border-b border-zinc-800 bg-black/90 backdrop-blur-md"
      : "sticky top-0 z-40 border-b border-[#E8E2D9]/80 bg-[#FBF8F2]/95 backdrop-blur-md";

  const manageBtnClass = dark
    ? "inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-[#C4A35A] hover:text-white sm:px-3"
    : "inline-flex items-center gap-1.5 rounded-xl border border-[#D9D2C7] bg-white px-2.5 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[#0B1F3A] transition hover:border-[#C4A35A] sm:px-3";

  return (
    <div
      className={`builder-theme relative min-h-screen ${
        dark
          ? "bg-[#0a0a0a] text-white [color-scheme:dark]"
          : "bg-[#F5F0E8] text-[#0B1F3A]"
      }`}
    >
      <header className={headerClass}>
        <div
          className={`mx-auto flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 ${
            heroMode ? "max-w-5xl" : "max-w-3xl"
          }`}
        >
          {heroMode ? (
            <>
              <BrandMark logoSrc={logoSrc} />
              <div className="min-w-0 flex-1" />
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className={manageBtnClass}
                aria-label="Manage Booking"
              >
                <Ticket className="h-3.5 w-3.5 text-[#C4A35A]" />
                <span className="hidden sm:inline">Manage Booking</span>
                <span className="sm:hidden">Booking</span>
              </button>
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  dark
                    ? "border border-zinc-700 bg-zinc-900 text-white hover:border-[#C4A35A]"
                    : "border border-[#D9D2C7] bg-white text-[#0B1F3A] hover:border-[#C4A35A]"
                }`}
              >
                <HamburgerIcon />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  dark
                    ? "border border-zinc-700 bg-zinc-900 text-white hover:border-[#C4A35A]"
                    : "border border-[#D9D2C7] bg-white text-[#0B1F3A] hover:border-[#C4A35A]"
                }`}
              >
                <HamburgerIcon />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-[#C4A35A]">
                  {subtitle ?? "Elite Travel Experiences"}
                </p>
                {title ? (
                  <h1
                    className={`truncate font-display text-xl sm:text-2xl ${
                      dark ? "text-white" : "text-[#0B1F3A]"
                    }`}
                  >
                    {title}
                  </h1>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className={manageBtnClass}
                aria-label="Manage Booking"
              >
                <Ticket className="h-3.5 w-3.5 text-[#C4A35A]" />
                <span className="hidden sm:inline">Manage Booking</span>
                <span className="sm:hidden">Booking</span>
              </button>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt="Elite Travel Experiences"
                  className="hidden h-9 w-auto max-w-[7rem] object-contain sm:block"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/brand/elite-travel-logo.png"
                  alt="Elite Travel Experiences"
                  className="hidden h-9 w-auto max-w-[7rem] object-contain sm:block"
                />
              )}
            </>
          )}
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 transition ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Close menu"
          className={`absolute inset-0 bg-black/45 transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 right-0 flex w-[min(86vw,20rem)] flex-col bg-[#0B1F3A] text-white shadow-2xl transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#C4A35A]">
                Menu
              </p>
              <p className="mt-1 font-display text-xl">
                Elite Travel Experiences
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/80"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setManageOpen(true);
              }}
              className="rounded-xl px-4 py-3.5 text-left text-sm tracking-wide text-white/85 transition hover:bg-white/8"
            >
              Manage Booking
            </button>
            {LINKS.map((link) => {
              const active =
                link.href === "/builder"
                  ? pathname === "/builder"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-4 py-3.5 text-sm tracking-wide transition ${
                    active
                      ? "bg-[#C4A35A]/20 text-[#C4A35A]"
                      : "text-white/85 hover:bg-white/8"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <p className="border-t border-white/10 px-5 py-4 text-xs text-white/40">
            travelexperiencesgroup.com
          </p>
        </aside>
      </div>

      <div
        className={
          hideBottomPad
            ? ""
            : "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8"
        }
      >
        {children}
      </div>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onSuccess={(ref) => {
          setToast(`Itinerary ${ref} loaded successfully`);
          if (!pathname.startsWith("/builder")) {
            router.push("/builder");
          }
        }}
      />

      {toast ? (
        <div
          role="status"
          className="fixed bottom-[7.5rem] left-1/2 z-[110] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#C4A35A]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#E8D5A3] shadow-lg md:bottom-28"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function BrandMark({ logoSrc }: { logoSrc?: string }) {
  const src = logoSrc || "/brand/elite-travel-logo.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Elite Travel Experiences"
      loading="eager"
      decoding="async"
      className="h-11 w-auto max-w-[9.5rem] object-contain sm:h-12"
    />
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
      <path
        d="M1 1h18M1 7h18M1 13h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
