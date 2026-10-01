/**
 * Silo 3 ops_dispatch — guide/driver assign vs job board by PNR.
 *
 * Guide double-confirmation (PB-safe legacy guide_mode select):
 *   Send → guide_mode=direct + guide_response=pending
 *   Accept → guide_mode=claimed + guide_response=accepted
 *   Refuse → clear assign + guide_response=refused
 *   Board → guide_mode=open + guide_response=none
 */

import type PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  isGuideBoardOpen,
  isGuidePendingAcceptance,
} from "@/lib/guideConfirmStatus";

export type DispatchMode = "unassigned" | "direct" | "open" | "claimed";

export type OpsDispatchRow = {
  id: string;
  pnr: string;
  guide_mode?: DispatchMode | string;
  driver_mode?: DispatchMode | string;
  assigned_guide_id?: string;
  assigned_guide?: string;
  assigned_driver_id?: string;
  assigned_driver?: string;
  guide_board_visible?: boolean;
  driver_board_visible?: boolean;
  claimed_at?: string;
  assigned_by_staff_id?: string;
  tickets_needed?: boolean;
  driver_needed?: boolean;
  guide_needed?: boolean;
  /** none | pending | accepted | refused */
  guide_response?: string;
};

function safePnr(pnr: string): string {
  return String(pnr || "")
    .trim()
    .toUpperCase()
    .replace(/"/g, "");
}

export async function ensureDispatchRow(
  pb: PocketBase,
  pnrRaw: string
): Promise<OpsDispatchRow> {
  const pnr = safePnr(pnrRaw);
  if (!pnr) throw new Error("pnr required");
  try {
    return await pb
      .collection("ops_dispatch")
      .getFirstListItem<OpsDispatchRow>(`pnr="${pnr}"`, { requestKey: null });
  } catch {
    try {
      return (await pb.collection("ops_dispatch").create(
        {
          pnr,
          guide_mode: "unassigned",
          driver_mode: "unassigned",
          guide_board_visible: false,
          driver_board_visible: false,
        },
        { requestKey: null }
      )) as OpsDispatchRow;
    } catch (err) {
      throw err;
    }
  }
}

async function dualWriteHubAssign(
  pb: PocketBase,
  pnr: string,
  patch: Record<string, unknown>
): Promise<void> {
  try {
    const hub = await pb
      .collection("ops_hub")
      .getFirstListItem(`pnr="${pnr}"`, { requestKey: null });
    await pb.collection("ops_hub").update(hub.id, patch, { requestKey: null });
  } catch {
    /* ignore */
  }
}

async function syncMoneyGuideName(
  pb: PocketBase,
  pnr: string,
  guideName: string
): Promise<void> {
  try {
    const { ensureMoneyRow } = await import("@/lib/opsMoney");
    const money = await ensureMoneyRow(pb, pnr);
    await pb
      .collection("ops_money")
      .update(
        money.id,
        { assigned_guide: guideName },
        { requestKey: null }
      );
  } catch {
    /* ignore */
  }
}

async function updateDispatch(
  pb: PocketBase,
  id: string,
  patch: Record<string, unknown>
): Promise<OpsDispatchRow> {
  try {
    return (await pb
      .collection("ops_dispatch")
      .update(id, patch, { requestKey: null })) as OpsDispatchRow;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Pre-migration: guide_response select may not exist yet
    if (
      "guide_response" in patch &&
      (msg.includes("guide_response") || msg.includes("Unknown field"))
    ) {
      const { guide_response: _drop, ...rest } = patch;
      return (await pb
        .collection("ops_dispatch")
        .update(id, rest, { requestKey: null })) as OpsDispatchRow;
    }
    throw err;
  }
}

async function ensureGuidePayout(
  pb: PocketBase,
  opts: { pnr: string; staffId: string; staffName: string }
): Promise<void> {
  try {
    const { ensurePayout } = await import("@/lib/opsPayouts");
    await ensurePayout(pb, {
      pnr: opts.pnr,
      staffId: opts.staffId,
      staffName: opts.staffName,
      role: "guide",
    });
  } catch {
    /* ignore */
  }
}

/** Send selected guide for approval (does not confirm client-side yet). */
export async function assignGuide(
  pb: PocketBase,
  opts: {
    pnr: string;
    staffId: string;
    staffName: string;
    byStaffId?: string;
  }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  const updated = await updateDispatch(pb, row.id, {
    guide_mode: "direct",
    guide_response: "pending",
    assigned_guide_id: opts.staffId,
    assigned_guide: opts.staffName,
    guide_board_visible: false,
    assigned_by_staff_id: opts.byStaffId || "",
  });
  await dualWriteHubAssign(pb, pnr, {
    assigned_guide_id: opts.staffId,
    assigned_guide: opts.staffName,
  });
  await syncMoneyGuideName(pb, pnr, opts.staffName);
  await ensureGuidePayout(pb, {
    pnr,
    staffId: opts.staffId,
    staffName: opts.staffName,
  });
  return updated;
}

/** Post job for any qualified guide → open board. */
export async function postGuideBoard(
  pb: PocketBase,
  opts: { pnr: string; byStaffId?: string }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  const updated = await updateDispatch(pb, row.id, {
    guide_mode: "open",
    guide_response: "none",
    assigned_guide_id: "",
    assigned_guide: "",
    guide_board_visible: true,
    assigned_by_staff_id: opts.byStaffId || "",
  });
  await dualWriteHubAssign(pb, pnr, {
    assigned_guide_id: "",
    assigned_guide: "",
  });
  return updated;
}

/** Guide accepts pending assign or claims open board → confirmed. */
export async function claimGuideJob(
  pb: PocketBase,
  opts: { pnr: string; staffId: string; staffName: string }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  const pending = isGuidePendingAcceptance(
    row.guide_mode,
    row.guide_response
  );
  const boardOpen = isGuideBoardOpen(
    row.guide_mode,
    Boolean(row.guide_board_visible)
  );

  if (pending) {
    if (row.assigned_guide_id && row.assigned_guide_id !== opts.staffId) {
      throw new Error("Assigned to another guide");
    }
  } else if (boardOpen) {
    if (row.assigned_guide_id && row.assigned_guide_id !== opts.staffId) {
      throw new Error("Already claimed by another guide");
    }
  } else {
    throw new Error("Job is not open for acceptance");
  }

  const updated = await updateDispatch(pb, row.id, {
    guide_mode: "claimed",
    guide_response: "accepted",
    assigned_guide_id: opts.staffId,
    assigned_guide: opts.staffName,
    guide_board_visible: false,
    claimed_at: new Date().toISOString().slice(0, 10),
  });
  await dualWriteHubAssign(pb, pnr, {
    assigned_guide_id: opts.staffId,
    assigned_guide: opts.staffName,
  });
  await syncMoneyGuideName(pb, pnr, opts.staffName);
  await ensureGuidePayout(pb, {
    pnr,
    staffId: opts.staffId,
    staffName: opts.staffName,
  });
  return updated;
}

/** Guide refuses a pending assignment — Ops can pick another or post board. */
export async function refuseGuideJob(
  pb: PocketBase,
  opts: { pnr: string; staffId: string }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  if (!isGuidePendingAcceptance(row.guide_mode, row.guide_response)) {
    throw new Error("Job is not pending acceptance");
  }
  if (row.assigned_guide_id && row.assigned_guide_id !== opts.staffId) {
    throw new Error("This job is assigned to another guide");
  }
  const updated = await updateDispatch(pb, row.id, {
    guide_mode: "unassigned",
    guide_response: "refused",
    assigned_guide_id: "",
    assigned_guide: "",
    guide_board_visible: false,
  });
  await dualWriteHubAssign(pb, pnr, {
    assigned_guide_id: "",
    assigned_guide: "",
  });
  return updated;
}

/** Ops clears a pending/refused slot to pick a new guide. */
export async function clearGuideAssignment(
  pb: PocketBase,
  opts: { pnr: string; byStaffId?: string }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  const updated = await updateDispatch(pb, row.id, {
    guide_mode: "unassigned",
    guide_response: "none",
    assigned_guide_id: "",
    assigned_guide: "",
    guide_board_visible: false,
    assigned_by_staff_id: opts.byStaffId || "",
  });
  await dualWriteHubAssign(pb, pnr, {
    assigned_guide_id: "",
    assigned_guide: "",
  });
  return updated;
}

export async function assignDriver(
  pb: PocketBase,
  opts: {
    pnr: string;
    staffId: string;
    staffName: string;
    byStaffId?: string;
  }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  const updated = (await pb.collection("ops_dispatch").update(
    row.id,
    {
      driver_mode: "direct",
      assigned_driver_id: opts.staffId,
      assigned_driver: opts.staffName,
      driver_board_visible: false,
      assigned_by_staff_id: opts.byStaffId || "",
    },
    { requestKey: null }
  )) as OpsDispatchRow;
  await dualWriteHubAssign(pb, pnr, {
    assigned_driver_id: opts.staffId,
    assigned_driver: opts.staffName,
  });
  try {
    const { ensurePayout } = await import("@/lib/opsPayouts");
    await ensurePayout(pb, {
      pnr,
      staffId: opts.staffId,
      staffName: opts.staffName,
      role: "driver",
    });
  } catch {
    /* ignore */
  }
  return updated;
}

export async function postDriverBoard(
  pb: PocketBase,
  opts: { pnr: string; byStaffId?: string }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  const updated = (await pb.collection("ops_dispatch").update(
    row.id,
    {
      driver_mode: "open",
      assigned_driver_id: "",
      assigned_driver: "",
      driver_board_visible: true,
      assigned_by_staff_id: opts.byStaffId || "",
    },
    { requestKey: null }
  )) as OpsDispatchRow;
  await dualWriteHubAssign(pb, pnr, {
    assigned_driver_id: "",
    assigned_driver: "",
  });
  return updated;
}

export async function claimDriverJob(
  pb: PocketBase,
  opts: { pnr: string; staffId: string; staffName: string }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  if (row.assigned_driver_id && row.assigned_driver_id !== opts.staffId) {
    throw new Error("Already claimed by another driver");
  }
  if (!row.driver_board_visible && row.driver_mode !== "open") {
    throw new Error("Job is not open on the board");
  }
  const updated = (await pb.collection("ops_dispatch").update(
    row.id,
    {
      driver_mode: "claimed",
      assigned_driver_id: opts.staffId,
      assigned_driver: opts.staffName,
      driver_board_visible: false,
      claimed_at: new Date().toISOString().slice(0, 10),
    },
    { requestKey: null }
  )) as OpsDispatchRow;
  await dualWriteHubAssign(pb, pnr, {
    assigned_driver_id: opts.staffId,
    assigned_driver: opts.staffName,
  });
  try {
    const { ensurePayout } = await import("@/lib/opsPayouts");
    await ensurePayout(pb, {
      pnr,
      staffId: opts.staffId,
      staffName: opts.staffName,
      role: "driver",
    });
  } catch {
    /* ignore */
  }
  return updated;
}

export async function ensureDispatchForPnrAdmin(
  pnrRaw: string
): Promise<void> {
  try {
    const pb = await getAdminPocketBase();
    await ensureDispatchRow(pb, pnrRaw);
  } catch (err) {
    console.warn(
      "[ops_dispatch]",
      err instanceof Error ? err.message : "ensure failed"
    );
  }
}
