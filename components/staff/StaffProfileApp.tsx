"use client";

import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  combineStaffDisplayName,
  ensureStaffProfile,
  resolveStaffNamePartsForEditor,
  updateStaffProfile,
  type StaffProfile,
} from "@/lib/staffProfiles";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";
import { StaffPortalShell } from "@/components/staff/StaffPortalShell";
import {
  optimizeCredentialPhoto,
  staffAvatarSrc,
} from "@/lib/staffPhoto";
import {
  saveStaffCredentialViaApi,
  uploadStaffAvatarViaApi,
} from "@/lib/staffCredentialClient";
import {
  parseStaffLanguages,
  serializeStaffLanguages,
} from "@/lib/staffLanguages";
import { LanguagePills } from "@/components/staff/LanguagePills";

function allowProfile(role: Parameters<typeof canAccessOpsBoard>[0]) {
  return Boolean(role);
}

export function StaffProfileApp() {
  return (
    <StaffPortalShell title="My profile" allow={allowProfile}>
      <ProfileInner />
    </StaffPortalShell>
  );
}

function ProfileInner() {
  const getClient = useTeamAuth((s) => s.getClient);
  const staffId = useTeamAuth((s) => s.staffId);
  const role = useTeamAuth((s) => s.role);
  const email = useTeamAuth((s) => s.email);
  const record = useTeamAuth((s) => s.record);
  const isOwnerOps = canAccessOpsBoard(role);

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [cities, setCities] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [bankInfo, setBankInfo] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!staffId) {
      setLoading(false);
      setError("Profile needs a staff account (not superuser-only).");
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const pb = getClient();
        const seedName = String(
          (record as { name?: string } | null)?.name || ""
        ).trim();
        const p = await ensureStaffProfile(pb, staffId, {
          display_name: seedName,
        });
        setProfile(p);
        const names = resolveStaffNamePartsForEditor({
          first_name: p.first_name,
          last_name: p.last_name,
          display_name: p.display_name,
          fallbackName: seedName,
        });
        setFirstName(names.first_name);
        setLastName(names.last_name);
        setPhone(p.phone || "");
        setBio(p.bio || "");
        setLanguages(parseStaffLanguages(p.languages));
        setCities(p.strength_cities || "");
        setVideoUrl(p.video_url || "");
        setBankInfo(p.bank_info || "");
        setPaymentLink(p.payment_link || "");
        setPayoutNotes(p.payout_notes || "");
      } catch (e) {
        setError(formatPbError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [getClient, staffId, record]);

  const save = async () => {
    if (!staffId) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const token = pb.authStore.token;
      const firstTrim = firstName.trim();
      const lastTrim = lastName.trim();
      const nameTrim = combineStaffDisplayName(firstTrim, lastTrim);
      if (!firstTrim) throw new Error("First name is required.");
      const updated = await saveStaffCredentialViaApi(token, staffId, {
        first_name: firstTrim,
        last_name: lastTrim,
        display_name: nameTrim,
        staff_name: nameTrim,
        phone: phone.trim(),
        bio: bio.trim(),
        languages: serializeStaffLanguages(languages),
        strength_cities: cities.trim(),
        video_url: videoUrl.trim(),
        bank_info: bankInfo.trim(),
        payment_link: paymentLink.trim(),
        payout_notes: payoutNotes.trim(),
      });
      if (photoFile) {
        const { photo } = await uploadStaffAvatarViaApi(
          token,
          staffId,
          photoFile
        );
        updated.photo = photo;
        updated.updated = String(Date.now());
      }
      if (videoFile) {
        const withVideo = await updateStaffProfile(
          pb,
          staffId,
          {},
          { video: videoFile }
        );
        setProfile(withVideo);
      } else {
        setProfile(updated);
      }
      setPhotoFile(null);
      setVideoFile(null);
      setMsg("Profile saved.");
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading profile…</p>;

  const photoUrl = staffAvatarSrc(staffId, {
    photo: profile?.photo,
    updated: profile?.updated,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm text-zinc-400">
        Your person profile — languages, cities, photo/video, payout details.
        Separate from booking PNR pockets. Signed in as {email || "—"}.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {msg ? <p className="text-sm text-[#075473]">{msg}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          First name
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          Last name
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            placeholder="Hidden until booking is fully paid"
          />
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 sm:col-span-2">
          Phone
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
      </div>

      <label className="block text-xs uppercase tracking-wider text-zinc-500">
        Bio / description
        <textarea
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <LanguagePills
          selected={languages}
          onToggle={(l) =>
            setLanguages((prev) =>
              prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
            )
          }
        />
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          Strength cities
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            placeholder="Tokyo, Kyoto"
            value={cities}
            onChange={(e) => setCities(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          Photo
          <span className="mt-0.5 block font-normal normal-case text-zinc-500">
            Square or portrait — saved as 360×480 JPEG
          </span>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="mt-2 h-24 w-[4.5rem] rounded-lg object-cover"
            />
          ) : null}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="mt-2 block w-full text-xs text-zinc-400"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              void optimizeCredentialPhoto(f)
                .then(setPhotoFile)
                .catch((err) =>
                  setError(
                    err instanceof Error ? err.message : "Photo could not be read."
                  )
                );
            }}
          />
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          Video presentation
          <input
            type="file"
            accept="video/mp4,video/webm"
            className="mt-2 block w-full text-xs text-zinc-400"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />
          <input
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            placeholder="Or external video URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </label>
      </div>

      {(isOwnerOps ||
        role === "guide" ||
        role === "driver" ||
        role === "agent") && (
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
            Payout details (ops uses these to pay you)
          </p>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Bank info
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              rows={2}
              value={bankInfo}
              onChange={(e) => setBankInfo(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Payment link
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              placeholder="https://…"
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">
            Notes
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              value={payoutNotes}
              onChange={(e) => setPayoutNotes(e.target.value)}
            />
          </label>
        </div>
      )}

      <button
        type="button"
        disabled={saving || !staffId}
        onClick={() => void save()}
        className="rounded-lg bg-[#075473] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
