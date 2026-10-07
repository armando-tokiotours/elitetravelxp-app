"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  saveStaffCredentialViaApi,
  uploadStaffAvatarViaApi,
} from "@/lib/staffCredentialClient";
import {
  parseStaffLanguages,
  serializeStaffLanguages,
} from "@/lib/staffLanguages";
import {
  combineStaffDisplayName,
  ensureStaffProfile,
  resolveStaffNamePartsForEditor,
  type StaffProfile,
} from "@/lib/staffProfiles";
import { LanguagePills } from "@/components/staff/LanguagePills";
import {
  ensureDriverProfile,
  ensureGuideProfile,
  getDriverByStaff,
  getGuideByStaff,
  updateDriverProfile,
  updateGuideProfile,
  type DriverProfile,
  type GuideProfile,
} from "@/lib/roleProfiles";
import {
  ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/staffRoles";
import { BrandLogoIcon } from "@/components/branding/BrandLogoIcon";
import {
  optimizeCredentialPhoto,
  staffAvatarSrc,
} from "@/lib/staffPhoto";

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

function photoUrl(
  profile: StaffProfile | null | undefined,
  staffId?: string
): string | null {
  const sid = String(staffId || profile?.staff_id || "").trim();
  if (!profile?.photo || !sid) return null;
  return staffAvatarSrc(sid, {
    photo: profile.photo,
    updated: profile.updated,
  });
}

/** Grid passport bio-data card */
export function StaffPassportCard({
  user,
  profile,
  guide,
  isYou,
  canManage,
  onEdit,
  onResetPassword,
  onDelete,
  onRoleChange,
  onPhotoSaved,
  onUploadPhoto,
  onAssignCase,
}: {
  user: PassportStaff;
  profile: StaffProfile | null;
  guide?: GuideProfile | null;
  isYou: boolean;
  /** Owner / ops / superuser — change anyone's photo and assign bookings. */
  canManage?: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
  onRoleChange: (role: StaffRole) => void;
  onPhotoSaved?: () => void | Promise<void>;
  onUploadPhoto?: (file: File) => Promise<void>;
  onAssignCase?: () => void;
}) {
  const fromParts = combineStaffDisplayName(
    profile?.first_name,
    profile?.last_name
  );
  const display =
    fromParts ||
    guide?.full_name ||
    profile?.display_name ||
    user.name ||
    user.email;
  // Prefer DB first/last when set (passport surname = last, given = first).
  const { surname, given } =
    profile?.first_name || profile?.last_name
      ? {
          surname: String(profile?.last_name || "—").trim().toUpperCase() || "—",
          given:
            String(profile?.first_name || "—").trim().toUpperCase() || "—",
        }
      : splitName(display);
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
  const url = photoUrl(profile, user.id);
  const [imgBroken, setImgBroken] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const canChangePhoto = Boolean(isYou || canManage);
  useEffect(() => {
    setImgBroken(false);
  }, [url]);
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
            <BrandLogoIcon
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
              {url && !imgBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setImgBroken(true)}
                />
              ) : (
                <div className="flex h-full items-center justify-center font-godiva text-2xl text-zinc-600">
                  {monogram}
                </div>
              )}
            </div>
            {canChangePhoto && onUploadPhoto ? (
              <label className="absolute inset-x-0 bottom-0 cursor-pointer bg-black/80 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-[#F6A724]">
                {photoBusy ? "Saving…" : "Change photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  className="hidden"
                  disabled={photoBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    void (async () => {
                      setPhotoBusy(true);
                      setPhotoError(null);
                      try {
                        const optimized = await optimizeCredentialPhoto(f);
                        await onUploadPhoto(optimized);
                        setImgBroken(false);
                        await onPhotoSaved?.();
                      } catch (err) {
                        setPhotoError(
                          err instanceof Error
                            ? err.message
                            : "Photo did not save."
                        );
                      } finally {
                        setPhotoBusy(false);
                      }
                    })();
                  }}
                />
              </label>
            ) : (
              <span
                className="absolute inset-x-0 bottom-0 bg-black/75 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider"
                style={{ color: GOLD }}
              >
                Verified credential
              </span>
            )}
            {photoError ? (
              <p className="mt-1 text-[8px] leading-tight text-red-300">
                {photoError}
              </p>
            ) : null}
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
          {canManage && onAssignCase ? (
            <button
              type="button"
              onClick={onAssignCase}
              className="rounded-full border border-[#075473] bg-[#075473]/20 px-3 py-1 text-[11px] font-semibold text-cyan-200"
            >
              Assign to booking
            </button>
          ) : null}
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


type BookletKind = "guide" | "driver" | "agency" | "staff";

