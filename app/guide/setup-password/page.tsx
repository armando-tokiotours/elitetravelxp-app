"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function GuideSetupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = String(searchParams.get("token") || "").trim();

  const [preview, setPreview] = useState<{
    fullName: string;
    email: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [languages, setLanguages] = useState("English");
  const [lineId, setLineId] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError("Missing onboarding token");
      return;
    }
    let cancelled = false;
    void fetch(
      `/api/guides/complete-onboarding?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    )
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as {
          fullName?: string;
          email?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(data.error || "Invalid onboarding link");
          return;
        }
        setPreview({
          fullName: data.fullName || "Guide",
          email: data.email || "",
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load invite");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/guides/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          phone,
          languages: languages.split(",").map((l) => l.trim()),
          lineId,
          emergencyContact,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(data.error || "Could not save profile");
        return;
      }
      router.push("/guide");
    } catch {
      setFormError("Could not save profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-[#0A1017] p-8 text-center text-xs text-red-300">
        {loadError}
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="text-sm text-zinc-500">Loading invite…</div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmitProfile(e)}
      className="w-full max-w-lg space-y-5 rounded-3xl border border-white/10 bg-[#0A1017] p-8 text-xs text-white shadow-2xl"
    >
      <div className="space-y-1">
        <span className="text-[10px] font-bold tracking-widest text-[#F6A724] uppercase">
          TokioTours guide roster setup
        </span>
        <h1 className="text-lg font-bold tracking-wide text-white uppercase">
          Set password &amp; complete profile
        </h1>
        <p className="text-[11px] text-zinc-400">
          {preview.fullName}
          {preview.email ? ` · ${preview.email}` : ""}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
            Create password *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
            Confirm password *
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-white"
          />
        </div>

        <div className="space-y-3 border-t border-white/10 pt-3">
          <span className="block text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
            Mandatory contact &amp; language information
          </span>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Mobile phone number *
            </label>
            <input
              type="tel"
              required
              placeholder="+81 90-1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Spoken languages (comma separated) *
            </label>
            <input
              type="text"
              required
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              LINE ID / WhatsApp number *
            </label>
            <input
              type="text"
              required
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">
              Emergency contact
            </label>
            <input
              type="text"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D1117] px-4 py-2.5 text-white"
            />
          </div>
        </div>
      </div>

      {formError ? (
        <p className="text-[11px] text-red-400">{formError}</p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-[#075473] py-4 text-xs font-bold tracking-wider text-white uppercase shadow-xl transition hover:bg-[#075473]/80 active:scale-[0.98] disabled:opacity-40"
      >
        {isSubmitting
          ? "Saving profile…"
          : "Complete profile & access guide portal →"}
      </button>
    </form>
  );
}

export default function GuideSetupPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080C] p-4">
      <Suspense
        fallback={<div className="text-sm text-zinc-500">Loading…</div>}
      >
        <GuideSetupForm />
      </Suspense>
    </div>
  );
}
