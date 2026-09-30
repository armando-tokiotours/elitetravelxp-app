"use client";

import { useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { getPbBaseUrl } from "@/lib/pocketbase/client";
import {
  ensureStaffProfile,
  getStaffProfile,
  updateStaffProfile,
  type StaffProfile,
} from "@/lib/staffProfiles";
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
  const [profiles, setProfiles] = useState<Record<string, StaffProfile | null>>(
    {}
  );
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
      await Promise.all(
        list.map(async (u) => {
          try {
            map[u.id] = await getStaffProfile(pb, u.id);
          } catch {
            map[u.id] = null;
          }
        })
      );
      setProfiles(map);
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

  const photoUrl = (staffId: string) => {
    const p = profiles[staffId];
    if (!p?.photo || !p.id) return null;
    return `${getPbBaseUrl()}/api/files/staff_profiles/${p.id}/${p.photo}`;
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <h2 className="font-display text-2xl text-white">Staff & roles</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Owner license cards — open any staff to edit photo and profile. Roles:
        owner, ops, ticketer, guide, driver, agency.
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
        <h3 className="mb-3 font-medium text-zinc-100">Staff licenses</h3>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No staff rows yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const p = profiles[row.id];
              const url = photoUrl(row.id);
              return (
                <article
                  key={row.id}
                  className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
                >
                  <div className="flex gap-3 p-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-lg font-bold text-zinc-600">
                          {(row.name || row.email || "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">
                        {p?.display_name || row.name || "—"}
                        {row.email === currentEmail ? (
                          <span className="ml-1 text-xs text-zinc-500">(you)</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-zinc-500">{row.email}</p>
                      <select
                        className="mt-1.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]"
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
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-zinc-800 px-3 py-2">
                    <button
                      type="button"
                      className="rounded-full bg-[#075473] px-3 py-1 text-[11px] font-semibold text-white"
                      onClick={() => setEditUser(row)}
                    >
                      Edit license
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300"
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
                      className="rounded-full border border-red-500/30 px-3 py-1 text-[11px] text-red-400 disabled:opacity-40"
                      disabled={row.email === currentEmail}
                      onClick={() => void removeUser(row)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
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
        <OwnerStaffLicenseEditor
          user={editUser}
          profile={profiles[editUser.id] || null}
          getClient={getClient}
          onClose={() => setEditUser(null)}
          onSaved={async () => {
            setMsg(`Updated · ${editUser.email}`);
            setEditUser(null);
            await load();
          }}
          onError={(m) => setError(m)}
        />
      ) : null}
    </div>
  );
}

function OwnerStaffLicenseEditor({
  user,
  profile,
  getClient,
  onClose,
  onSaved,
  onError,
}: {
  user: TeamUser;
  profile: StaffProfile | null;
  getClient: () => PocketBase;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [displayName, setDisplayName] = useState(
    profile?.display_name || user.name || ""
  );
  const [phone, setPhone] = useState(profile?.phone || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [languages, setLanguages] = useState(profile?.languages || "");
  const [cities, setCities] = useState(profile?.strength_cities || "");
  const [videoUrl, setVideoUrl] = useState(profile?.video_url || "");
  const [bankInfo, setBankInfo] = useState(profile?.bank_info || "");
  const [paymentLink, setPaymentLink] = useState(profile?.payment_link || "");
  const [payoutNotes, setPayoutNotes] = useState(profile?.payout_notes || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const existingPhoto =
    profile?.photo && profile.id
      ? `${getPbBaseUrl()}/api/files/staff_profiles/${profile.id}/${profile.photo}`
      : null;
  const preview =
    photoFile != null ? URL.createObjectURL(photoFile) : existingPhoto;

  const save = async () => {
    setSaving(true);
    try {
      const pb = getClient();
      await pb.collection("staff").update(
        user.id,
        { name: displayName.trim() },
        { requestKey: null }
      );
      await updateStaffProfile(
        pb,
        user.id,
        {
          display_name: displayName.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
          languages: languages.trim(),
          strength_cities: cities.trim(),
          video_url: videoUrl.trim(),
          bank_info: bankInfo.trim(),
          payment_link: paymentLink.trim(),
          payout_notes: payoutNotes.trim(),
        },
        { photo: photoFile || undefined }
      );
      await onSaved();
    } catch (e) {
      onError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Staff license
            </p>
            <h3 className="font-display text-xl text-white">{user.email}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-800">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-600">
                No photo
              </div>
            )}
          </div>
          <label className="flex-1 text-xs uppercase tracking-wider text-zinc-400">
            Photo
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs text-zinc-300"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            />
            {photoFile ? (
              <p className="mt-1 normal-case tracking-normal text-zinc-500">
                {(photoFile.size / 1024).toFixed(0)} KB · recommended under 180KB
              </p>
            ) : null}
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Display name", displayName, setDisplayName],
              ["Phone", phone, setPhone],
              ["Languages", languages, setLanguages],
              ["Strength cities", cities, setCities],
              ["Video URL", videoUrl, setVideoUrl],
              ["Payment link", paymentLink, setPaymentLink],
            ] as const
          ).map(([label, value, set]) => (
            <label
              key={label}
              className="block text-xs uppercase tracking-wider text-zinc-400"
            >
              {label}
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          ))}
          <label className="block text-xs uppercase tracking-wider text-zinc-400 sm:col-span-2">
            Bio
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400 sm:col-span-2">
            Bank info
            <textarea
              value={bankInfo}
              onChange={(e) => setBankInfo(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-400 sm:col-span-2">
            Payout notes
            <input
              value={payoutNotes}
              onChange={(e) => setPayoutNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="mt-5 w-full rounded-full bg-[#1BA58A] py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save license"}
        </button>
      </div>
    </div>
  );
}