function bookletKindForRole(role?: StaffRole | null): BookletKind {
  if (role === "guide") return "guide";
  if (role === "driver") return "driver";
  if (role === "agency") return "agency";
  return "staff";
}

function bookletPagesForKind(kind: BookletKind): readonly string[] {
  switch (kind) {
    case "guide":
      return ["Identity", "Region", "Expertise", "Rates"] as const;
    case "driver":
      return ["Identity", "Operations", "Payout"] as const;
    case "agency":
      return ["Identity", "Agency", "Payout"] as const;
    default:
      return ["Identity", "Coverage", "Payout"] as const;
  }
}

/** Role-aware passport booklet editor modal */
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
  const kind = bookletKindForRole(user.role);
  const pages = bookletPagesForKind(kind);
  const lastPage = pages.length - 1;

  const [page, setPage] = useState(0);
  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const initialNames = resolveStaffNamePartsForEditor({
    first_name: profile?.first_name,
    last_name: profile?.last_name,
    display_name: profile?.display_name,
    fallbackName: user.name,
  });
  const [firstName, setFirstName] = useState(initialNames.first_name);
  const [lastName, setLastName] = useState(initialNames.last_name);
  const [phone, setPhone] = useState(profile?.phone || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [languages, setLanguages] = useState<string[]>(() =>
    parseStaffLanguages(profile?.languages)
  );
  const [cities, setCities] = useState(profile?.strength_cities || "");
  const [videoUrl, setVideoUrl] = useState(profile?.video_url || "");
  const [bankInfo, setBankInfo] = useState(profile?.bank_info || "");
  const [paymentLink, setPaymentLink] = useState(profile?.payment_link || "");
  const [payoutNotes, setPayoutNotes] = useState(profile?.payout_notes || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [agencyId, setAgencyId] = useState(user.agency_id || "");

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

  // Driver-specific
  const [licenseNo, setLicenseNo] = useState("");
  const [fleetName, setFleetName] = useState("");
  const [driverType, setDriverType] = useState("independent");

  useEffect(() => {
    setPage(0);
  }, [user.id, kind]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const pb = getClient();
        try {
          await ensureStaffProfile(pb, user.id, {
            display_name: user.name || "",
          });
        } catch (profileErr) {
          onError(
            `${formatPbError(profileErr)} — profile row could not be created; you can still edit and Save.`
          );
        }

        // Prefer stored first/last; editor-only split of display_name when empty.
        const seeded = resolveStaffNamePartsForEditor({
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          display_name: profile?.display_name,
          fallbackName: user.name,
        });
        setFirstName(seeded.first_name);
        setLastName(seeded.last_name);

        if (kind === "guide") {
          const g = await getGuideByStaff(pb, user.id);
          if (g) {
            setGuide(g);
            // Guide.full_name is combined; only seed editor if profile first/last empty.
            if (!profile?.first_name && !profile?.last_name && g.full_name) {
              const fromGuide = resolveStaffNamePartsForEditor({
                fallbackName: String(g.full_name),
              });
              setFirstName(fromGuide.first_name);
              setLastName(fromGuide.last_name);
            }
            setPhone(String(g.phone_number || profile?.phone || ""));
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
            setLanguages((prev) =>
              prev.length
                ? prev
                : parseStaffLanguages(
                    profile?.languages || g.main_tour_languages
                  )
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
              g.base_rate_6h_or_less != null
                ? String(g.base_rate_6h_or_less)
                : ""
            );
            setRate8(
              g.base_rate_8h_or_less != null
                ? String(g.base_rate_8h_or_less)
                : ""
            );
            setExtraHead(
              g.extra_head_percentage != null
                ? String(g.extra_head_percentage)
                : ""
            );
            const c: Record<string, boolean> = { comfort_couples: true };
            for (const [k] of COMFORT_KEYS) {
              c[k] = Boolean(
                g[k] ?? (k === "comfort_couples" ? true : false)
              );
            }
            setComfort(c);
          }
        } else if (kind === "driver") {
          const d = await getDriverByStaff(pb, user.id);
          if (d) {
            setDriver(d);
            if (!profile?.first_name && !profile?.last_name && d.full_name) {
              const fromDriver = resolveStaffNamePartsForEditor({
                fallbackName: String(d.full_name),
              });
              setFirstName(fromDriver.first_name);
              setLastName(fromDriver.last_name);
            }
            setPhone(String(d.phone_number || profile?.phone || ""));
            setCities(
              Array.isArray(d.operating_cities)
                ? d.operating_cities.map(String).join(", ")
                : profile?.strength_cities || ""
            );
            setLicenseNo(String(d.operating_license_number || ""));
            setFleetName(String(d.company_fleet_name || ""));
            setDriverType(String(d.driver_type || "independent"));
          }
        }
      } catch (e) {
        onError(formatPbError(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.role, kind]);

  const existingPhoto = photoUrl(profile, user.id);
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
    setSaveError(null);
    try {
      const pb = getClient();
      const token = pb.authStore.token;
      const firstTrim = firstName.trim();
      const lastTrim = lastName.trim();
      if (!firstTrim) throw new Error("First name is required.");
      const nameTrim = combineStaffDisplayName(firstTrim, lastTrim);
      if (!nameTrim) throw new Error("First name is required.");

      const langText = serializeStaffLanguages(languages);

      try {
        await saveStaffCredentialViaApi(token, user.id, {
          first_name: firstTrim,
          last_name: lastTrim,
          display_name: nameTrim,
          staff_name: nameTrim,
          phone: phone.trim(),
          bio: bio.trim(),
          languages: langText,
          strength_cities:
            kind === "guide"
              ? cityOp.trim() || cities.trim()
              : cities.trim(),
          video_url: videoUrl.trim(),
          bank_info: bankInfo.trim(),
          payment_link: paymentLink.trim(),
          payout_notes: payoutNotes.trim(),
          ...(kind === "agency" ? { agency_id: agencyId.trim() } : {}),
        });
      } catch (profileErr) {
        throw new Error(
          `Could not save profile: ${
            profileErr instanceof Error
              ? profileErr.message
              : formatPbError(profileErr)
          }`
        );
      }

      if (photoFile) {
        try {
          await uploadStaffAvatarViaApi(token, user.id, photoFile);
        } catch (photoErr) {
          throw new Error(
            photoErr instanceof Error
              ? photoErr.message
              : "Photo did not save."
          );
        }
      }

      if (kind === "guide") {
        if (!String(user.email || "").trim()) {
          throw new Error(
            "Guide credential needs an email on the staff login."
          );
        }
        const g =
          guide ||
          (await ensureGuideProfile(pb, user.id, {
            full_name: nameTrim,
            email: user.email,
          }));
        const mapTrip = (v: string) =>
          v === "Kawaguchiko / Mt. Fuji" ? "Kawaguchiko" : v;
        const mapAvail = (v: string) =>
          v === "Part-Time / Custom" ? "Part-Time" : v;
        const mapExp = (v: string) => (v === "Otaku / Anime" ? "Otaku" : v);
        const mapJlpt = (v: string) =>
          v === "Native / Fluent" ? "Native" : v;

        await updateGuideProfile(pb, g.id, {
          full_name: nameTrim,
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
        setGuide(await getGuideByStaff(pb, user.id));
      }

      if (kind === "driver") {
        const d =
          driver ||
          (await ensureDriverProfile(pb, user.id, { full_name: nameTrim }));
        const opsCities = cities
          .split(/[,/]/)
          .map((x) => x.trim())
          .filter(Boolean);
        await updateDriverProfile(pb, d.id, {
          full_name: nameTrim,
          phone_number: phone.trim(),
          operating_cities: opsCities,
          operating_license_number: licenseNo.trim(),
          company_fleet_name: fleetName.trim(),
          driver_type: driverType.trim() || "independent",
        });
        setDriver(await getDriverByStaff(pb, user.id));
      }

      await onSaved();
    } catch (e) {
      const detail =
        e instanceof Error && e.message
          ? e.message
          : formatPbError(e);
      setSaveError(detail);
    } finally {
      setSaving(false);
    }
  };

  const docNo = credentialDocNo(
    resolveServeCountry([
      cityOp,
      cities,
      guide?.city_of_operation,
      fleetName,
    ]).code,
    user.id
  );
  const inp =
    "mt-1 w-full rounded-lg border border-[#F6A724]/20 bg-[#0D1117] px-3 py-2 text-sm text-white";

  const identityPage = (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div
          className="h-28 w-20 shrink-0 overflow-hidden bg-zinc-900"
          style={{ boxShadow: `inset 0 0 0 2px ${GOLD}` }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-600">
              —
            </div>
          )}
        </div>
        <label className="flex-1 text-[10px] uppercase tracking-wider text-zinc-400">
          Credential photo
          <span className="mt-0.5 block font-normal normal-case tracking-normal text-zinc-500">
            JPG · 360×480 · auto-compressed for fast load
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="mt-1 block w-full text-xs text-zinc-300"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              void optimizeCredentialPhoto(f)
                .then((file) => {
                  setPhotoFile(file);
                  setSaveError(null);
                })
                .catch((err) =>
                  setSaveError(
                    err instanceof Error ? err.message : "Photo could not be read."
                  )
                );
            }}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[10px] uppercase tracking-wider text-zinc-400">
          First name *
          <input
            className={inp}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-zinc-400">
          Last name
          <input
            className={inp}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            placeholder="Shown after booking is fully paid"
          />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-zinc-400 sm:col-span-2">
          Phone
          <input
            className={inp}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-zinc-400 sm:col-span-2">
          Email
          <input className={inp} value={user.email} disabled />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-zinc-400 sm:col-span-2">
          Bio / notes
          <textarea
            className={inp}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
      </div>
    </div>
  );

  const payoutPage = (
    <div className="space-y-4">
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
  );

  let pageBody: ReactNode = null;
  if (page === 0) {
    pageBody = identityPage;
  } else if (kind === "guide") {
    if (page === 1) {
      pageBody = (
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
                  onClick={() => toggleMulti(dayTrips, setDayTrips, t)}
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
                  onClick={() => toggleMulti(tourLangs, setTourLangs, l)}
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
          <LanguagePills
            selected={languages}
            onToggle={(l) => toggleMulti(languages, setLanguages, l)}
          />
        </div>
      );
    } else if (page === 2) {
      pageBody = (
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
                  onClick={() => toggleMulti(expertise, setExpertise, t)}
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
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] uppercase tracking-wider text-zinc-400">
              Visa type
              <input
                className={inp}
                value={visaType}
                onChange={(e) => setVisaType(e.target.value)}
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
      );
    } else if (page === 3) {
      pageBody = (
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
          {payoutPage}
        </div>
      );
    }
  } else if (kind === "driver" && page === 1) {
    pageBody = (
      <div className="space-y-4">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          Operating cities
          <input
            className={inp}
            value={cities}
            onChange={(e) => setCities(e.target.value)}
            placeholder="Tokyo, Yokohama, Narita…"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          License number
          <input
            className={inp}
            value={licenseNo}
            onChange={(e) => setLicenseNo(e.target.value)}
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          Fleet / company name
          <input
            className={inp}
            value={fleetName}
            onChange={(e) => setFleetName(e.target.value)}
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          Driver type
          <select
            className={inp}
            value={driverType}
            onChange={(e) => setDriverType(e.target.value)}
          >
            <option value="independent">Independent</option>
            <option value="company">Company / fleet</option>
          </select>
        </label>
      </div>
    );
  } else if (kind === "agency" && page === 1) {
    pageBody = (
      <div className="space-y-4">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          Agency id
          <input
            className={inp}
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            placeholder="agencies record id"
          />
        </label>
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          Markets / hubs
          <input
            className={inp}
            value={cities}
            onChange={(e) => setCities(e.target.value)}
            placeholder="Benelux, Spain, LATAM…"
          />
        </label>
        <LanguagePills
          selected={languages}
          onToggle={(l) => toggleMulti(languages, setLanguages, l)}
        />
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          Agency notes
          <textarea
            className={inp}
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Commission terms, preferred contact hours…"
          />
        </label>
      </div>
    );
  } else if (kind === "staff" && page === 1) {
    pageBody = (
      <div className="space-y-4">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-400">
          City / hub coverage
          <input
            className={inp}
            value={cities}
            onChange={(e) => setCities(e.target.value)}
            placeholder="Tokyo ops · Amsterdam HQ…"
          />
        </label>
        <LanguagePills
          selected={languages}
          onToggle={(l) => toggleMulti(languages, setLanguages, l)}
        />
        <p className="text-[11px] text-zinc-500">
          Staff credentials do not use guide day-trips, JLPT, or tour rates.
          Use Coverage for hub + languages, then Payout for bank details.
        </p>
      </div>
    );
  } else if (page === lastPage) {
    pageBody = payoutPage;
  }

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
        <header className="relative z-10 flex items-start justify-between gap-3 border-b border-[#F6A724]/25 px-4 py-3">
          <div>
            <p className="font-godiva text-sm tracking-wider text-[#F6A724]">
              CREDENTIAL BOOKLET
            </p>
            <p className="mt-0.5 text-[10px] tracking-wider text-zinc-500 uppercase">
              {docNo} · {roleBadge(user.role)} · Page {page + 1}/{pages.length}
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
          {pages.map((label, i) => (
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
            pageBody
          )}
        </div>

        <footer className="relative z-10 space-y-2 border-t border-[#F6A724]/20 px-4 py-3">
          {saveError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-950/80 px-3 py-2 text-xs text-red-200"
            >
              {saveError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-full border border-zinc-600 px-4 py-2 text-xs text-zinc-300 disabled:opacity-30"
          >
            ← Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void save()}
              className="rounded-full bg-[#1BA58A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save & close"}
            </button>
            {page < lastPage ? (
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                className="rounded-full px-4 py-2 text-xs font-semibold text-[#0D1117]"
                style={{ background: GOLD }}
              >
                Next →
              </button>
            ) : null}
          </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
