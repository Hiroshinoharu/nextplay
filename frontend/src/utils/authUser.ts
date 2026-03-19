export type AuthUser = {
  id?: number;
  username?: string;
  email?: string;
  steam_linked?: boolean;
  token?: string;
};

export const normalizeAuthUser = (payload: unknown): AuthUser | null => {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;
  const idValue = data.id ?? data.user_id ?? data.userId;
  let id: number | undefined;
  if (typeof idValue === "number") {
    id = idValue;
  } else if (typeof idValue === "string" && idValue.trim()) {
    const parsed = Number(idValue);
    if (!Number.isNaN(parsed)) {
      id = parsed;
    }
  }

  const username = typeof data.username === "string" ? data.username : undefined;
  const email = typeof data.email === "string" ? data.email : undefined;
  const steamLinked =
    typeof data.steam_linked === "boolean"
      ? data.steam_linked
      : typeof data.steamLinked === "boolean"
        ? data.steamLinked
        : undefined;

  if (!id && !username && !email) {
    return null;
  }

  return {
    id,
    username,
    email,
    steam_linked: steamLinked,
  };
};

export const hasAuthIdentity = (payload: unknown) => normalizeAuthUser(payload) !== null;

export const getUserDisplayName = (authUser: AuthUser | null | undefined) =>
  authUser?.username ?? authUser?.email ?? "User";

export const getUserInitials = (
  authUser: AuthUser | null | undefined,
  fallback = "NP",
) => {
  const displayName = getUserDisplayName(authUser);
  const initials = displayName
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || fallback;
};
