/**
 * Owner/Ops preview alias ("disguise") — sessionStorage + URL params only.
 * Does NOT swap auth identity. Portals apply filters when canAccessOpsBoard.
 */

export type AliasRoleType = "guide" | "driver" | "agency";

export type AliasSession = {
  userId: string;
  userEmail: string;
  roleType: AliasRoleType;
  displayName?: string;
};

const STORAGE = {
  id: "alias_user_id",
  email: "alias_user_email",
  role: "alias_role_type",
  name: "alias_display_name",
} as const;

const URL_KEYS = {
  id: "alias_user_id",
  email: "alias_user_email",
  role: "alias_role",
  name: "alias_display_name",
} as const;

function isAliasRoleType(value: string): value is AliasRoleType {
  return value === "guide" || value === "driver" || value === "agency";
}

export function readAliasSession(): AliasSession | null {
  if (typeof window === "undefined") return null;
  try {
    const userId = String(sessionStorage.getItem(STORAGE.id) || "").trim();
    const userEmail = String(sessionStorage.getItem(STORAGE.email) || "").trim();
    const roleRaw = String(sessionStorage.getItem(STORAGE.role) || "").trim();
    const displayName = String(sessionStorage.getItem(STORAGE.name) || "").trim();
    if (!userId || !isAliasRoleType(roleRaw)) return null;
    return {
      userId,
      userEmail,
      roleType: roleRaw,
      displayName: displayName || undefined,
    };
  } catch {
    return null;
  }
}

export function writeAliasSession(alias: AliasSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE.id, alias.userId);
    sessionStorage.setItem(STORAGE.email, alias.userEmail || "");
    sessionStorage.setItem(STORAGE.role, alias.roleType);
    if (alias.displayName) {
      sessionStorage.setItem(STORAGE.name, alias.displayName);
    } else {
      sessionStorage.removeItem(STORAGE.name);
    }
  } catch {
    /* private mode / blocked storage */
  }
}

export function clearAliasSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE.id);
    sessionStorage.removeItem(STORAGE.email);
    sessionStorage.removeItem(STORAGE.role);
    sessionStorage.removeItem(STORAGE.name);
  } catch {
    /* ignore */
  }
}

/** Merge URL query into sessionStorage (iframe / deep-link). Returns active alias. */
export function syncAliasFromLocationSearch(
  search?: string
): AliasSession | null {
  if (typeof window === "undefined") return null;
  const raw = search ?? window.location.search;
  const params = new URLSearchParams(
    raw.startsWith("?") ? raw.slice(1) : raw
  );
  const userId = String(params.get(URL_KEYS.id) || "").trim();
  const roleRaw = String(params.get(URL_KEYS.role) || "").trim();
  if (userId && isAliasRoleType(roleRaw)) {
    const next: AliasSession = {
      userId,
      userEmail: String(params.get(URL_KEYS.email) || "").trim(),
      roleType: roleRaw,
      displayName:
        String(params.get(URL_KEYS.name) || "").trim() || undefined,
    };
    writeAliasSession(next);
    return next;
  }
  return readAliasSession();
}

export function aliasQueryString(alias: AliasSession): string {
  const params = new URLSearchParams();
  params.set(URL_KEYS.id, alias.userId);
  params.set(URL_KEYS.role, alias.roleType);
  if (alias.userEmail) params.set(URL_KEYS.email, alias.userEmail);
  if (alias.displayName) params.set(URL_KEYS.name, alias.displayName);
  return params.toString();
}

export function buildPreviewHref(
  baseHref: string,
  alias: AliasSession | null
): string {
  if (!alias) return baseHref;
  const q = aliasQueryString(alias);
  if (!q) return baseHref;
  const join = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${join}${q}`;
}

export function aliasLabel(alias: AliasSession): string {
  const name = alias.displayName?.trim();
  const email = alias.userEmail?.trim();
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return alias.userId;
}

export function roleTypeLabel(roleType: AliasRoleType): string {
  switch (roleType) {
    case "guide":
      return "Guide";
    case "driver":
      return "Driver";
    case "agency":
      return "Agency";
  }
}
