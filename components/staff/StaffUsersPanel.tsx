"use client";

import { useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/staffRoles";

type TeamUser = {
  id: string;
  email: string;
  name?: string;
  role?: StaffRole;
  agency_id?: string;
  active?: boolean;
};

export function StaffUsersPanel({
  getClient,
  currentEmail,
}: {
  getClient: () => PocketBase;
  currentEmail: string | null;
}) {
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("ops");
  const [agencyId, setAgencyId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getClient().collection("staff").getFullList<TeamUser>({
        sort: "role,email",
        requestKey: null,
      });
      setRows(list);
    } catch (e) {
      setError(
        `${formatPbError(e)} — restart PocketBase if the staff collection is new.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createUser = async () => {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (password !== passwordConfirm) {
        throw new Error("Password confirmation does not match.");
      }
      const created = await getClient().collection("staff").create(
        {
          email: email.trim().toLowerCase(),
          password,
          passwordConfirm,
          name: name.trim(),
          role,
          agency_id: role === "agency" ? agencyId.trim() : "",
          active: true,
          emailVisibility: true,
        },
        { requestKey: null }
      );
      try {
        const { ensureStaffProfile } = await import("@/lib/staffProfiles");
        await ensureStaffProfile(getClient(), created.id, {
          display_name: name.trim(),
        });
      } catch {
        /* profile optional on create */
      }
      setEmail("");
      setName("");
      setAgencyId("");
      setPassword("");
      setPasswordConfirm("");
      setMsg(`Staff created (${ROLE_LABELS[role]}) — they can sign in.`);
      await load();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (id: string) => {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      if (resetPass.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (resetPass !== resetConfirm) {
        throw new Error("Password confirmation does not match.");
      }
      await getClient().collection("staff").update(
        id,
        { password: resetPass, passwordConfirm: resetConfirm },
        { requestKey: null }
      );
      setResetId(null);
      setResetPass("");
      setResetConfirm("");
      setMsg("Password updated.");
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (id: string, next: StaffRole) => {
    try {
      await getClient()
        .collection("staff")
        .update(id, { role: next }, { requestKey: null });
      setMsg(`Role → ${ROLE_LABELS[next]}`);
      await load();
    } catch (e) {
      setError(formatPbError(e));
    }
  };

  const removeUser = async (row: TeamUser) => {
    if (row.email === currentEmail) {
      setError("You cannot delete the account you are signed in with.");
      return;
    }
    if (!confirm(`Delete staff ${row.email}?`)) return;
    try {
      await getClient().collection("staff").delete(row.id, { requestKey: null });
      setMsg(`Deleted ${row.email}`);
      await load();
    } catch (e) {
      setError(formatPbError(e));
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <h2 className="font-display text-2xl text-white">Staff & roles</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Roles: owner, ops, ticketer, guide, driver, agency. Superuser login still
        works as break-glass owner. Google SSO stub until OAuth is configured.
      </p>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {msg ? <p className="mt-3 text-sm text-emerald-400">{msg}</p> : null}

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="font-medium text-zinc-100">Create staff</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-400 sm:col-span-2">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder="colleague@yourcompany.com"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          {role === "agency" ? (
            <label className="block text-xs uppercase tracking-wider text-zinc-400 sm:col-span-2">
              Agency id
              <input
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="agencies record id"
              />
            </label>
          ) : null}
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400">
            Confirm password
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving || !email || !password}
          onClick={() => void createUser()}
          className="mt-4 rounded-full bg-[#075473] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Creating…" : "+ Create staff"}
        </button>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-medium text-zinc-100">Existing staff</h3>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No staff rows yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/60">
                    <td className="py-3 pr-3 font-medium text-zinc-100">
                      {row.name ? `${row.name} · ` : ""}
                      {row.email}
                      {row.email === currentEmail ? (
                        <span className="ml-2 text-xs font-normal text-zinc-500">
                          (you)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <select
                        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                        value={row.role || "ops"}
                        onChange={(e) =>
                          void updateRole(row.id, e.target.value as StaffRole)
                        }
                      >
                        {STAFF_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap py-3 text-right">
                      <button
                        type="button"
                        className="mr-3 text-[#075473]"
                        onClick={() => {
                          setResetId(row.id);
                          setResetPass("");
                          setResetConfirm("");
                        }}
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        className="text-red-400 disabled:opacity-40"
                        disabled={row.email === currentEmail}
                        onClick={() => void removeUser(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resetId ? (
        <div className="mt-5 rounded-2xl border border-[#075473]/40 bg-zinc-950 p-4">
          <h3 className="font-medium text-zinc-100">
            Reset password · {rows.find((r) => r.id === resetId)?.email}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="password"
              placeholder="New password"
              value={resetPass}
              onChange={(e) => setResetPass(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void resetPassword(resetId)}
              className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              Save password
            </button>
            <button
              type="button"
              onClick={() => setResetId(null)}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
