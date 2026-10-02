"use client";

import { useRouter } from "next/navigation";

type BuilderType = "multiday" | "single";

interface Props {
  open: boolean;
  builderType: BuilderType;
  /** Return false to abort navigation (e.g. validation failed). */
  onConfirm: () => boolean | void;
}

/**
 * Shown after Pre-Elite steps 1–4 (no contact yet).
 * Preferences stay in local draft until the builder contact gate saves to PocketBase.
 */
export function QuestionnaireCompletionModal({
  open,
  builderType,
  onConfirm,
}: Props) {
  const router = useRouter();

  if (!open) return null;

  const handleEnterBuilder = () => {
    const ok = onConfirm();
    if (ok === false) return;
    if (builderType === "single") {
      router.push("/builder-single");
    } else {
      router.push("/builder");
    }
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md duration-200">
      <div className="relative w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-[#0A1017] p-6 text-center shadow-2xl">
        <div className="flex justify-center -mt-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/note-icon.webp"
            alt="TokioTours Mascot"
            className="h-28 w-28 animate-bounce object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
          />
        </div>

        <div className="space-y-2">
          <span className="rounded-full border border-[#F6A724]/30 bg-[#F6A724]/20 px-3 py-1 text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
            Preferences Saved in Draft
          </span>
          <h2 className="font-godiva text-xl tracking-wide text-white uppercase sm:text-2xl">
            Now You Can Build Your Trip!
          </h2>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-xs leading-relaxed text-gray-300">
          <p className="font-medium text-white">
            Tap what you love—secret food spots, private day tours, or exclusive
            Japan tickets—and build your bespoke VIP experience instantly!
          </p>
        </div>

        <button
          type="button"
          onClick={handleEnterBuilder}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#075473] py-3.5 text-xs font-bold tracking-widest text-white uppercase shadow-lg transition-transform hover:bg-[#075473]/80 active:scale-95"
        >
          <span>OK, Let&apos;s Build</span>
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
