"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTeamAuth } from "@/store/useTeamAuth";
import { homePathForRole } from "@/lib/staffRoles";

/**
 * Forced / voluntary password change for staff auth collection.
 * Contractors with force_password_change are redirected here before portals.
 */
export default function StaffChangePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const token = useTeamAuth((s) => s.token);
  const email = useTeamAuth((s) => s.email);
  const role = useTeamAuth((s) => s.role);
  const forcePasswordChange = useTeamAuth((s) => s.forcePasswordChange);
  const hydrateAuth = useTeamAuth((s) => s.hydrateAuth);
  const clearForcePasswordChange = useTeamAuth(
    (s) => s.clearForcePasswordChange
  );
  const logout = useTeamAuth((s) => s.logout);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [ready, isAuthenticated, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Password confirmation does not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/staff/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          password,
          passwordConfirm: confirm,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not change password.");
        return;
      }
      clearForcePasswordChange();
      router.replace(homePathForRole(role));
    } catch {
      setError("Could not change password.");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080C] text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080C] p-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-[#0A1017] p-8 text-white shadow-2xl"
      >
        <div className="space-y-1">
          <span className="text-[10px] font-bold tracking-widest text-[#F6A724] uppercase">
            TokioTours security
          </span>
          <h1 className="font-display text-2xl text-white">
            {forcePasswordChange ? "Set a new password" : "Change password"}
          </h1>
          <p className="text-sm text-zinc-400">
            {forcePasswordChange
              ? "Your temporary password must be replaced before you can open your portal."
              : "Choose a new password for your staff login."}
          </p>
          {email ? (
            <p className="text-xs text-zinc-500">{email}</p>
          ) : null}
        </div>

        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          New password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-sm text-white"
          />
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Confirm password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-sm text-white"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-[#075473] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save password & continue"}
        </button>

        <button
          type="button"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
