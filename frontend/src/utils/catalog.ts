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
  /\b(dlc|downloadable content|expansion(?: pack)?|add[- ]?on|bonus(?: content)?|soundtrack|artbook|season pass|character pass|battle pass|event pass|starter pack|founder'?s pack|cosmetic(?: pack)?|skin(?: pack| set)?|costume(?: pack)?|outfit(?: pack)?|upgrade pack|item pack|consumable(?: pack)?|currency pack|booster pack|mission pack|limited edition|bundle|deluxe edition upgrade|ultimate edition upgrade|edition upgrade)\b/i;

const EPISODIC_LIVE_CONTENT_MATCHER =
  /\b(episode\s*\d+|season\s*[0-9ivxlcdm]+|chapter\s*[0-9ivxlcdm]+(?:\s*[-:]\s*season\s*[0-9ivxlcdm]+)?|title update|content update|seasonal update|mid[- ]?season|live service|ranked split|split\s*\d+|rotation update|patch\s*v?\d+|hotfix|content drop)\b/i;

/**
 * Builds a single string from a game's metadata fields (name, genre, description, story)
 * by filtering out empty strings and joining the remaining fields with a space separator.
 * Useful for searching or matching against game metadata.
 * @param {CatalogMetadata} game - The game item to be processed.
 * @returns {string} - The processed string.
 */
const buildCatalogMetadataText = (game: CatalogMetadata) =>
  [game.name, game.genre, game.description, game.story].filter(Boolean).join(" ");

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
