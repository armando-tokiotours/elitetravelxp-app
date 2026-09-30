"use client";

import { useEffect, useMemo, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { getPbBaseUrl } from "@/lib/pocketbase/client";
import {
  ensureStaffProfile,
  updateStaffProfile,
  type StaffProfile,
} from "@/lib/staffProfiles";
import {
  ensureGuideProfile,
  getGuideByStaff,
  updateGuideProfile,
  type GuideProfile,
} from "@/lib/roleProfiles";
import {
  ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/staffRoles";

export type PassportStaff = {
  id: string;
  email: string;
  name?: string;
  role?: StaffRole;
  agency_id?: string;
  active?: boolean;
  /** PocketBase created — used for MRZ start date (ddmmaaaa). */
  created?: string;
};

const GOLD = "#F6A724";
const NAVY = "#054F70";
const LOGO_SRC = "/brand/tokiotours-logo-icon.png";

/** Serve-country for credential document type + number prefix. */
const SERVE_COUNTRIES: { name: string; code: string; match: RegExp }[] = [
  {
    name: "Japan",
    code: "JP",
    match:
      /\b(japan|tokyo|kyoto|osaka|nara|nikko|hakone|kamakura|kawaguchiko|fuji|okinawa|hokkaido)\b/i,
  },
  {
    name: "Netherlands",
    code: "NL",
    match: /\b(netherlands|holland|amsterdam|rotterdam|utrecht|den\s*haag|hague)\b/i,
  },
  {
    name: "Spain",
    code: "ES",
    match: /\b(spain|españa|madrid|barcelona|valencia)\b/i,
  },
  {
    name: "France",
    code: "FR",
    match: /\b(france|paris|lyon|marseille)\b/i,
  },
  {
    name: "Germany",
    code: "DE",
    match: /\b(germany|deutschland|berlin|munich|hamburg)\b/i,
  },
  {
    name: "Italy",
    code: "IT",
    match: /\b(italy|italia|rome|milan|florence)\b/i,
  },
];

function resolveServeCountry(hints: (string | undefined | null)[]): {
  name: string;
  code: string;
} {
  const blob = hints.filter(Boolean).join(" ");
  for (const c of SERVE_COUNTRIES) {
    if (c.match.test(blob)) return { name: c.name, code: c.code };
  }
  return { name: "Japan", code: "JP" };
}

const DAY_TRIPS = [
  "Hakone",
  "Kawaguchiko / Mt. Fuji",
  "Nikko",
  "Kamakura",
  "Nara",
] as const;

const AVAIL = ["Full-Time", "Weekends Only", "Part-Time / Custom"] as const;

const EXPERTISE = [
  "Pop Culture",
  "Pokemon",
  "Architecture",
  "Otaku / Anime",
  "Vintage Shops",
  "Gourmet Restaurants",
  "Technology",
] as const;

const LANGS = [
  "English",
  "Spanish",
  "Dutch",
  "French",
  "German",
  "Italian",
] as const;

const JLPT = [
  "N5",
  "N4",
  "N3",
  "N2",
  "N1",
  "Native / Fluent",
  "None",
] as const;

const COMFORT_KEYS = [
  ["comfort_couples", "Couples"],
  ["comfort_family_under_12", "Family under 12"],
  ["comfort_family_12_30", "Family 12–30"],
  ["comfort_family_adults_only", "Family adults only"],
  ["comfort_seniors_only", "Seniors / older"],
  ["comfort_bike_tours", "Bike tours"],
  ["comfort_food_tours", "Food tours"],
  ["comfort_ghost_tours", "Ghost tours"],
] as const;

/** Document no. = country code + 4-char id only (e.g. JP-ZUK4). */
function credentialDocNo(countryCode: string, staffId: string): string {
  const raw = staffId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const chunk = (raw.slice(-4) || "0000").padStart(4, "0");
  const cc = (countryCode || "JP").toUpperCase().slice(0, 3);
  return `${cc}-${chunk}`;
}

/** Start-at-TokioTours date as ddmmaaaa for MRZ. */
function startDateDdmmaaaa(created?: string | null): string {
  const d = created ? new Date(created) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    return `${dd}${mm}${yyyy}`;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

function roleBadge(role?: StaffRole): string {
  switch (role) {
    case "guide":
      return "GUIDE";
    case "driver":
      return "DRIVER COORDINATOR";
    case "agency":
      return "AGENCY";
    case "ops":
      return "OPS";
    case "agent":
      return "CONCIERGE";
    case "ticketer":
      return "TICKETER";
    case "owner":
      return "OWNER";
    default:
      return "STAFF";
  }
}

function splitName(full: string): { surname: string; given: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: "UNKNOWN", given: "STAFF" };
  if (parts.length === 1) return { surname: parts[0].toUpperCase(), given: "—" };
  return {
    surname: parts[parts.length - 1].toUpperCase(),
    given: parts.slice(0, -1).join(" ").toUpperCase(),
  };
}

function buildMrz(
  fullName: string,
  docNo: string,
  startedAt?: string | null
): [string, string] {
  const clean = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z0-9 <]/g, "")
      .replace(/\s+/g, "<");
  const name = clean(fullName || "STAFF");
  const line1 = `P<TOKIO<STAFF<${name}`.padEnd(44, "<").slice(0, 44);
  const start = startDateDdmmaaaa(startedAt);
  const line2 = `${clean(docNo).replace(/-/g, "")}<<<<<<<${start}`
    .padEnd(44, "<")
    .slice(0, 44);
  return [line1, line2];
}

