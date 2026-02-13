export type AuthUser = {
  id?: number;
  username?: string;
  email?: string;
  steam_linked?: boolean;
  token?: string;
};

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
