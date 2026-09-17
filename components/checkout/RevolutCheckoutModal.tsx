"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, X } from "lucide-react";
import { formatUsd } from "@/lib/builder-pricing";
import {
  loadRevolutCheckout,
  type RevolutCheckoutMode,
} from "@/lib/revolutCheckout";

export type PaymentTypeOption = "deposit" | "partial" | "full";

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingRef: string;
  /** Grand total in major currency units (e.g. 4496 for €4,496) */
  totalAmount: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  /** Default selected deposit percentage (e.g. 10) */
  defaultDepositPercent?: number;
  /** Optional secondary amount shown as range high (if > totalAmount) */
  totalAmountMax?: number;
  /** Optional low end for range label only (charge still uses totalAmount) */
  totalAmountMin?: number;
  onPaymentSuccess?: (paymentDetails: {
    bookingRef: string;
    paymentType: PaymentTypeOption;
    amountPaid: number;
    currency: string;
    orderId: string | null;
    token: string;
    customerEmail: string;
    customerName: string;
    customerPhone: string;
  }) => void;
  onPaymentError?: (message: string) => void;
}

const PARTIAL_PERCENT = 50;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhone(v: string): boolean {
  // Allow international formats; require at least 7 digits overall.
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function RevolutCheckoutModal({
  isOpen,
  onClose,
  bookingRef,
  totalAmount,
  currency = "EUR",
  customerEmail = "",
  customerName = "",
  customerPhone = "",
  defaultDepositPercent = 10,
  totalAmountMax,
  totalAmountMin,
  onPaymentSuccess,
  onPaymentError,
}: PaymentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentTypeOption>("deposit");
  const [email, setEmail] = useState(customerEmail);
  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState(customerPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositPct = Math.min(100, Math.max(1, defaultDepositPercent || 10));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPaymentType("deposit");
    setEmail(customerEmail);
    setName(customerName);
    setPhone(customerPhone);
    setError(null);
    setBusy(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, customerEmail, customerName, customerPhone]);

  const amounts = useMemo(() => {
    const total = Math.max(0, totalAmount);
    return {
      deposit: roundMoney((total * depositPct) / 100),
      partial: roundMoney((total * PARTIAL_PERCENT) / 100),
      full: roundMoney(total),
    };
  }, [totalAmount, depositPct]);

  const chargeAmount = useMemo(() => {
    if (paymentType === "partial") return amounts.partial;
    if (paymentType === "full") return amounts.full;
    return amounts.deposit;
  }, [paymentType, amounts]);

  const contactReady =
    isValidEmail(email.trim()) &&
    name.trim().length > 1 &&
    isValidPhone(phone.trim());

  const handlePay = async () => {
    if (busy) return;
    if (chargeAmount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    const emailTrim = email.trim();
    const nameTrim = name.trim();
    const phoneTrim = phone.trim();

    if (!emailTrim || !isValidEmail(emailTrim)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!nameTrim) {
      setError("Please enter your full name.");
      return;
    }
    if (!phoneTrim || !isValidPhone(phoneTrim)) {
      setError("Please enter a valid phone number.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/revolut/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: chargeAmount,
          currency,
          bookingRef,
          customerEmail: emailTrim,
          customerName: nameTrim,
          customerPhone: phoneTrim,
          paymentType,
          description: `Elite Travel XP · ${bookingRef} · ${paymentType}`,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        token?: string;
        orderId?: string | null;
        mode?: RevolutCheckoutMode;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.token) {
        const msg =
          data.error ||
          (data.code === "REVOLUT_NOT_CONFIGURED"
            ? "Revolut is not configured on this server yet."
            : "Could not start checkout.");
        setError(msg);
        onPaymentError?.(msg);
        return;
      }

      const RevolutCheckout = await loadRevolutCheckout();
      // Prefer server-reported mode; fall back to sandbox for local testing.
      const mode: RevolutCheckoutMode =
        data.mode === "prod" ? "prod" : "sandbox";
      const instance = await RevolutCheckout(data.token, mode);

      instance.payWithPopup({
        email: emailTrim,
        name: nameTrim,
        phone: phoneTrim,
        onSuccess: () => {
          setBusy(false);
          onPaymentSuccess?.({
            bookingRef,
            paymentType,
            amountPaid: chargeAmount,
            currency,
            orderId: data.orderId ?? null,
            token: data.token!,
            customerEmail: emailTrim,
            customerName: nameTrim,
            customerPhone: phoneTrim,
          });
          onClose();
        },
        onError: (err) => {
          const msg = err?.message || "Payment failed. Please try again.";
          setError(msg);
          onPaymentError?.(msg);
          setBusy(false);
        },
        onCancel: () => {
          setBusy(false);
        },
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Unable to open Revolut checkout.";
      setError(msg);
      onPaymentError?.(msg);
      setBusy(false);
    }
  };

  if (!mounted) return null;

  const rangeLabel =
    totalAmountMin != null && totalAmountMin < totalAmount
      ? `${formatUsd(totalAmountMin)} – ${formatUsd(totalAmount)}`
      : totalAmountMax && totalAmountMax > totalAmount
        ? `${formatUsd(totalAmount)} – ${formatUsd(totalAmountMax)}`
        : formatUsd(totalAmount);

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Revolut checkout"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/50"
            onClick={() => {
              if (!busy) onClose();
            }}
          />
          <motion.div
            className="relative z-[1] max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex justify-center pt-3 sm:hidden" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-[#D9D2C7]" />
            </div>

            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 sm:pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C4A35A]">
                  Secure checkout
                </p>
                <h3 className="mt-1 font-display text-2xl text-[#0B1F3A]">
                  Pay with Revolut
                </h3>
                <p className="mt-1 text-xs text-[#8A8278]">
                  Booking {bookingRef}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!busy) onClose();
                }}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8E2D9] text-[#5C6570] transition hover:bg-[#F7F3EB]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 pb-2">
              <div className="rounded-2xl border border-[#E8E2D9] bg-[#FBF8F2] px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A8278]">
                  Experience Japan Range
                </p>
                <p className="mt-1 font-display text-xl text-[#0B1F3A]">
                  Est. {rangeLabel}
                </p>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C4A35A]">
                  Payment type
                </p>
                <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <PayTypeBtn
                    active={paymentType === "deposit"}
                    onClick={() => setPaymentType("deposit")}
                    label={`${depositPct}% Deposit`}
                    amount={amounts.deposit}
                  />
                  <PayTypeBtn
                    active={paymentType === "partial"}
                    onClick={() => setPaymentType("partial")}
                    label={`${PARTIAL_PERCENT}% Partial`}
                    amount={amounts.partial}
                  />
                  <PayTypeBtn
                    active={paymentType === "full"}
                    onClick={() => setPaymentType("full")}
                    label="100% Full"
                    amount={amounts.full}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#C4A35A]/40 bg-[#FBF6EA] px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#C4A35A]" aria-hidden />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C4A35A]">
                    Amount due now
                  </p>
                </div>
                <p className="mt-1.5 font-display text-2xl text-[#0B1F3A]">
                  {chargeAmount > 0 ? formatUsd(chargeAmount) : "—"}
                </p>
              </div>

              <div className="grid gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[#5C6570]">
                    Email Address *
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#C4A35A]"
                    placeholder="you@email.com"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[#5C6570]">
                    Full Name *
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#C4A35A]"
                    placeholder="e.g. John Doe"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[#5C6570]">
                    Phone Number *
                  </span>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#E8E2D9] bg-white px-3 py-2.5 text-sm text-[#0B1F3A] outline-none focus:border-[#C4A35A]"
                    placeholder="e.g. +31 6 12345678"
                  />
                </label>
              </div>

              <p className="rounded-xl bg-[#F7F3EB] px-3.5 py-3 text-xs leading-relaxed text-[#5C6570]">
                A travel expert will arrange the final details — hotels, guides,
                and timing — and confirm your exact quotation before any
                remaining balance is due.
              </p>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-700">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <button
                type="button"
                disabled={busy || chargeAmount <= 0 || !contactReady}
                onClick={handlePay}
                className="w-full rounded-full bg-[#0B1F3A] py-3.5 text-sm font-semibold text-white transition hover:bg-[#143052] disabled:opacity-50"
              >
                {busy
                  ? "Opening Revolut…"
                  : `Pay ${chargeAmount > 0 ? formatUsd(chargeAmount) : ""} with Revolut`}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="w-full rounded-full border border-[#D9D2C7] bg-white py-3 text-sm font-semibold text-[#0B1F3A] transition hover:bg-[#F7F3EB] disabled:opacity-50"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function PayTypeBtn({
  active,
  onClick,
  label,
  amount,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  amount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? "border-[#0B1F3A] bg-[#0B1F3A] text-white"
          : "border-[#E8E2D9] bg-white text-[#0B1F3A] hover:border-[#C4A35A]"
      }`}
    >
      <span className="block text-xs font-semibold">{label}</span>
      <span
        className={`mt-0.5 block text-[11px] ${
          active ? "text-white/70" : "text-[#8A8278]"
        }`}
      >
        {formatUsd(amount)}
      </span>
    </button>
  );
}

export default RevolutCheckoutModal;
