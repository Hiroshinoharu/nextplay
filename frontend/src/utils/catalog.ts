import { collapseWhitespace } from "./text";

type CatalogMetadata = {
  name?: string;
  genre?: string;
  description?: string;
  story?: string;
};

type NormalizeCatalogImageOptions = {
  preferOriginalIgdbSize?: boolean;
};

const IGDB_IMAGE_UPLOAD_PATTERN = /images\.igdb\.com\/igdb\/image\/upload\//i;
const IGDB_SIZE_SEGMENT_PATTERN = /\/t_[^/]+\//i;

const NON_BASE_CONTENT_MATCHER =
  /\b(dlc|downloadable content|expansion(?: pack)?|add[- ]?on|bonus(?: content)?|soundtrack|artbook|season pass|character pass|battle pass|event pass|starter pack|founder'?s pack|cosmetic(?: pack)?|skin(?: pack| set)?|costume(?: pack)?|outfit(?: pack)?|upgrade pack|item pack|consumable(?: pack)?|currency pack|booster pack|mission pack|limited edition|bundle|collection|compilation|anthology|archive|all[- ]?in[- ]?one|(?:double|triple|combo|dual|twin)\s+(?:pack|bundle|set)|twin plus|deluxe edition|ultimate edition|gold edition|complete edition|definitive edition|special edition|premium edition|launch edition|day one edition|collector'?s edition|digital deluxe|deluxe edition upgrade|ultimate edition upgrade|edition upgrade)\b/i;

const EPISODIC_LIVE_CONTENT_MATCHER =
  /\b(episode\s*\d+|season\s*[0-9ivxlcdm]+|chapter\s*[0-9ivxlcdm]+(?:\s*[-:]\s*season\s*[0-9ivxlcdm]+)?|title update|content update|seasonal update|mid[- ]?season|live service|ranked split|split\s*\d+|rotation update|patch\s*v?\d+|hotfix|content drop)\b/i;

const ANCILLARY_MEDIA_MATCHER =
  /\b(the animation|animation|anime|ova|oav|concert|super live|stage play|musical|movie|film|drama cd|radio drama|character song|theme song|opening theme|ending theme|original soundtrack|ost|album|sound bomb|blu[- ]?ray|dvd)\b/i;

const ASSOCIATION_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "edition",
  "ultimate",
  "complete",
  "deluxe",
  "royal",
  "game",
]);

/**
 * Builds a single string from a game's metadata fields (name, genre, description, story)
 * by filtering out empty strings and joining the remaining fields with a space separator.
 * Useful for searching or matching against game metadata.
 * @param {CatalogMetadata} game - The game item to be processed.
 * @returns {string} - The processed string.
 */
const buildCatalogMetadataText = (game: CatalogMetadata) =>
  [game.name, game.genre, game.description, game.story].filter(Boolean).join(" ");

const buildAssociationTitleTokens = (gameName: string) =>
  gameName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !ASSOCIATION_STOP_WORDS.has(token));

/**
 * Normalize an IGDB image URL to use the original image size if requested.
 *
 * By default, the function will return the original URL if it is not an IGDB image URL.
 * If the URL is an IGDB image URL and the `preferOriginalIgdbSize` option is set to `true`,
 * the function will upgrade the image size to the original size.
 *
 * @param {string} [url] - The URL to normalize.
 * @param {NormalizeCatalogImageOptions} [options] - Options for normalizing the URL.
 * @returns {string|null} - The normalized URL or `null` if the input URL was invalid.
 */
export const normalizeCatalogImageUrl = (
  url?: string,
  options: NormalizeCatalogImageOptions = {},
) => {
  if (!url) return null;

  const absoluteUrl = url.startsWith("//") ? `https:${url}` : url;
  if (!options.preferOriginalIgdbSize || !IGDB_IMAGE_UPLOAD_PATTERN.test(absoluteUrl)) {
    return absoluteUrl;
  }

  if (IGDB_SIZE_SEGMENT_PATTERN.test(absoluteUrl)) {
    return absoluteUrl.replace(IGDB_SIZE_SEGMENT_PATTERN, "/t_original/");
  }

  return absoluteUrl.replace(/\/upload\//i, "/upload/t_original/");
};

/**
 * Checks if a given game item has metadata that suggests it is not base content.
 * This is determined by searching for specific keywords in the game's name, genre, description, and story.
 * @param {CatalogMetadata} game - The game item to be checked.
 * @returns {boolean} - True if the game's metadata matches the pattern, false otherwise.
 */
export const isNonBaseContentGame = (game: CatalogMetadata) =>
  NON_BASE_CONTENT_MATCHER.test(buildCatalogMetadataText(game));

/**
 * Checks if a given game item has metadata that suggests it is episodic or live content.
 * This is determined by searching for specific keywords in the game's name, genre, description, and story.
 * @param {CatalogMetadata} game - The game item to be checked.
 * @returns {boolean} - True if the game's metadata matches the pattern, false otherwise.
 */
export const isEpisodicOrLiveContentGame = (game: CatalogMetadata) =>
  EPISODIC_LIVE_CONTENT_MATCHER.test(buildCatalogMetadataText(game));

export const isAncillaryMediaCatalogGame = (game: CatalogMetadata) =>
  ANCILLARY_MEDIA_MATCHER.test(buildCatalogMetadataText(game));

export const filterBaseCatalogGames = <T extends CatalogMetadata>(games: T[]) =>
  games.filter(
    (game) =>
      !isNonBaseContentGame(game) &&
      !isEpisodicOrLiveContentGame(game) &&
      !isAncillaryMediaCatalogGame(game),
  );

export const isSupplementalTitleVariant = (
  referenceTitle?: string,
  candidateTitle?: string,
) => {
  const reference = collapseWhitespace(referenceTitle).toLowerCase();
  const candidate = collapseWhitespace(candidateTitle).toLowerCase();
  if (!reference || !candidate || reference === candidate) return false;
  if (!candidate.startsWith(reference)) return false;

  const suffix = candidate.slice(reference.length).trimStart();
  if (!suffix) return false;
  return /^(?:-|:|\||\(|\[|\{|["'!])/.test(suffix);
};

export const filterRelatedBaseCatalogGames = <T extends CatalogMetadata>(
  referenceTitle: string,
  games: T[],
) =>
  filterBaseCatalogGames(games).filter(
    (game) => !isSupplementalTitleVariant(referenceTitle, game.name),
  );

export const buildAssociationTokens = (gameName: string) =>
  Array.from(new Set(buildAssociationTitleTokens(gameName))).slice(0, 6);

export const buildRelatedCatalogSearchQueries = (gameName: string) => {
  const tokens = buildAssociationTokens(gameName);
  if (!tokens.length) return [] as string[];

  const queries: string[] = [];
  if (tokens.length >= 2) {
    queries.push(tokens.slice(0, 2).join(" "));
  }
  queries.push(tokens[0]);

  return Array.from(new Set(queries));
};

/**
 * Checks if a given string can be parsed into a valid Date object.
 * Returns false if the string is empty or cannot be parsed into a valid Date object.
 * Returns true otherwise.
 * @param {string} value - The string to be parsed into a Date object.
 * @returns {boolean} - True if the string can be parsed into a valid Date object, false otherwise.
 */
export const hasValidReleaseDate = (value?: string) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};
