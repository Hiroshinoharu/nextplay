import { afterEach, describe, expect, it, vi } from "vitest";

import { getInitialTheme, THEME_STORAGE_KEY } from "../src/utils/theme";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getInitialTheme", () => {
  it("returns the stored theme when it is valid", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (key === THEME_STORAGE_KEY ? "light" : null),
      },
      matchMedia: () => ({ matches: false }),
    });

    expect(getInitialTheme()).toBe("light");
  });

  it("falls back to the system preference when nothing is stored", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
      },
      matchMedia: (query: string) => ({
        matches: query === "(prefers-color-scheme: light)",
      }),
    });

    expect(getInitialTheme()).toBe("light");
  });

  it("defaults to dark without a window object", () => {
    expect(getInitialTheme()).toBe("dark");
  });
});