function photoUrl(profile: StaffProfile | null | undefined): string | null {
  if (!profile?.photo || !profile.id) return null;
  return `${getPbBaseUrl()}/api/files/staff_profiles/${profile.id}/${profile.photo}`;
}

/** Grid passport bio-data card */
export function StaffPassportCard({
  user,
  profile,
  guide,
  isYou,
  onEdit,
  onResetPassword,
  onDelete,
  onRoleChange,
}: {
  user: PassportStaff;
  profile: StaffProfile | null;
  guide?: GuideProfile | null;
  isYou: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
  onRoleChange: (role: StaffRole) => void;
}) {
  const display =
    guide?.full_name || profile?.display_name || user.name || user.email;
  const { surname, given } = splitName(display);
  const city =
    guide?.city_of_operation ||
    profile?.strength_cities?.split(/[,/]/)[0]?.trim() ||
    "—";
  const serve = resolveServeCountry([
    guide?.city_of_operation,
    profile?.strength_cities,
    city !== "—" ? city : null,
  ]);
  const docNo = credentialDocNo(serve.code, user.id);
  const [mrz1, mrz2] = buildMrz(display, docNo, user.created);
  const url = photoUrl(profile);
  const monogram = (display || "?").slice(0, 1).toUpperCase();
  const langs =
    (Array.isArray(guide?.main_tour_languages) &&
    guide.main_tour_languages.length
      ? guide.main_tour_languages.join(", ")
      : profile?.languages) || "—";
  const jlpt = guide?.japanese_jlpt_level || "—";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#F6A724]/25 bg-[#0D1117]/90 shadow-[inset_0_0_0_1px_rgba(246,167,36,0.08)]">
      {/* Security line wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-18deg, transparent, transparent 6px, #F6A724 6px, #F6A724 7px)",
        }}
      />
      <div className="relative z-10">
        <header className="flex items-start justify-between gap-2 border-b border-[#F6A724]/20 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_SRC}
              alt=""
              className="h-7 w-7 rounded-full border object-cover"
              style={{ borderColor: GOLD }}
            />
            <div>
              <p
                className="font-godiva text-[11px] uppercase tracking-[0.2em]"
                style={{ color: GOLD }}
              >
                TokioTours
              </p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                Official credential
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] text-zinc-400">
              Type <span className="text-white">{serve.code}</span>
            </p>
            <p className="font-mono text-[9px] text-zinc-500">{docNo}</p>
            <span
              className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: `${NAVY}99`, color: "#9fd4ea" }}
            >
              {roleBadge(user.role)}
            </span>
          </div>
        </header>

        <div className="flex gap-3 p-3">
          <div className="relative w-[5.5rem] shrink-0">
            <div
              className="aspect-[3/4] overflow-hidden rounded-sm bg-zinc-900"
              style={{ boxShadow: `inset 0 0 0 2px ${GOLD}` }}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center font-godiva text-2xl text-zinc-600">
                  {monogram}
                </div>
              )}
            </div>
            <span
              className="absolute inset-x-0 bottom-0 bg-black/75 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider"
              style={{ color: GOLD }}
            >
              Verified credential
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <Field label="Document type" value={serve.name} />
            <Field label="Document no." value={docNo} mono />
            <div>
              <p className="text-[8px] uppercase tracking-[0.16em] text-zinc-500">
                Full name
              </p>
              <p className="font-godiva text-sm uppercase leading-tight text-white">
                {surname}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                {given}
                {isYou ? (
                  <span className="ml-1 text-[9px] text-zinc-500">(you)</span>
                ) : null}
              </p>
            </div>
            <Field label="City / hub" value={city} />
            <Field
              label="Languages & level"
              value={`${langs}${jlpt !== "—" ? ` · ${jlpt}` : ""}`}
            />
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px]"
              value={user.role || "ops"}
              onChange={(e) => onRoleChange(e.target.value as StaffRole)}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-[#F6A724]/15 bg-black/50 px-3 py-2 font-mono text-[9px] leading-relaxed tracking-wider text-[#c9a227]">
          <p className="truncate">{mrz1}</p>
          <p className="truncate">{mrz2}</p>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-800/80 px-3 py-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full px-3 py-1 text-[11px] font-semibold text-[#0D1117]"
            style={{ background: GOLD }}
          >
            Edit credential
          </button>
          <button
            type="button"
            onClick={onResetPassword}
            className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] text-zinc-300"
          >
            Reset password
          </button>
          <button
            type="button"
            disabled={isYou}
            onClick={onDelete}
            className="rounded-full border border-red-500/30 px-3 py-1 text-[11px] text-red-400 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p
        className={`truncate text-[11px] text-zinc-200 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

const BOOKLET_PAGES = [
  "Identity",
  "Region & availability",
  "Comfort & expertise",
  "Rates & banking",
] as const;

/** 4-page passport booklet editor modal */
export function PassportBookletModal({
  user,
  profile,
  getClient,
  onClose,
  onSaved,
  onError,
}: {
  user: PassportStaff;
  profile: StaffProfile | null;
  getClient: () => PocketBase;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // Guide-specific
  const [cityOp, setCityOp] = useState("");
  const [dayTrips, setDayTrips] = useState<string[]>([]);
  const [avail, setAvail] = useState("");
  const [availNotes, setAvailNotes] = useState("");
  const [jlpt, setJlpt] = useState("");
  const [tourLangs, setTourLangs] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<string[]>([]);
  const [otherExp, setOtherExp] = useState("");
  const [perfectDay, setPerfectDay] = useState("");
  const [visaType, setVisaType] = useState("");
  const [visaExp, setVisaExp] = useState("");
  const [rate6, setRate6] = useState("");
  const [rate8, setRate8] = useState("");
  const [extraHead, setExtraHead] = useState("");
  const [comfort, setComfort] = useState<Record<string, boolean>>({
    comfort_couples: true,
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const pb = getClient();
        await ensureStaffProfile(pb, user.id, {
          display_name: user.name || "",
        });
        if (user.role === "guide") {
          const g =
            (await getGuideByStaff(pb, user.id)) ||
            (await ensureGuideProfile(pb, user.id, {
              full_name: user.name || "",
              email: user.email,
            }));
          setGuide(g);
          setDisplayName(String(g.full_name || displayName));
          setPhone(String(g.phone_number || phone));
          setCityOp(String(g.city_of_operation || ""));
          setDayTrips(
            Array.isArray(g.out_of_city_day_trips)
              ? g.out_of_city_day_trips.map(String)
              : []
          );
          setAvail(String(g.availability_pattern || ""));
          setAvailNotes(String(g.availability_notes || ""));
          setJlpt(String(g.japanese_jlpt_level || ""));
          setTourLangs(
            Array.isArray(g.main_tour_languages)
              ? g.main_tour_languages.map(String)
              : []
          );
          setExpertise(
            Array.isArray(g.expertise_topics)
              ? g.expertise_topics.map(String)
              : []
          );
          setOtherExp(String(g.other_expertise || ""));
          setPerfectDay(String(g.perfect_day_tour_description || ""));
          setVisaType(String(g.visa_type || ""));
          setVisaExp(
            g.visa_expiration_date
              ? String(g.visa_expiration_date).slice(0, 10)
              : ""
          );
          setRate6(
            g.base_rate_6h_or_less != null ? String(g.base_rate_6h_or_less) : ""
          );
          setRate8(
            g.base_rate_8h_or_less != null ? String(g.base_rate_8h_or_less) : ""
          );
          setExtraHead(
            g.extra_head_percentage != null
              ? String(g.extra_head_percentage)
              : ""
          );
          const c: Record<string, boolean> = { comfort_couples: true };
          for (const [k] of COMFORT_KEYS) {
            c[k] = Boolean(g[k] ?? (k === "comfort_couples" ? true : false));
          }
          setComfort(c);
        }
      } catch (e) {
        onError(formatPbError(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.role]);

  const existingPhoto = photoUrl(profile);
  const preview = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : existingPhoto),
    [photoFile, existingPhoto]
  );

  const toggleMulti = (
    list: string[],
    set: (v: string[]) => void,
    value: string
  ) => {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

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
          languages:
            tourLangs.length > 0 ? tourLangs.join(", ") : languages.trim(),
          strength_cities: cityOp.trim() || cities.trim(),
          video_url: videoUrl.trim(),
          bank_info: bankInfo.trim(),
          payment_link: paymentLink.trim(),
          payout_notes: payoutNotes.trim(),
        },
        { photo: photoFile || undefined }
      );

      if (user.role === "guide" || guide) {
        const g =
          guide ||
          (await ensureGuideProfile(pb, user.id, {
            full_name: displayName.trim(),
            email: user.email,
          }));
        // Map UI labels to stored select values that exist in PB
        const mapTrip = (v: string) =>
          v === "Kawaguchiko / Mt. Fuji" ? "Kawaguchiko" : v;
        const mapAvail = (v: string) =>
          v === "Part-Time / Custom" ? "Part-Time" : v;
        const mapExp = (v: string) => (v === "Otaku / Anime" ? "Otaku" : v);
        const mapJlpt = (v: string) =>
          v === "Native / Fluent" ? "Native" : v;

        await updateGuideProfile(pb, g.id, {
          full_name: displayName.trim(),
          email: user.email,
          phone_number: phone.trim(),
          city_of_operation: cityOp.trim(),
          out_of_city_day_trips: dayTrips.map(mapTrip),
          availability_pattern: mapAvail(avail),
          availability_notes: availNotes.trim(),
          main_tour_languages: tourLangs,
          japanese_jlpt_level: mapJlpt(jlpt),
          expertise_topics: expertise.map(mapExp),
          other_expertise: otherExp.trim(),
          perfect_day_tour_description: perfectDay.trim(),
          visa_type: visaType.trim(),
          visa_expiration_date: visaExp || null,
          base_rate_6h_or_less: Number(rate6) || 0,
          base_rate_8h_or_less: Number(rate8) || 0,
          extra_head_percentage: Number(extraHead) || 0,
          ...comfort,
        });
      }

      await onSaved();
    } catch (e) {
      onError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const docNo = credentialDocNo(
    resolveServeCountry([cityOp, cities, guide?.city_of_operation]).code,
    user.id
  );
  const inp =
    "mt-1 w-full rounded-lg border border-[#F6A724]/20 bg-[#0D1117] px-3 py-2 text-sm text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-6">
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#F6A724]/35 bg-[#0A0E14] shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(12deg, transparent, transparent 8px, #F6A724 8px, #F6A724 9px)",
          }}
        />

        <header className="relative z-10 flex items-center justify-between gap-3 border-b border-[#F6A724]/25 px-4 py-3">
          <div>
            <p
              className="font-godiva text-sm uppercase tracking-[0.22em]"
              style={{ color: GOLD }}
            >
              Credential booklet
            </p>
            <p className="font-mono text-[10px] text-zinc-500">
              {docNo} · {roleBadge(user.role)} · Page {page + 1}/4
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-600 px-3 py-1 text-xs text-zinc-300"
          >
            Close
          </button>
        </header>

        <nav className="relative z-10 flex gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-2">
          {BOOKLET_PAGES.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setPage(i)}
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                page === i
                  ? "text-[#0D1117]"
                  : "border border-zinc-700 text-zinc-400"
              }`}
              style={page === i ? { background: GOLD } : undefined}
            >
              {i + 1}. {label}
            </button>
          ))}
        </nav>

        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-zinc-400">Opening booklet…</p>
          ) : (
            <>
              {page === 0 ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div
                      className="h-28 w-20 shrink-0 overflow-hidden bg-zinc-900"
                      style={{ boxShadow: `inset 0 0 0 2px ${GOLD}` }}
                    >
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-600">
                          —
                        </div>
                      )}
                    </div>
                    <label className="flex-1 text-[10px] uppercase tracking-wider text-zinc-400">
                      Credential photo
                      <input
                        type="file"
                        accept="image/*"
                        className="mt-1 block w-full text-xs text-zinc-300"
                        onChange={(e) =>
                          setPhotoFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Full name *
                      <input
                        className={inp}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Phone *
                      <input
                        className={inp}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400 sm:col-span-2">
                      Email
                      <input
                        className={inp}
                        value={user.email}
                        disabled
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400 sm:col-span-2">
                      Bio
                      <textarea
                        className={inp}
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {page === 1 ? (
                <div className="space-y-4">
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    City of operation
                    <input
                      className={inp}
                      value={cityOp || cities}
                      onChange={(e) => {
                        setCityOp(e.target.value);
                        setCities(e.target.value);
                      }}
                      placeholder="Tokyo, Kyoto, Osaka, Hiroshima…"
                    />
                  </label>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Out-of-city day trips
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DAY_TRIPS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            toggleMulti(dayTrips, setDayTrips, t)
                          }
                          className={`rounded-full px-2.5 py-1 text-[10px] ${
                            dayTrips.includes(t)
                              ? "bg-[#075473] text-white"
                              : "border border-zinc-700 text-zinc-400"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Availability pattern
                    <select
                      className={inp}
                      value={avail}
                      onChange={(e) => setAvail(e.target.value)}
                    >
                      <option value="">—</option>
                      {AVAIL.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Availability notes
                    <input
                      className={inp}
                      value={availNotes}
                      onChange={(e) => setAvailNotes(e.target.value)}
                      placeholder="Available Mon-Wed afternoons & all weekends"
                    />
                  </label>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Main tour languages
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {LANGS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() =>
                            toggleMulti(tourLangs, setTourLangs, l)
                          }
                          className={`rounded-full px-2.5 py-1 text-[10px] ${
                            tourLangs.includes(l)
                              ? "bg-[#075473] text-white"
                              : "border border-zinc-700 text-zinc-400"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Japanese JLPT / proficiency
                    <select
                      className={inp}
                      value={jlpt}
                      onChange={(e) => setJlpt(e.target.value)}
                    >
                      <option value="">—</option>
                      {JLPT.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Languages (profile text)
                    <input
                      className={inp}
                      value={languages}
                      onChange={(e) => setLanguages(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              {page === 2 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Group comfortability
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {COMFORT_KEYS.map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 text-xs text-zinc-300"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(comfort[key])}
                            onChange={(e) =>
                              setComfort((c) => ({
                                ...c,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Expertise topics
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {EXPERTISE.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            toggleMulti(expertise, setExpertise, t)
                          }
                          className={`rounded-full px-2.5 py-1 text-[10px] ${
                            expertise.includes(t)
                              ? "bg-[#075473] text-white"
                              : "border border-zinc-700 text-zinc-400"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Niche / other expertise
                    <input
                      className={inp}
                      value={otherExp}
                      onChange={(e) => setOtherExp(e.target.value)}
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Perfect day tour
                    <textarea
                      className={inp}
                      rows={4}
                      value={perfectDay}
                      onChange={(e) => setPerfectDay(e.target.value)}
                      placeholder="Describe your perfect day tour"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Visa type
                      <input
                        className={inp}
                        value={visaType}
                        onChange={(e) => setVisaType(e.target.value)}
                        placeholder="Spouse Visa, Permanent Resident…"
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Visa expiration
                      <input
                        type="date"
                        className={inp}
                        value={visaExp}
                        onChange={(e) => setVisaExp(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {page === 3 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Base ≤6h
                      <input
                        type="number"
                        className={inp}
                        value={rate6}
                        onChange={(e) => setRate6(e.target.value)}
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Base ≤8h
                      <input
                        type="number"
                        className={inp}
                        value={rate8}
                        onChange={(e) => setRate8(e.target.value)}
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Extra head %
                      <input
                        type="number"
                        className={inp}
                        value={extraHead}
                        onChange={(e) => setExtraHead(e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Bank / IBAN info
                    <textarea
                      className={inp}
                      rows={3}
                      value={bankInfo}
                      onChange={(e) => setBankInfo(e.target.value)}
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Payment link (Wise / etc.)
                    <input
                      className={inp}
                      value={paymentLink}
                      onChange={(e) => setPaymentLink(e.target.value)}
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Payout notes
                    <input
                      className={inp}
                      value={payoutNotes}
                      onChange={(e) => setPayoutNotes(e.target.value)}
                    />
                  </label>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
                    Video URL
                    <input
                      className={inp}
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="relative z-10 flex items-center justify-between gap-2 border-t border-[#F6A724]/20 px-4 py-3">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-full border border-zinc-600 px-4 py-2 text-xs text-zinc-300 disabled:opacity-30"
          >
            ← Back
          </button>
          {page < 3 ? (
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(3, p + 1))}
              className="rounded-full px-4 py-2 text-xs font-semibold text-[#0D1117]"
              style={{ background: GOLD }}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-full bg-[#1BA58A] px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save credential"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
