/// <reference path="../pb_data/types.d.ts" />
/**
 * Flexible staff provisioning (collection = `staff`, not `users`):
 * - Core @tokiotours.nl leadership → fixed roles
 * - Admin-selected role always respected for non-core emails
 * - account_type GUIDE / TRAVEL_AGENT → guide / agency
 * - Other @tokiotours.nl → agent (concierge)
 * - Unknown external → agent + active=false (pending approval)
 * Never blocks creating test / guide / agency accounts with any email.
 */

const CORE_STAFF_MAP = {
  "armando@tokiotours.nl": "owner",
  "management@tokiotours.nl": "owner",
  "ivonne@tokiotours.nl": "accounting",
  "melissa@tokiotours.nl": "ops",
  "vip@tokiotours.nl": "agent",
};

const VALID_ROLES = {
  owner: true,
  ops: true,
  agent: true,
  accounting: true,
  ticketer: true,
  guide: true,
  driver: true,
  agency: true,
};

function normalizeEmail(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function normalizeAccountType(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

function applyFlexibleProvisioning(record, isCreate) {
  const email = normalizeEmail(record.get("email"));
  const existingRole = String(record.get("role") || "").trim();
  const accountType = normalizeAccountType(record.get("account_type"));

  // 1) Core leadership matrix (authoritative)
  if (CORE_STAFF_MAP[email]) {
    record.set("role", CORE_STAFF_MAP[email]);
    record.set("account_type", "STAFF");
    if (record.get("active") === null || record.get("active") === undefined) {
      record.set("active", true);
    }
  } else if (existingRole && VALID_ROLES[existingRole]) {
    // 2) Keep Admin / invite-selected role (guides, agencies, test agents…)
    record.set("role", existingRole);
    if (!accountType) {
      if (existingRole === "guide") record.set("account_type", "GUIDE");
      else if (existingRole === "agency")
        record.set("account_type", "TRAVEL_AGENT");
      else record.set("account_type", "STAFF");
    }
    if (record.get("active") === null || record.get("active") === undefined) {
      record.set("active", true);
    }
  } else if (accountType === "GUIDE") {
    record.set("role", "guide");
    record.set("account_type", "GUIDE");
    if (record.get("active") === null || record.get("active") === undefined) {
      record.set("active", true);
    }
  } else if (
    accountType === "TRAVEL_AGENT" ||
    accountType === "AGENCY"
  ) {
    record.set("role", "agency");
    record.set("account_type", "TRAVEL_AGENT");
    if (record.get("active") === null || record.get("active") === undefined) {
      record.set("active", true);
    }
  } else if (
    email.endsWith("@tokiotours.nl") ||
    email.endsWith("@travelexperiencesgroup.com")
  ) {
    // 3) Flexible / fictitious internal staff
    record.set("role", "agent");
    record.set("account_type", "STAFF");
    if (record.get("active") === null || record.get("active") === undefined) {
      record.set("active", true);
    }
  } else if (isCreate) {
    // 4) Unknown external — park as pending (login blocked until Ops activates)
    record.set("role", "agent");
    record.set("account_type", "PENDING");
    record.set("active", false);
  }

  if (!String(record.get("name") || "").trim() && email) {
    const local = email.split("@")[0] || "Staff";
    record.set("name", local.charAt(0).toUpperCase() + local.slice(1));
  }
}

onRecordCreateRequest((e) => {
  if (e.collection.name !== "staff") {
    e.next();
    return;
  }
  applyFlexibleProvisioning(e.record, true);
  e.next();
}, "staff");

onRecordUpdateRequest((e) => {
  if (e.collection.name !== "staff") {
    e.next();
    return;
  }
  const email = normalizeEmail(e.record.get("email"));
  // Only re-lock core team on update; everyone else stays as Admin edited
  if (CORE_STAFF_MAP[email]) {
    e.record.set("role", CORE_STAFF_MAP[email]);
    e.record.set("account_type", "STAFF");
  }
  e.next();
}, "staff");
