"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { staffAvatarSrc } from "@/lib/staffPhoto";
import { useTeamAuth } from "@/store/useTeamAuth";
import {
  resolveStaffAllow,
  StaffLoginCard,
  type StaffAllowCheck,
} from "@/components/staff/StaffPortalShell";

/**
 * Minimal chrome for guide / driver contractor portals.
 * Intentionally does NOT mount the Super User Ops navigation suite.
 */
export function ContractorPortalShell({
  title,
  allow,
  children,
  loginTitle,
  loginSubtitle,
  onProfileClick,
  onMenuClick,
}: {
  title: string;
  allow?: StaffAllowCheck;
  children: ReactNode;
  loginTitle?: string;
  loginSubtitle?: string;
  /** When given, the header avatar opens the in-portal profile view
   *  instead of linking to the generic /profile page. */
  onProfileClick?: () => void;
  /** When given, a hamburger button appears at the left of the header
   *  (slide-out drawer nav) and the title centers like a mobile app. */
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const email = useTeamAuth((s) => s.email);
  const role = useTeamAuth((s) => s.role);
  const staffId = useTeamAuth((s) => s.staffId);
  const record = useTeamAuth((s) => s.record);
  const forcePasswordChange = useTeamAuth((s) => s.forcePasswordChange);
  const logout = useTeamAuth((s) => s.logout);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);
  const homePath = useTeamAuth((s) => s.homePath);
  const allowRole = useMemo(() => resolveStaffAllow(allow), [allow]);

  const displayName =
    String(
      (record as { name?: string } | null)?.name || email || "Staff"
    ).trim() || "Staff";
  const avatarUrl = staffId ? staffAvatarSrc(staffId) : null;
  const initials =
    displayName
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "T";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useTeamAuth.persist.rehydrate();
      if (cancelled) return;
      await hydrateAuth();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateAuth]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    if (forcePasswordChange) {
      router.replace("/staff/change-password");
      return;
    }
    if (!allowRole(role)) {
      router.replace(homePath());
    }
  }, [
    ready,
    isAuthenticated,
    role,
    allowRole,
    router,
    homePath,
    forcePasswordChange,
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0F14] text-zinc-200">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0A1017]/95 backdrop-blur">
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          {onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open navigation menu"
              title="Menu"
              className="shrink-0 rounded-lg p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              <Menu className="h-6 w-6" />
            </button>
          ) : null}
          <div
            className={
              onMenuClick
                ? "pointer-events-none absolute left-1/2 min-w-0 -translate-x-1/2 text-center"
                : "min-w-0 flex-1"
            }
          >
            <p className="text-[0.6rem] font-semibold tracking-[0.3em] text-[#075473] uppercase">
              TOKIOTOURS · Contractor
            </p>
            <h1 className="font-display text-lg leading-tight text-white sm:text-xl">
              {title}
            </h1>
          </div>
          {onMenuClick ? <div className="min-w-0 flex-1" /> : null}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-xs font-bold text-white">
                  {displayName}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.replace("/login");
                  }}
                  className="text-[10px] text-zinc-400 transition-colors hover:text-white"
                >
                  Sign out
                </button>
              </div>
              {onProfileClick ? (
                <button
                  type="button"
                  onClick={onProfileClick}
                  title="Profile"
                  aria-label="Open profile"
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-zinc-800 transition-all hover:border-[#0080A3]"
                >
                  {avatarUrl && !avatarFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-300">
                      {initials}
                    </span>
                  )}
                </button>
              ) : (
                <Link
                  href="/profile"
                  title="Profile"
                  aria-label="Open profile"
                  className="block h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/20 bg-zinc-800 transition-all hover:border-[#0080A3]"
                >
                  {avatarUrl && !avatarFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-300">
                      {initials}
                    </span>
                  )}
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6">
        {!ready ? (
          <p className="py-16 text-center text-sm text-zinc-400">Loading…</p>
        ) : !isAuthenticated ? (
          <StaffLoginCard
            title={loginTitle}
            subtitle={loginSubtitle}
          />
        ) : forcePasswordChange || !allowRole(role) ? (
          <p className="py-16 text-center text-sm text-zinc-400">
            Redirecting…
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
