import { describe, expect, it } from "vitest";

import {
  buildRelatedCatalogSearchQueries,
  filterBaseCatalogGames,
  filterRelatedBaseCatalogGames,
  hasValidReleaseDate,
  isAncillaryMediaCatalogGame,
  isEpisodicOrLiveContentGame,
  isNonBaseContentGame,
  isSupplementalTitleVariant,
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
    expect(isNonBaseContentGame({ name: "Persona Dancing: Endless Night Collection" })).toBe(true);
    expect(isNonBaseContentGame({ name: "Persona Dancing Deluxe Twin Plus" })).toBe(true);
    expect(isNonBaseContentGame({ name: "Space Quest" })).toBe(false);
  });

  it("builds fallback search queries for related titles", () => {
    expect(buildRelatedCatalogSearchQueries("Resident Evil 4")).toEqual([
      "resident evil",
      "resident",
    ]);
    expect(buildRelatedCatalogSearchQueries("Persona 5 Royal")).toEqual(["persona"]);
    expect(buildRelatedCatalogSearchQueries("BioShock Infinite")).toEqual([
      "bioshock infinite",
      "bioshock",
    ]);
  });

  it("detects episodic and live-update content", () => {
    expect(isEpisodicOrLiveContentGame({ name: "Action Saga Episode 2" })).toBe(true);
    expect(isEpisodicOrLiveContentGame({ name: "Action Saga" })).toBe(false);
  });

  it("detects ancillary media content", () => {
    expect(isAncillaryMediaCatalogGame({ name: "Persona 5 The Animation" })).toBe(true);
    expect(isAncillaryMediaCatalogGame({ name: "Persona Super Live P-Sound Bomb!!!! 2017" })).toBe(true);
    expect(isAncillaryMediaCatalogGame({ name: "Persona 5" })).toBe(false);
  });

  it("detects same-title supplemental variants", () => {
    expect(
      isSupplementalTitleVariant(
        "Persona 3: Dancing in Moonlight",
        "Persona 3: Dancing in Moonlight - Chie Version",
      ),
    ).toBe(true);
    expect(
      isSupplementalTitleVariant(
        "Persona 3: Dancing in Moonlight",
        "Persona 4 Arena Ultimax",
      ),
    ).toBe(false);
  });

  it("filters non-base content out of related title lists", () => {
    expect(
      filterBaseCatalogGames([
        { name: "Resident Evil 4" },
        { name: "Resident Evil 4 Deluxe Edition" },
        { name: "Resident Evil Super Bundle" },
        { name: "Persona Dancing: Endless Night Collection" },
        { name: "Persona Dancing Deluxe Twin Plus" },
      ]).map((game) => game.name),
    ).toEqual(["Resident Evil 4"]);
  });

  it("filters episodic content out of related title lists", () => {
    expect(
      filterBaseCatalogGames([
        { name: "Action Saga" },
        { name: "Action Saga Episode 2" },
        { name: "Action Saga Chapter 3" },
      ]).map((game) => game.name),
    ).toEqual(["Action Saga"]);
  });

  it("filters same-title variants out of related title lists", () => {
    expect(
      filterRelatedBaseCatalogGames("Persona 3: Dancing in Moonlight", [
        { name: "Persona 3: Dancing in Moonlight - Chie Version" },
        { name: "Persona Super Live P-Sound Bomb!!!! 2017" },
        { name: "Persona 4 Arena Ultimax" },
      ]).map((game) => game.name),
    ).toEqual(["Persona 4 Arena Ultimax"]);
  });

  it("validates release dates", () => {
    expect(hasValidReleaseDate("2024-03-10")).toBe(true);
    expect(hasValidReleaseDate("n/a")).toBe(false);
    expect(hasValidReleaseDate(undefined)).toBe(false);
  });
});
