"use client";

import { useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  ensureStaffProfile,
  getStaffProfile,
  splitDisplayNameForEditor,
  type StaffProfile,
} from "@/lib/staffProfiles";
import {
  ensureDriverProfile,
  ensureGuideProfile,
  getGuideByStaff,
  type GuideProfile,
} from "@/lib/roleProfiles";
import { uploadStaffAvatarViaApi } from "@/lib/staffCredentialClient";
import {
  CREDENTIAL_TABS,
  ROLE_LABELS,
  STAFF_ROLES,
  canAccessOpsBoard,
  canAccessTeamAccess,
  roleMatchesCredentialTab,
  type CredentialTab,
  type StaffRole,
} from "@/lib/staffRoles";
import { roleUsesPasswordLogin } from "@/lib/contractorProvisioning";
import {
  PassportBookletModal,
  StaffPassportCard,
} from "@/components/staff/StaffPassportUI";
import { useTeamAuth } from "@/store/useTeamAuth";

type TeamUser = {
  id: string;
  email: string;
  name?: string;
  role?: StaffRole;
  agency_id?: string;
  active?: boolean;
  force_password_change?: boolean;
  created?: string;
};

/** Satisfy PB auth min password when pre-provisioning SSO-only staff. */
function generateSsoPlaceholderPassword(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${rand.slice(0, 12)}A1!x`;
}

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
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [sendWelcome, setSendWelcome] = useState(true);
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(
    null
  );
  /** Core staff: hide password UI and mint a dummy PB password for Google SSO. */
  const [ssoPreProvision, setSsoPreProvision] = useState(true);
  const [saving, setSaving] = useState(false);

  const passwordLoginRole = roleUsesPasswordLogin(role);
  const useSsoProvision = ssoPreProvision && !passwordLoginRole;

  const setRoleAndSsoDefault = (next: StaffRole) => {
    setRole(next);
    if (roleUsesPasswordLogin(next)) {
      setSsoPreProvision(false);
      setSendWelcome(true);
    } else {
      setSsoPreProvision(true);
    }
  };
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [assignUser, setAssignUser] = useState<TeamUser | null>(null);
  const [assignPnr, setAssignPnr] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [hubPnrs, setHubPnrs] = useState<{ pnr: string; guest?: string }[]>(
    []
  );
  const [usersTab, setUsersTab] = useState<"create" | "registry">("create");
  const [credentialTab, setCredentialTab] =
    useState<CredentialTab>("staff");
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);
  const authEmail = useTeamAuth((s) => s.email);
  const authRole = useTeamAuth((s) => s.role);
  const authToken = useTeamAuth((s) => s.token);
  const authCollection = useTeamAuth((s) => s.authCollection);
  const canManage =
    authCollection === "_superusers" ||
    canAccessOpsBoard(authRole) ||
    canAccessTeamAccess(authRole);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      if (!pb.authStore.isValid) {
        setRows([]);
        setError(
          `Not authenticated to PocketBase (${pb.baseUrl}). Log out and sign in again on local.`
        );
        return;
      }

      // Stale JWT from production still looks "valid" client-side but local PB
      // returns an empty staff list with no error. Refresh proves the token.
      const authCollection =
        useTeamAuth.getState().authCollection === "staff"
          ? "staff"
          : "_superusers";
      try {
        await pb.collection(authCollection).authRefresh();
        useTeamAuth.setState({
          token: pb.authStore.token,
          record: pb.authStore.record,
          isAuthenticated: true,
        });
      } catch {
        setRows([]);
        setError(
          `Session is not valid on ${pb.baseUrl} (often an old production login). Log out, then sign in again on local.`
        );
        useTeamAuth.getState().logout();
        return;
      }

      const list = await pb.collection("staff").getFullList<TeamUser>({
        sort: "role,email",
        requestKey: null,
      });
      setRows(list);
      if (list.length === 0) {
        setError(
          `Staff list empty from ${pb.baseUrl} after a valid session. Log out and sign in with a local owner/ops account (or PB admin), then Refresh.`
        );
      }
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

  // Wait for team-auth persist hydrate — loading with no token returns [].
  useEffect(() => {
    if (!isAuthenticated && !authEmail && !currentEmail) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authEmail, currentEmail]);

  const createUser = async () => {
    setSaving(true);
    setError(null);
    setMsg(null);
    setCreatedTempPassword(null);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error("Display name is required.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error(
          "Email must look like name@company.com (include @ and a domain)."
        );
      }

      const existing = rows.find(
        (r) => String(r.email || "").trim().toLowerCase() === trimmedEmail
      );
      if (existing) {
        throw new Error(
          "This email already exists. Edit the existing user instead of creating a new one."
        );
      }

      // Contractors: server-side temp password + welcome email (admin client).
      if (passwordLoginRole) {
        if (role === "agency" && !agencyId.trim()) {
          throw new Error("Agency id is required for the Agency role.");
        }
        if (!authToken) {
          throw new Error("Sign in again — missing auth token for API create.");
        }
        const fd = new FormData();
        fd.append("email", trimmedEmail);
        fd.append("name", trimmedName);
        fd.append("role", role);
        fd.append("phone", phone.trim());
        fd.append("bio", bio.trim());
        fd.append("agencyId", agencyId.trim());
        fd.append("sendWelcome", sendWelcome ? "true" : "false");
        if (photoFile) fd.append("photo", photoFile);

        const res = await fetch("/api/staff/create-contractor", {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          tempPassword?: string;
          emailSent?: boolean;
          emailError?: string;
          loginUrl?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Could not create contractor.");
        }
        setCreatedTempPassword(data.tempPassword || null);
        setEmail("");
        setName("");
        setAgencyId("");
        setPhone("");
        setBio("");
        setPhotoFile(null);
        setPassword("");
        setPasswordConfirm("");
        const mailNote = sendWelcome
          ? data.emailSent
            ? " Welcome email sent."
            : ` Welcome email not sent${data.emailError ? `: ${data.emailError}` : "."}`
          : " Welcome email skipped.";
        setMsg(
          `${ROLE_LABELS[role]} created with temporary password (forced reset on first login).${mailNote}`
        );
        await load();
        return;
      }

      let pass = password;
      let passConfirm = passwordConfirm;
      if (useSsoProvision) {
        pass = generateSsoPlaceholderPassword();
        passConfirm = pass;
      } else {
        if (pass.length < 8) {
          throw new Error(
            "Password must be at least 8 characters and match the confirmation."
          );
        }
        if (pass !== passConfirm) {
          throw new Error(
            "Password must be at least 8 characters and match the confirmation."
          );
        }
      }

      const accountType =
        role === "guide"
          ? "GUIDE"
          : role === "agency"
            ? "TRAVEL_AGENT"
            : "STAFF";
      const created = await getClient().collection("staff").create(
        {
          email: trimmedEmail,
          password: pass,
          passwordConfirm: passConfirm,
          name: trimmedName,
          role,
          account_type: accountType,
          agency_id: role === "agency" ? agencyId.trim() : "",
          active: true,
          emailVisibility: true,
          force_password_change: false,
        },
        { requestKey: null }
      );
      try {
        {
          const parts = splitDisplayNameForEditor(trimmedName);
          await ensureStaffProfile(getClient(), created.id, {
            display_name: trimmedName,
            first_name: parts.first_name,
            last_name: parts.last_name,
          });
        }
      } catch {
        /* profile optional on create — do not fail staff login creation */
      }
      if (role === "guide") {
        try {
          await ensureGuideProfile(getClient(), created.id, {
            full_name: trimmedName,
            email: trimmedEmail,
          });
        } catch {
          /* guide profile optional on create */
        }
      }
      if (role === "driver") {
        try {
          await ensureDriverProfile(getClient(), created.id, {
            full_name: trimmedName,
          });
        } catch {
          /* driver profile optional on create */
        }
      }
      setEmail("");
      setName("");
      setAgencyId("");
      setPassword("");
      setPasswordConfirm("");
      setMsg(
        useSsoProvision
          ? `Pre-provisioned ${ROLE_LABELS[role]} for Google SSO — ${trimmedEmail} can sign in with Workspace (role already assigned).`
          : `Staff created (${ROLE_LABELS[role]}) — they can sign in.`
      );
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
      if (!authToken) {
        throw new Error("Sign in again — missing auth token.");
      }
      // Admin API — browser JWT cannot update other staff passwords (manageRule: null).
      const res = await fetch("/api/staff/admin-reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          staffId: id,
          password: resetPass,
          passwordConfirm: resetConfirm,
          forcePasswordChange: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not reset password.");
      }
      setResetId(null);
      setResetPass("");
      setResetConfirm("");
      setMsg("Password updated — user must change it on next login.");
      await load();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const sendResetEmail = async (row: TeamUser) => {
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/staff/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not request reset email.");
      }
      setMsg(
        data.message ||
          `Password reset requested for ${row.email} via PocketBase staff collection.`
      );
    } catch (e) {
      setError(formatPbError(e));
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

  const uploadCredentialPhoto = async (staffId: string, file: File) => {
    await uploadStaffAvatarViaApi(getClient().authStore.token, staffId, file);
    setMsg("Photo updated.");
    await load();
  };

  const openAssign = async (row: TeamUser) => {
    setAssignUser(row);
    setAssignPnr("");
    try {
      const list = await getClient()
        .collection("ops_hub")
        .getList<{ pnr: string; guest_summary?: string }>(1, 40, {
          sort: "-updated",
          requestKey: null,
        });
      setHubPnrs(
        list.items.map((h) => ({
          pnr: String(h.pnr || "").toUpperCase(),
          guest: String(h.guest_summary || "").trim(),
        }))
      );
    } catch {
      setHubPnrs([]);
    }
  };

  const assignToBooking = async () => {
    if (!assignUser) return;
    const pnr = assignPnr.trim().toUpperCase().replace(/"/g, "");
    if (!pnr) {
      setError("Enter a PNR to assign.");
      return;
    }
    setAssigning(true);
    setError(null);
    try {
      const pb = getClient();
      const name =
        assignUser.name || assignUser.email || "Staff";
      const hub = await pb
        .collection("ops_hub")
        .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
      await pb.collection("ops_hub").update(
        hub.id,
        {
          assigned_agent_id: assignUser.id,
          assigned_agent: name,
          agent_response: "accepted",
        },
        { requestKey: null }
      );
      setMsg(`${name} assigned as concierge agent on ${pnr}.`);
      setAssignUser(null);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setAssigning(false);
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

      <div className="mt-6 flex flex-wrap gap-2 overflow-x-auto border-b border-zinc-800 pb-4">
        {(
          [
            ["create", "Create Staff", "rounded-full border border-cyan-400 bg-[#075473] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"],
            ["registry", "Credential Registry", "rounded-full border border-[#F6A724]/70 bg-[#F6A724]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F6A724]"],
          ] as const
        ).map(([id, label, activeClass]) => (
          <button
            key={id}
            type="button"
            onClick={() => setUsersTab(id)}
            className={
              usersTab === id
                ? activeClass
                : "rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-500"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {usersTab === "create" ? (
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="font-medium text-zinc-100">
          {passwordLoginRole
            ? "Create contractor / partner"
            : "Create staff"}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          {passwordLoginRole
            ? "Owner / Ops create guides, drivers, agencies, and ticketers. A temporary password is generated server-side; they must change it on first login."
            : "Pre-create core staff with their Workspace email + role before first Google login."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase tracking-wider text-zinc-400 sm:col-span-2">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder={
                useSsoProvision
                  ? "name@tokiotours.nl"
                  : role === "guide"
                    ? "guide@gmail.com"
                    : role === "driver"
                      ? "driver@example.com"
                      : "partner@agency.com"
              }
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
              onChange={(e) =>
                setRoleAndSsoDefault(e.target.value as StaffRole)
              }
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

          {passwordLoginRole ? (
            <>
              <label className="block text-xs uppercase tracking-wider text-zinc-400">
                Phone
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  placeholder="+81 90-1234-5678"
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-zinc-400">
                Profile photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setPhotoFile(e.target.files?.[0] || null)
                  }
                  className="mt-1 w-full text-xs text-zinc-400 file:mr-3 file:rounded-full file:border-0 file:bg-[#075473] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
              </label>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 sm:col-span-2">
                Bio
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  placeholder="Short intro for Ops / guests"
                />
              </label>
              <label className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={sendWelcome}
                  onChange={(e) => setSendWelcome(e.target.checked)}
                />
                <span className="text-xs text-zinc-300 normal-case tracking-normal">
                  <span className="font-semibold text-white">
                    Send welcome email
                  </span>
                  <span className="mt-0.5 block text-zinc-500">
                    Includes login link, email, and temporary password via
                    transactional mail. Temp password is also shown once below
                    after create.
                  </span>
                </span>
              </label>
              <p className="text-[11px] leading-relaxed text-amber-200/80 sm:col-span-2">
                Temporary password is generated securely on the server. The
                account is marked <code className="text-amber-100">force_password_change</code> until
                they set their own password.
              </p>
            </>
          ) : (
            <>
              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-2.5 sm:col-span-2"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={useSsoProvision}
                  onChange={(e) => setSsoPreProvision(e.target.checked)}
                />
                <span className="text-xs text-zinc-300 normal-case tracking-normal">
                  <span className="font-semibold text-white">
                    Pre-provision for Google SSO
                  </span>
                  <span className="mt-0.5 block text-zinc-500">
                    Hides password fields. Creates the account with a hidden
                    password so PocketBase is satisfied; they sign in with Google
                    Workspace.
                  </span>
                </span>
              </label>

              {!useSsoProvision ? (
                <>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Confirm password
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                      autoComplete="new-password"
                    />
                  </label>
                </>
              ) : (
                <p className="text-[11px] leading-relaxed text-zinc-500 sm:col-span-2">
                  Password fields hidden — a secure placeholder is generated so
                  PocketBase accepts the create. Staff never need this password if
                  they use Google SSO.
                </p>
              )}
            </>
          )}
        </div>
        {createdTempPassword ? (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-100">
            <p className="font-semibold uppercase tracking-wider text-amber-200">
              Temporary password (shown once)
            </p>
            <p className="mt-1 font-mono text-sm text-white">
              {createdTempPassword}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          disabled={
            saving ||
            !email.trim() ||
            !name.trim() ||
            (!passwordLoginRole && !useSsoProvision && !password)
          }
          onClick={() => void createUser()}
          className="mt-4 rounded-full bg-[#075473] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving
            ? "Creating…"
            : passwordLoginRole
              ? "+ Create contractor"
              : useSsoProvision
                ? "+ Pre-provision SSO"
                : "+ Create staff"}
        </button>
      </div>
      ) : null}

      {usersTab === "registry" ? (
      <>
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-zinc-100">Credential registry</h3>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-bold tracking-wider text-zinc-300 uppercase hover:border-zinc-500 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
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
                canManage={canManage}
                onEdit={() => setEditUser(row)}
                onUploadPhoto={(file) => uploadCredentialPhoto(row.id, file)}
                onPhotoSaved={() => load()}
                onAssignCase={
                  canManage ? () => void openAssign(row) : undefined
                }
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
          <p className="mt-1 text-xs text-zinc-500">
            Uses the admin API (staff.manageRule blocks browser password updates
            on other accounts). Sets force_password_change for next login.
          </p>
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
          <div className="mt-3 flex flex-wrap gap-2">
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
              onClick={() => {
                const row = rows.find((r) => r.id === resetId);
                if (row) void sendResetEmail(row);
              }}
              className="rounded-full border border-[#075473]/50 px-4 py-2 text-sm text-[#7eb8cc]"
            >
              Email PB reset link
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
      </>
      ) : null}

      {assignUser ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
            <p className="text-sm font-semibold text-white">
              Assign {assignUser.name || assignUser.email} to a booking
            </p>
            <p className="text-[11px] text-zinc-500">
              Same as concierge agent assignment on Booking status — pick a PNR.
            </p>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
              Booking PNR
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white uppercase"
                value={assignPnr}
                onChange={(e) => setAssignPnr(e.target.value.toUpperCase())}
                placeholder="JPN-XXXXXX"
                list="credential-assign-pnrs"
              />
            </label>
            <datalist id="credential-assign-pnrs">
              {hubPnrs.map((h) => (
                <option key={h.pnr} value={h.pnr}>
                  {h.guest || h.pnr}
                </option>
              ))}
            </datalist>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={assigning}
                onClick={() => void assignToBooking()}
                className="rounded-full bg-[#075473] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {assigning ? "Saving…" : "Assign as agent"}
              </button>
              <button
                type="button"
                onClick={() => setAssignUser(null)}
                className="rounded-full border border-zinc-600 px-4 py-2 text-xs text-zinc-300"
              >
                Cancel
              </button>
            </div>
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
            setError(null);
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
