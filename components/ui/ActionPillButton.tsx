"use client";

/**
 * High-converting neon pill CTA — teal → amber gradient, white double ring, amber glow.
 * Default labels: Secure My Dates / Pay Balance. Pass `label` for custom copy.
 */
export function ActionPillButton({
  conciergeFeePaid = false,
  paymentConfirmed = false,
  onClick,
  disabled = false,
  className = "",
  pulse = false,
  label: labelOverride,
}: {
  conciergeFeePaid?: boolean;
  paymentConfirmed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  /** Soft glow pulse before first interaction */
  pulse?: boolean;
  /** Custom label — overrides Secure My Dates / Pay Balance */
  label?: string;
}) {
  if (paymentConfirmed && !labelOverride) return null;

  const label =
    labelOverride ?? (conciergeFeePaid ? "Pay Balance" : "Secure My Dates");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`group relative inline-flex max-w-full items-center justify-center overflow-hidden rounded-full p-[2px] shadow-[0_0_20px_rgba(246,167,36,0.35)] transition-all duration-300 hover:shadow-[0_0_28px_rgba(246,167,36,0.55)] focus:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        pulse ? "animate-widget-call-glow" : ""
      } ${className}`}
    >
      {/* Outer brand gradient ring */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-gradient-to-r from-[#075473] via-[#086B94] to-[#F6A724]"
      />

      {/* Inner white stroke + pill fill */}
      <span className="relative flex w-full items-center justify-center gap-2.5 rounded-full border border-white/85 bg-gradient-to-r from-[#075473] via-[#075473]/92 to-[#0A1017] px-4 py-2.5 transition-all group-hover:border-white sm:gap-3 sm:px-5 sm:py-3">
        <span className="font-godiva text-[10px] font-bold tracking-[0.14em] text-white uppercase drop-shadow-sm sm:text-xs sm:tracking-[0.16em]">
          {label}
        </span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold text-[#075473] shadow-md transition-transform group-hover:translate-x-0.5">
          ▶
        </span>
      </span>
    </button>
  );
}
