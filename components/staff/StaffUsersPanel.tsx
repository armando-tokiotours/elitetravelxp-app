"use client";

import { useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  ensureStaffProfile,
  getStaffProfile,
  type StaffProfile,
} from "@/lib/staffProfiles";
import {
  ensureDriverProfile,
  ensureGuideProfile,
  getGuideByStaff,
  type GuideProfile,
} from "@/lib/roleProfiles";
import {
  CREDENTIAL_TABS,
  ROLE_LABELS,
  STAFF_ROLES,
  roleMatchesCredentialTab,
  type CredentialTab,
  type StaffRole,
} from "@/lib/staffRoles";
import {
  PassportBookletModal,
  StaffPassportCard,
} from "@/components/staff/StaffPassportUI";

type TeamUser = {
  id: string;
  email: string;
  name?: string;
  role?: StaffRole;
  agency_id?: string;
  active?: boolean;
  created?: string;
};

export function StaffUsersPanel({
  getClient,
  currentEmail,
}: {
  getClient: () => PocketBase;
  currentEmail: string | null;
}) {
  const [rows, setRows] = useState<TeamUser[]>([]);
  const [profiles, setProfiles] = useState<Record<string, StaffProfile | null>>(
    {}
  );
  const [guides, setGuides] = useState<Record<string, GuideProfile | null>>({});
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
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [credentialTab, setCredentialTab] =
    useState<CredentialTab>("staff");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const list = await pb.collection("staff").getFullList<TeamUser>({
        sort: "role,email",
        requestKey: null,
      });
      setRows(list);
      const map: Record<string, StaffProfile | null> = {};
      const gmap: Record<string, GuideProfile | null> = {};
      await Promise.all(
        list.map(async (u) => {
          try {
            map[u.id] = await getStaffProfile(pb, u.id);
          } catch {
            map[u.id] = null;
          }
          if (u.role === "guide") {
            try {
              gmap[u.id] = await getGuideByStaff(pb, u.id);
            } catch {
              gmap[u.id] = null;
            }
          }
        })
      );
      setProfiles(map);
      setGuides(gmap);
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
        await ensureStaffProfile(getClient(), created.id, {
          display_name: name.trim(),
        });
      } catch {
        /* profile optional on create */
      }
      if (role === "guide") {
        try {
          await ensureGuideProfile(getClient(), created.id, {
            full_name: name.trim(),
            email: email.trim().toLowerCase(),
          });
        } catch {
          /* */
        }
      }
      if (role === "driver") {
        try {
          await ensureDriverProfile(getClient(), created.id, {
            full_name: name.trim(),
          });
        } catch {
          /* */
        }
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
      <h2 className="font-display text-2xl text-white">Staff credentials</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Official TokioTours credentials — bio-data cards by role. Open the
        booklet to edit identity, region, comfort, and rates. Drivers use the
        Driver Coordinator role.
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
        <h3 className="mb-3 font-medium text-zinc-100">Credential registry</h3>
        <div
          className="mb-4 flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Credential role tabs"
        >
          {CREDENTIAL_TABS.map((tab) => {
            const on = credentialTab === tab.id;
            const count = rows.filter((r) =>
              roleMatchesCredentialTab(r.role, tab.id)
            ).length;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setCredentialTab(tab.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                  on
                    ? "bg-[#075473] text-white"
                    : "border border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 tabular-nums ${on ? "text-white/70" : "text-zinc-600"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : rows.filter((r) =>
            roleMatchesCredentialTab(r.role, credentialTab)
          ).length === 0 ? (
          <p className="text-sm text-zinc-500">
            No {CREDENTIAL_TABS.find((t) => t.id === credentialTab)?.label} yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows
              .filter((r) => roleMatchesCredentialTab(r.role, credentialTab))
              .map((row) => (
              <StaffPassportCard
                key={row.id}
                user={row}
                profile={profiles[row.id] || null}
                guide={guides[row.id] || null}
                isYou={row.email === currentEmail}
                onEdit={() => setEditUser(row)}
                onResetPassword={() => {
                  setResetId(row.id);
                  setResetPass("");
                  setResetConfirm("");
                }}
                onDelete={() => void removeUser(row)}
                onRoleChange={(next) => void updateRole(row.id, next)}
              />
            ))}
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

      {editUser ? (
        <PassportBookletModal
          user={editUser}
          profile={profiles[editUser.id] || null}
          getClient={getClient}
          onClose={() => setEditUser(null)}
          onSaved={async () => {
            setMsg(`Credential updated · ${editUser.email}`);
            setEditUser(null);
            await load();
          }}
          onError={(m) => setError(m)}
        />
      ) : null}
    </div>
  );
}
