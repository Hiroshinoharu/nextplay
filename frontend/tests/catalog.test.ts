import { describe, expect, it } from "vitest";

import {
  hasValidReleaseDate,
  isEpisodicOrLiveContentGame,
  isNonBaseContentGame,
  normalizeCatalogImageUrl,
} from "../src/utils/catalog";

describe("normalizeCatalogImageUrl", () => {
  it("normalizes protocol-relative URLs without changing size by default", () => {
    expect(
      normalizeCatalogImageUrl("//images.igdb.com/igdb/image/upload/t_cover_big/example.jpg"),
    ).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/example.jpg");
  });

  it("upgrades IGDB image URLs to t_original when requested", () => {
    expect(
      normalizeCatalogImageUrl(
        "https://images.igdb.com/igdb/image/upload/t_cover_big/example.jpg",
        { preferOriginalIgdbSize: true },
      ),
    ).toBe("https://images.igdb.com/igdb/image/upload/t_original/example.jpg");
  });
});

describe("catalog filters", () => {
  it("detects non-base content", () => {
    expect(isNonBaseContentGame({ name: "Space Quest DLC Pack" })).toBe(true);
    expect(isNonBaseContentGame({ name: "Space Quest" })).toBe(false);
  });

  it("detects episodic and live-update content", () => {
    expect(isEpisodicOrLiveContentGame({ name: "Action Saga Episode 2" })).toBe(true);
    expect(isEpisodicOrLiveContentGame({ name: "Action Saga" })).toBe(false);
  });

  it("validates release dates", () => {
    expect(hasValidReleaseDate("2024-03-10")).toBe(true);
    expect(hasValidReleaseDate("n/a")).toBe(false);
    expect(hasValidReleaseDate(undefined)).toBe(false);
  });
});
