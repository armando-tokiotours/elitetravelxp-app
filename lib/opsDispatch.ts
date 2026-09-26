/**
 * Silo 3 ops_dispatch pocket — guide/driver assign vs job board by PNR.
 * Dual-writes assign fields to ops_hub during cutover.
 */

import type PocketBase from "pocketbase";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";

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
    /* hub may lack fields during/after thin migration — ignore */
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
  const updated = (await pb.collection("ops_dispatch").update(
    row.id,
    {
      guide_mode: "direct",
      assigned_guide_id: opts.staffId,
      assigned_guide: opts.staffName,
      guide_board_visible: false,
      assigned_by_staff_id: opts.byStaffId || "",
    },
    { requestKey: null }
  )) as OpsDispatchRow;
  await dualWriteHubAssign(pb, pnr, {
    assigned_guide_id: opts.staffId,
    assigned_guide: opts.staffName,
  });
  await syncMoneyGuideName(pb, pnr, opts.staffName);
  try {
    const { ensurePayout } = await import("@/lib/opsPayouts");
    await ensurePayout(pb, {
      pnr,
      staffId: opts.staffId,
      staffName: opts.staffName,
      role: "guide",
    });
  } catch {
    /* ignore */
  }
  return updated;
}

export async function postGuideBoard(
  pb: PocketBase,
  opts: { pnr: string; byStaffId?: string }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  const updated = (await pb.collection("ops_dispatch").update(
    row.id,
    {
      guide_mode: "open",
      assigned_guide_id: "",
      assigned_guide: "",
      guide_board_visible: true,
      assigned_by_staff_id: opts.byStaffId || "",
    },
    { requestKey: null }
  )) as OpsDispatchRow;
  await dualWriteHubAssign(pb, pnr, {
    assigned_guide_id: "",
    assigned_guide: "",
  });
  return updated;
}

export async function claimGuideJob(
  pb: PocketBase,
  opts: { pnr: string; staffId: string; staffName: string }
): Promise<OpsDispatchRow> {
  const pnr = safePnr(opts.pnr);
  const row = await ensureDispatchRow(pb, pnr);
  if (row.assigned_guide_id && row.assigned_guide_id !== opts.staffId) {
    throw new Error("Already claimed by another guide");
  }
  if (!row.guide_board_visible && row.guide_mode !== "open") {
    throw new Error("Job is not open on the board");
  }
  const updated = (await pb.collection("ops_dispatch").update(
    row.id,
    {
      guide_mode: "claimed",
      assigned_guide_id: opts.staffId,
      assigned_guide: opts.staffName,
      guide_board_visible: false,
      claimed_at: new Date().toISOString().slice(0, 10),
    },
    { requestKey: null }
  )) as OpsDispatchRow;
  await dualWriteHubAssign(pb, pnr, {
    assigned_guide_id: opts.staffId,
    assigned_guide: opts.staffName,
  });
  await syncMoneyGuideName(pb, pnr, opts.staffName);
  try {
    const { ensurePayout } = await import("@/lib/opsPayouts");
    await ensurePayout(pb, {
      pnr,
      staffId: opts.staffId,
      staffName: opts.staffName,
      role: "guide",
    });
  } catch {
    /* ignore */
  }
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

/** Server-side ensure when hub row is created. */
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
