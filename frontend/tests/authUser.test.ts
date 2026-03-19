import { describe, expect, it } from "vitest";

import { getUserDisplayName, getUserInitials } from "../src/utils/authUser";

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
