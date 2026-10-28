"use client";

import { useState, type ComponentType } from "react";
import { LogOut, RefreshCw, X } from "lucide-react";

export type GuideDrawerNavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  count?: number;
  accent?: "amber";
};

/**
 * Slide-out navigation drawer for the Guide Portal (mobile-app style).
 * Owns no tab state — the portal passes items + active id + callbacks.
 */
export function GuideDrawerNav({
  open,
  onClose,
  items,
  activeId,
  onSelect,
  userName,
  userEmail,
  avatarUrl,
  onProfile,
  onRefresh,
  onSignOut,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  items: GuideDrawerNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  userName: string;
  userEmail?: string;
  avatarUrl: string | null;
  onProfile: () => void;
  onRefresh?: () => void;
  onSignOut?: () => void;
  loading?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  if (!open) return null;

  const initials =
    userName
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "T";

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-3/4 max-w-xs flex-col border-r border-white/10 bg-[#060A0F]"
        style={{ animation: "drawer-slide-in 0.25s ease-out both" }}
      >
        {/* Drawer identity header */}
        <div className="flex items-center gap-3 border-b border-white/10 p-5">
          <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/20 bg-zinc-800">
            {avatarUrl && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-300">
                {initials}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">{userName}</p>
            {userEmail ? (
              <p className="truncate text-xs text-zinc-500">{userEmail}</p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onProfile();
                onClose();
              }}
              className="mt-0.5 text-xs font-bold text-[#7dd3fc] hover:underline"
            >
              View Profile
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Relocated portal navigation */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {items.map(({ id, label, icon: Icon, count, accent }) => {
            const isActive = activeId === id;
            const isAmber = accent === "amber";
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onSelect(id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                  isAmber
                    ? isActive
                      ? "border border-amber-500/50 bg-amber-500/20 text-amber-300"
                      : "border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : isActive
                      ? "bg-[#075473]/30 text-[#7dd3fc]"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="flex-1">{label}</span>
                {typeof count === "number" ? (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      isAmber
                        ? "bg-amber-500 text-black"
                        : isActive
                          ? "bg-[#075473]/50 text-white"
                          : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Drawer footer actions */}
        <div className="space-y-1.5 border-t border-white/10 p-4">
          {onRefresh ? (
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh data
            </button>
          ) : null}
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
