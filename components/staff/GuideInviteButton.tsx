"use client";

import { useEffect, useState } from "react";

/**
 * Ops → generate password-setup / profile onboarding link for a guide.
 * Works with assigned guide or a manually entered email (any domain).
 */
export function GuideInviteButton({
  guideEmail,
  guideName,
  staffId,
}: {
  guideEmail: string;
  guideName: string;
  staffId?: string;
}) {
  const [emailInput, setEmailInput] = useState(guideEmail || "");
  const [nameInput, setNameInput] = useState(guideName || "");
  const [inviteLink, setInviteLink] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEmailInput(guideEmail || "");
  }, [guideEmail]);
  useEffect(() => {
    setNameInput(guideName || "");
  }, [guideName]);

  const handleGenerateOnboardingLink = async () => {
    if (!emailInput.trim()) {
      setError("Guide email is required (Gmail / Yahoo / any domain OK)");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/guides/generate-onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          name: nameInput.trim() || "Guide",
          staffId: staffId || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        onboardingUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.onboardingUrl) {
        setError(data.error || "Could not generate link");
        return;
      }
      setInviteLink(data.onboardingUrl);
    } catch {
      setError("Could not generate link");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-xs">
      <div>
        <span className="block text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
          Guide onboarding &amp; access setup
        </span>
        <p className="text-gray-300">
          Password setup link for personal emails (Gmail, Yahoo, agency domains —
          not Google Workspace SSO).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="email"
          placeholder="guide@gmail.com"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0A1017] px-3 py-2 text-white"
        />
        <input
          type="text"
          placeholder="Guide display name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0A1017] px-3 py-2 text-white"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleGenerateOnboardingLink()}
        disabled={isGenerating || !emailInput.trim()}
        className="w-full rounded-xl bg-[#075473] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase shadow transition hover:bg-[#075473]/80 active:scale-95 disabled:opacity-40"
      >
        {isGenerating ? "Generating…" : "🔗 Create password link"}
      </button>

      {inviteLink ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-black/40 p-3">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-emerald-300 outline-none"
          />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(inviteLink).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="rounded-lg bg-emerald-500 px-3 py-1 text-[10px] font-bold tracking-wider text-black uppercase"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
      <p className="text-[10px] text-zinc-500">
        Creates / links a <code className="text-zinc-400">staff</code> row with
        role <code className="text-zinc-400">guide</code>. Link expires in 14
        days.
      </p>
    </div>
  );
}
