import { describe, expect, it } from "vitest";

import {
  getUserDisplayName,
  getUserInitials,
  hasAuthIdentity,
  normalizeAuthUser,
} from "../src/utils/authUser";

describe("normalizeAuthUser", () => {
  it("keeps the stable auth identity fields", () => {
    expect(
      normalizeAuthUser({
        id: "42",
        username: "NextPlayer",
        email: "player@example.com",
        steam_linked: true,
      }),
    ).toEqual({
      id: 42,
      username: "NextPlayer",
      email: "player@example.com",
      steam_linked: true,
    });
  });

  it("drops token-like fields from persisted auth data", () => {
    expect(
      normalizeAuthUser({
        id: 42,
        email: "player@example.com",
        token: "jwt-token",
        access_token: "jwt-token",
      }),
    ).toEqual({
      id: 42,
      email: "player@example.com",
      steam_linked: undefined,
    });
  });

  it("rejects payloads without a usable auth identity", () => {
    expect(normalizeAuthUser({ token: "jwt-token" })).toBeNull();
    expect(hasAuthIdentity({ token: "jwt-token" })).toBe(false);
  });
});

describe("getUserDisplayName", () => {
  it("prefers username over email", () => {
    expect(
      getUserDisplayName({
        username: "NextPlayer",
        email: "player@example.com",
      }),
    ).toBe("NextPlayer");
  });

  it("falls back to email and then default label", () => {
    expect(getUserDisplayName({ email: "player@example.com" })).toBe(
      "player@example.com",
    );
    expect(getUserDisplayName(null)).toBe("User");
  });
});

describe("getUserInitials", () => {
  it("derives initials from split username parts", () => {
    expect(getUserInitials({ username: "next_play-user" })).toBe("NP");
  });

  it("uses the fallback when no usable name is available", () => {
    expect(getUserInitials({ username: "" }, "ZX")).toBe("ZX");
  });
});
