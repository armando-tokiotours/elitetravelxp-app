"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  VendorInspectorLayout,
  type VendorInspectorRole,
} from "@/components/staff/VendorInspectorLayout";
import {
  bookingFromVendorView,
  inspectorRoleFromVendorView,
} from "@/lib/vendorInspectorMap";
import type { VendorViewPayload } from "@/lib/vendorDispatch";

/**
 * Shared token portal shell — same inspector chrome for every vendor role.
 */
export function VendorPortalClient({
  token,
  expectedRole,
}: {
  token: string;
  expectedRole?: VendorInspectorRole;
}) {
  const [view, setView] = useState<VendorViewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/portal/vendor-view?token=${encodeURIComponent(token)}`
        );
        const data = (await res.json()) as {
          view?: VendorViewPayload;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.view) {
          setError(data.error || "Unable to load dispatch");
          return;
        }
        const role = inspectorRoleFromVendorView(data.view);
        if (expectedRole && role !== expectedRole) {
          setError("This link is for a different vendor role.");
          return;
        }
        setView(data.view);
      } catch {
        if (!cancelled) setError("Network error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, expectedRole]);

  const role = useMemo(
    () => (view ? inspectorRoleFromVendorView(view) : null),
    [view]
  );
  const booking = useMemo(
    () => (view ? bookingFromVendorView(view) : null),
    [view]
  );

  const onUpdateStatus = useCallback(
    async (status: string) => {
      setConfirming(true);
      setFlash(null);
      try {
        const res = await fetch("/api/portal/vendor-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, status }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error || "Confirm failed");
        setFlash("Assignment confirmed — Ops has been notified.");
      } catch (e) {
        setFlash(e instanceof Error ? e.message : "Confirm failed");
      } finally {
        setConfirming(false);
      }
    },
    [token]
  );

  const onAddNote = useCallback(
    async (note: string) => {
      setFlash(null);
      try {
        const res = await fetch("/api/portal/vendor-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, note }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error || "Note failed");
        setFlash("Note sent to Ops.");
      } catch (e) {
        setFlash(e instanceof Error ? e.message : "Note failed");
      }
    },
    [token]
  );

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </p>
    );
  }
  if (!view || !role || !booking) {
    return <p className="text-sm text-zinc-500">Loading dispatch…</p>;
  }

  return (
    <div className="space-y-3">
      <VendorInspectorLayout
        role={role}
        booking={booking}
        onUpdateStatus={onUpdateStatus}
        onAddNote={onAddNote}
        confirming={confirming}
      />
      {flash ? (
        <p className="text-center text-xs text-[#7ec8e3]">{flash}</p>
      ) : null}
    </div>
  );
}
