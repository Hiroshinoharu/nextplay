import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "./components/card";
import GameCarousel from "./components/GameCarousel";
import Navbar from "./components/Navbar";
import Searchbar from "./components/Searchbar";
import SiteFooter from "./components/SiteFooter";
import Loader from "./components/Loader";
import LoadingScreen from "./components/LoadingScreen";
import logoUrl from "./assets/logo.png";
import { getUserInitials, type AuthUser } from "./utils/authUser";
import { type ThemeMode } from "./utils/theme";
import {
  collapseWhitespace,
  normalizeAlphaNumericText,
  replaceAllCharacters,
  splitOnAnyDelimiter,
  toSentenceCaseFromSlug,
  trimTrailingSlashes,
} from "./utils/text";
import {
  QUESTIONNAIRE_V1,
  buildRecommendRequestFromQuestionnaire,
  createEmptyQuestionnaireAnswers,
  getRecommendationEraPreference,
  isQuestionnaireComplete,
  normalizeStoredQuestionnaireAnswers,
  type QuestionnaireAnswers,
} from "./recommender/questionnaire";
import {
  hasValidReleaseDate,
  isEpisodicOrLiveContentGame,
  isNonBaseContentGame,
  normalizeCatalogImageUrl,
} from "./utils/catalog";
import "./discover.css";
import "./games.css";

type GameItem = {
  id: number;
  name: string;
  release_date?: string;
  genre?: string;
  cover_image?: string;
  description?: string;
  platform_names?: string[];
  nsfw?: boolean;
  is_nsfw?: boolean;
  adult?: boolean;
  age_rating?: string | number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  popularity?: number;
  media?: Array<{
    media_type?: string;
    url?: string;
  }>;
};

type SearchPageResult = {
  items: GameItem[];
  hasMore: boolean;
};

type FavoriteSearchResult = {
  items: GameItem[];
  hasMore: boolean;
};

type RandomPoolPage = {
  items: GameItem[];
  page: number;
  hasMore: boolean;
};

type DiscoverPageProps = {
  authUser: AuthUser | null;
  theme: ThemeMode;
};

type RecommendResponse = {
  user_id: number;
  recommended_games: number[];
  strategy?: string;
  request_id?: string;
  model_version?: string;
  ranking_profile?: string;
  outcome?: string;
  fallback_reason?: string | null;
  scored_recommendations?: Array<{
    game_id: number;
    rank?: number;
    score?: number;
  }>;
};

type RecommendationTrace = {
  requestId: string;
  modelVersion: string;
  rankingProfile: string;
  outcome: string;
  fallbackReason: string | null;
  strategy: string | null;
};

type RecommendationEventType =
  | "recommendation_exposure"
  | "recommendation_open"
  | "recommendation_favorite"
  | "recommendation_dismiss";

type RecommendationReasonGroup = {
  key: string;
  label: string;
  chips: string[];
  tone?: "default" | "avoid" | "favorite";
};

type QuestionnaireFacetGenre = {
  slug: string;
  label: string;
  count: number;
};

type QuestionnaireFacetPlatform = {
  id: number;
  name: string;
  count: number;
};

type QuestionnaireFacetsResponse = {
  genres?: QuestionnaireFacetGenre[];
  platforms?: QuestionnaireFacetPlatform[];
};

const BANNER_SWIPE_TRIGGER_PX = 56;
const BANNER_SWIPE_VERTICAL_TOLERANCE = 1.1;

const shouldIgnoreBannerSwipeTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, [role='button'], .games-result__list-item-main",
    ),
  );
};

const QUESTIONNAIRE_STORAGE_PREFIX = "nextplay_questionnaire_v1";
const RESULT_PAGE_SIZE = 10;
const RECOMMENDATION_TARGET_SIZE = 30;
const FAVORITE_GAMES_TARGET = 3;
const RECOMMENDATION_SCORE_MIN = 40;
const RECOMMENDATION_SCORE_MAX = 99;
const RECOMMENDATION_SCORE_SPAN = RECOMMENDATION_SCORE_MAX - RECOMMENDATION_SCORE_MIN;
const FAVORITE_SEARCH_PAGE_SIZE = 8;
const FAVORITE_SEARCH_MIN_RATING = 65;
const FAVORITE_SEARCH_MIN_VOTES = 100;
const RECOMMENDATION_INITIAL_DETAIL_COUNT = 12;
const RECOMMENDATION_DETAIL_BATCH_SIZE = 12;

const INITIAL_ROW_ITEMS = 24;
const ROW_STEP_ITEMS = 24;
const INITIAL_GENRE_ROWS = 6;
const GENRE_ROWS_STEP = 6;
const MAX_RECENT_RELEASE_BACKFILL_PAGES = 1;
const MIN_RECENT_RELEASE_WINDOW_MONTHS = 1;
const MAX_RECENT_RELEASE_WINDOW_MONTHS = 12;
const ALL_GENRE_FILTER_VALUE = "";
const ALL_PLATFORM_FILTER_VALUE = "";

const parseBoundedInt = (
  raw: string | null | undefined,
  min: number,
  max: number,
): number | null => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  if (normalized < min || normalized > max) return null;
  return normalized;
};

const RAW_BASE_URL = trimTrailingSlashes(import.meta.env.VITE_API_URL ?? "/api");
const API_ROOT =RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

const DEFAULT_RECENT_RELEASE_WINDOW_MONTHS =
  parseBoundedInt(
    import.meta.env.VITE_DISCOVER_RECENT_RELEASE_WINDOW_MONTHS,
    MIN_RECENT_RELEASE_WINDOW_MONTHS,
    MAX_RECENT_RELEASE_WINDOW_MONTHS,
  ) ?? 2;

const normalizeTitleForSearch = (value?: string) =>
  normalizeAlphaNumericText(collapseWhitespace(value));

const VARIANT_TITLE_TOKENS = new Set([
  "anthology",
  "chapter",
  "collection",
  "dancing",
  "definitive",
  "deluxe",
  "dlc",
  "episode",
  "pack",
  "reload",
  "remake",
  "remaster",
  "remastered",
  "royal",
  "season",
  "strikers",
  "tactica",
  "ultimate",
  "update",
]);

const isLikelyVariantTitle = (value?: string) =>
  normalizeTitleForSearch(value)
    .split(" ")
    .some((token) => VARIANT_TITLE_TOKENS.has(token));

const formatReleaseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const isReleasedGame = (game: GameItem, now: Date = new Date()) => {
  if (!game.release_date) return false;
  const parsed = new Date(game.release_date);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed <= now;
};

const extractReleaseYear = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getFullYear();
  }
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
};

const matchesEraPreference = (game: GameItem, preference: string) => {
  if (!preference || preference === "no_preference" || preference === "no_era_preference") {
    return true;
  }
  const releaseYear = extractReleaseYear(game.release_date);
  if (releaseYear === null) return false;

  if (["latest_2020_plus", "latest_2020_plus_only", "strict_latest_2020_plus"].includes(preference)) {
    return releaseYear >= 2020;
  }
  if (["modern_2015_plus", "modern_2015_plus_only", "strict_modern_2015_plus"].includes(preference)) {
    return releaseYear >= 2015;
  }
  if (preference === "classics_90s_00s") {
    return releaseYear <= 2009;
  }
  if (preference === "older_2000s_early_2010s") {
    return releaseYear >= 2000 && releaseYear <= 2014;
  }
  return true;
};

const getGameVoteCount = (game: GameItem) =>
  Math.max(
    game.aggregated_rating_count ?? 0,
    game.total_rating_count ?? 0,
    game.popularity ?? 0,
  );

const getGameRatingCount = (game: GameItem) =>
  Math.max(game.aggregated_rating_count ?? 0, game.total_rating_count ?? 0);

const getGameRating = (game: GameItem) =>
  Math.max(game.aggregated_rating ?? 0, game.total_rating ?? 0);

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const tokenizePreferenceText = (value?: string) => {
  if (!value) return [] as string[];
  const normalized = normalizeAlphaNumericText(value);
  return normalized
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
};
const normalizeFacetText = (value?: string) =>
  normalizeAlphaNumericText(collapseWhitespace(value));
const MARATHON_KEYWORD_PHRASES = [
  "4x",
  "adventure",
  "city builder",
  "crafting",
  "grand strategy",
  "management",
  "open world",
  "role playing",
  "rpg",
  "sandbox",
  "sim",
  "simulation",
  "strategy",
  "survival",
  "turn based",
] as const;

const containsWholePhrase = (value: string, phrase: string) =>
  ` ${value} `.includes(` ${phrase} `);

const hasMarathonGenreSignal = (value?: string) => {
  const normalized = normalizeFacetText(value);
  if (!normalized) return false;
  return MARATHON_KEYWORD_PHRASES.some((phrase) => containsWholePhrase(normalized, phrase));
};

const tokenizeFacetText = (value?: string) =>
  normalizeFacetText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const getTokenOverlapCount = (left: string[], right: string[]) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  return left.reduce((count, token) => count + (rightSet.has(token) ? 1 : 0), 0);
};

const rankThemeOptionsFromCatalog = (question: typeof QUESTIONNAIRE_V1.questions[number], facets?: QuestionnaireFacetsResponse | null) => {
  const genreFacets = Array.isArray(facets?.genres) ? facets.genres : [];
  if (!genreFacets.length) return question.options;

  const scored = question.options.map((option, index) => {
    const optionTokens = tokenizeFacetText(`${option.id} ${option.label}`);
    let facetCount = 0;
    let overlap = 0;
    for (const facet of genreFacets) {
      const facetTokens = tokenizeFacetText(`${facet.slug} ${facet.label}`);
      const candidateOverlap = getTokenOverlapCount(optionTokens, facetTokens);
      if (candidateOverlap <= 0) continue;
      if (candidateOverlap > overlap || (candidateOverlap === overlap && facet.count > facetCount)) {
        overlap = candidateOverlap;
        facetCount = facet.count;
      }
    }
    return { option, index, overlap, facetCount };
  });

  const matched = scored.filter((item) => item.overlap > 0);
  if (!matched.length) return question.options;

  return [...matched]
    .sort((left, right) =>
      right.facetCount - left.facetCount ||
      right.overlap - left.overlap ||
      left.option.label.localeCompare(right.option.label) ||
      left.index - right.index,
    )
    .map((item) => item.option);
};

const rankPlatformOptionsFromCatalog = (question: typeof QUESTIONNAIRE_V1.questions[number], facets?: QuestionnaireFacetsResponse | null) => {
  const platformFacets = Array.isArray(facets?.platforms) ? facets.platforms : [];
  if (!platformFacets.length) return question.options;

  const platformCountById = new Map(platformFacets.map((platform) => [platform.id, platform.count] as const));
  const scored = question.options.map((option, index) => {
    const mappedPlatformScore = option.mapping.liked_platforms.reduce(
      (total, platformId) => total + (platformCountById.get(platformId) ?? 0),
      0,
    );
    const fallbackTextScore = platformFacets.reduce((best, facet) => {
      const overlap = getTokenOverlapCount(
        tokenizeFacetText(`${option.id} ${option.label}`),
        tokenizeFacetText(facet.name),
      );
      if (overlap <= 0) return best;
      return Math.max(best, overlap * facet.count);
    }, 0);
    return {
      option,
      index,
      score: Math.max(mappedPlatformScore, fallbackTextScore),
    };
  });

  const matched = scored.filter((item) => item.score > 0);
  if (!matched.length) return question.options;

  return [...matched]
    .sort((left, right) =>
      right.score - left.score ||
      left.option.label.localeCompare(right.option.label) ||
      left.index - right.index,
    )
    .map((item) => item.option);
};

/**
 * Returns the preferred cover image for a given game.
 * First tries to use the primary cover image, if that's null or undefined,
 * then tries to find a suitable cover image from the game's media list.
 * Prioritizes images with the type "cover", then "screenshot", and finally "artwork"
 * @param game - The game item to retrieve the cover image for
 * @returns The preferred cover image URL, or null if no suitable image is found
 */
const getPreferredCoverImage = (game: GameItem) => {
  const primaryCover = normalizeCatalogImageUrl(game.cover_image);
  if (primaryCover) return primaryCover;
  const media = Array.isArray(game.media) ? game.media : [];
  const preferred = media.find((item) =>
    ["cover", "screenshot", "artwork"].includes(
      collapseWhitespace(item.media_type).toLowerCase(),
    ),
  );
  return normalizeCatalogImageUrl(preferred?.url);
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const stableOrderBySeed = (items: GameItem[], seed: string) =>
  [...items].sort((a, b) => {
    const left = hashString(`${seed}:${a.id}`);
    const right = hashString(`${seed}:${b.id}`);
    if (left !== right) return left - right;
    return a.id - b.id;
  });

/**
 * Computes a weighted signal from a game item, its rank, and a personalization signal.
 * The signal is a combination of the game's rank, rating, rating confidence, popularity, and personalization signal.
 * The weights used are as follows:
 * - rank: 0.42
 * - rating: 0.2
 * - rating confidence: 0.16
 * - popularity: 0.08
 * - personalization signal: 0.14
 * @param game - the game item
 * @param rank - the rank of the game
 * @param personalizationSignal - the personalization signal
 * @returns the weighted signal
 */
const recommendationRawSignalFromGame = (
  game: GameItem,
  rank: number,
  personalizationSignal: number,
) => {
  const normalizedRank = clampNumber(
    1 - (Math.max(rank, 1) - 1) / Math.max(RECOMMENDATION_TARGET_SIZE - 1, 1),
    0,
    1,
  );
  const normalizedRating = clampNumber(getGameRating(game) / 100, 0, 1);
  const normalizedRatingConfidence = clampNumber(
    Math.log10(getGameRatingCount(game) + 1) / 3.2,
    0,
    1,
  );
  const normalizedPopularity = clampNumber(
    Math.log10((game.popularity ?? 0) + 1) / 3.5,
    0,
    1,
  );

  const weightedSignal =
    (normalizedRank * 0.42) +
    (normalizedRating * 0.2) +
    (normalizedRatingConfidence * 0.16) +
    (normalizedPopularity * 0.08) +
    (clampNumber(personalizationSignal, 0, 1) * 0.14);
  return weightedSignal;
};

// This parseGenres the genre string from the API, which may be a comma-separated list, and returns the first genre for display in the carousel description.
const parseGenres = (value?: string) => {
  if (!value) return [] as string[];
  const unique = new Set<string>();
  splitOnAnyDelimiter(value, [",", "/", "|"])
    .map((part) => collapseWhitespace(part))
    .filter(Boolean)
    .forEach((part) => unique.add(part));
  return Array.from(unique);
};
const normalizeGenreFilterValue = (value?: string) =>
  collapseWhitespace(value).toLowerCase();

const parsePlatformNames = (values?: string[]) => {
  if (!Array.isArray(values)) return [] as string[];
  const unique = new Set<string>();
  values
    .map((value) => collapseWhitespace(value))
    .filter(Boolean)
    .forEach((value) => unique.add(value));
  return Array.from(unique);
};

const normalizePlatformFilterValue = (value?: string) =>
  collapseWhitespace(value).toLowerCase();

const buildGenreFilterOptions = (
  games: GameItem[],
  selectedGenre?: string,
) => {
  const byKey = new Map<string, GenreFilterOption>();
  games.forEach((game) => {
    parseGenres(game.genre).forEach((genre) => {
      const key = normalizeGenreFilterValue(genre);
      if (!key) return;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      byKey.set(key, {
        key,
        label: genre,
        count: 1,
      });
    });
  });

  const selectedKey = normalizeGenreFilterValue(selectedGenre);
  const selectedLabel = collapseWhitespace(selectedGenre);
  if (selectedKey && selectedLabel && !byKey.has(selectedKey)) {
    byKey.set(selectedKey, {
      key: selectedKey,
      label: selectedLabel,
      count: 0,
    });
  }

  return Array.from(byKey.values()).sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label),
  );
};

/**
 * Builds a list of platform filter options from a list of games and a selected platform.
 * If no games are provided, but a fallback list of platforms is provided, it will use that instead.
 * The resulting list will be sorted by count (descending) and then by label (ascending).
 * @param games - the list of games to generate the options from
 * @param selectedPlatform - the currently selected platform filter
 * @param fallbackPlatforms - the fallback list of platforms to use if no games are provided
 * @returns a list of platform filter options
 */
const buildPlatformFilterOptions = (
  games: GameItem[],
  selectedPlatform?: string,
  fallbackPlatforms?: QuestionnaireFacetPlatform[],
) => {
  const byKey = new Map<string, GenreFilterOption>();
  games.forEach((game) => {
    parsePlatformNames(game.platform_names).forEach((platform) => {
      const key = normalizePlatformFilterValue(platform);
      if (!key) return;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      byKey.set(key, {
        key,
        label: platform,
        count: 1,
      });
    });
  });

  if (!byKey.size && Array.isArray(fallbackPlatforms)) {
    fallbackPlatforms.forEach((platform) => {
      const label = collapseWhitespace(platform.name);
      const key = normalizePlatformFilterValue(label);
      if (!key) return;
      byKey.set(key, {
        key,
        label,
        count: Math.max(0, platform.count ?? 0),
      });
    });
  }

  const selectedKey = normalizePlatformFilterValue(selectedPlatform);
  const selectedLabel = collapseWhitespace(selectedPlatform);
  if (selectedKey && selectedLabel && !byKey.has(selectedKey)) {
    byKey.set(selectedKey, {
      key: selectedKey,
      label: selectedLabel,
      count: 0,
    });
  }

  return Array.from(byKey.values()).sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label),
  );
};

const matchesGenreFilter = (game: GameItem, selectedGenre?: string) => {
  const selectedKey = normalizeGenreFilterValue(selectedGenre);
  if (!selectedKey) return true;
  return parseGenres(game.genre).some(
    (genre) => normalizeGenreFilterValue(genre) === selectedKey,
  );
};

const matchesPlatformFilter = (game: GameItem, selectedPlatform?: string) => {
  const selectedKey = normalizePlatformFilterValue(selectedPlatform);
  if (!selectedKey) return true;
  return parsePlatformNames(game.platform_names).some(
    (platform) => normalizePlatformFilterValue(platform) === selectedKey,
  );
};

const formatPlatformSummary = (platformNames?: string[]) => {
  const platforms = parsePlatformNames(platformNames);
  if (!platforms.length) return null;
  const visiblePlatforms = platforms.slice(0, 3);
  const remainingCount = platforms.length - visiblePlatforms.length;
  return remainingCount > 0
    ? `${visiblePlatforms.join(", ")} +${remainingCount} more`
    : visiblePlatforms.join(", ");
};

const sentenceCase = (value: string) =>
  toSentenceCaseFromSlug(value);
const NSFW_TERMS = [
  "nsfw",
  "adult",
  "erotic",
  "hentai",
  "porn",
  "porno",
  "sexual",
  "sex",
  "lust",
  "lustful",
  "lewd",
  "fetish",
  "brothel",
  "succubus",
  "ecchi",
  "uncensored",
  "r18",
  "18+",
  "xxx",
  "cumming",
  "cum",
  "fap",
  "fapping",
  "masturbate",
  "masturbation",
  "spanking",
  "nude",
  "nudity",
  "milf",
  "onlyfans",
  "artificial academy",
  "femboy",
  "eroge",
  "oppai",
  "pussy",
  "dick",
  "cock",
  "vagina",
  "lingerie",
  "bikini",
  "swimsuit",
  "strip",
  "Glory Hole",
  "Footjob",
  "Foot Odor",
  "Bondage",
  "Squirting",
  "Gokkun",
  "Bukkake",
  "Creampie",
  "21+",
  "Gay",
  "Lesbian",
  "Bisexual",
  "Transgender",
  "Exotic",
  "Gaydorado",
  "BDSM",
  "Cow Girl",
  "Doggy Style",
  "Missionary",
  "Cow Girl",
  "Threesome",
  "Gay Sex",
  "Yandere Goth BDSM 15+",
];

const normalizeFilterText = (value: string) =>
  normalizeAlphaNumericText(value, { allowPlus: true });
const NORMALIZED_NSFW_TERMS = NSFW_TERMS.map((term) => normalizeFilterText(term))
  .filter(Boolean);

// A more comprehensive list of NSFW terms to check against game metadata for filtering out adult content from random carousels. This is still not perfect but should catch a wider range of explicit content based on common terminology.
const isNsfwGame = (game: GameItem) => {
  if (game.nsfw || game.is_nsfw || game.adult) return true;
  const ageRatingText = String(game.age_rating ?? "");
  const metadataText = [game.name, game.genre, game.description, ageRatingText]
    .filter(Boolean)
    .join(" ");
  const normalizedText = normalizeFilterText(metadataText);
  const paddedText = ` ${normalizedText} `;
  return NORMALIZED_NSFW_TERMS.some((term) =>
    paddedText.includes(` ${term} `),
  );
};

const shouldHideFromDiscover = (game: GameItem) =>
  isNsfwGame(game) ||
  isNonBaseContentGame(game) ||
  isEpisodicOrLiveContentGame(game) ||
  !hasValidReleaseDate(game.release_date);

const isEligibleFavoriteSearchGame = (game: GameItem) =>
  !shouldHideFromDiscover(game) &&
  isReleasedGame(game) &&
  getGameRating(game) >= FAVORITE_SEARCH_MIN_RATING &&
  getGameVoteCount(game) >= FAVORITE_SEARCH_MIN_VOTES;

const fetchTopUpRecommendationGames = async (
  needed: number,
  existingIds: Set<number>,
  excludedIds: Set<number>,
  authToken: string,
  eraPreference: string,
): Promise<GameItem[]> => {
  if (needed <= 0) return [];

  const headers = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : undefined;
  const topUp: GameItem[] = [];
  const pushCandidate = (game: GameItem) => {
    if (topUp.length >= needed) return;
    if (existingIds.has(game.id)) return;
    if (excludedIds.has(game.id)) return;
    if (shouldHideFromDiscover(game)) return;
    if (!matchesEraPreference(game, eraPreference)) return;
    existingIds.add(game.id);
    topUp.push(game);
  };

  const candidateUrls = [
    `${API_ROOT}/api/games/top?limit=300&min_rating_count=1&include_media=0`,
    `${API_ROOT}/api/games?limit=300&offset=0&include_media=0&exclude_non_base=1`,
  ];

  for (const url of candidateUrls) {
    if (topUp.length >= needed) break;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) continue;
      const payload = await response.json();
      if (!Array.isArray(payload)) continue;
      for (const raw of payload) {
        if (!raw || typeof raw !== "object") continue;
        const game = raw as GameItem;
        if (typeof game.id !== "number") continue;
        pushCandidate(game);
        if (topUp.length >= needed) break;
      }
    } catch {
      // Ignore top-up source errors and keep current recommendation list.
    }
  }

  return topUp;
};

const fetchRecommendationDetailsByIds = async (
  gameIds: number[],
  authToken: string,
): Promise<Array<GameItem | null>> => {
  if (!gameIds.length) return [];
  const results: Array<GameItem | null> = [];
  for (let index = 0; index < gameIds.length; index += RECOMMENDATION_DETAIL_BATCH_SIZE) {
    const batch = gameIds.slice(index, index + RECOMMENDATION_DETAIL_BATCH_SIZE);
    const fetchedBatch = await Promise.all(
      batch.map(async (gameId) => {
        const response = await fetch(`${API_ROOT}/api/games/${gameId}`, {
          ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
        });
        if (!response.ok) return null;
        const game = (await response.json()) as GameItem;
        return game && typeof game.id === "number" ? game : null;
      }),
    );
    results.push(...fetchedBatch);
  }
  return results;
};

type DiscoverCarousel = {
  title: string;
  badge: string;
  games: GameItem[];
  rowType?: "genre";
};

type GenreFilterOption = {
  key: string;
  label: string;
  count: number;
};

function DiscoverPage({ authUser, theme }: DiscoverPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlQuery = collapseWhitespace(searchParams.get("q") ?? "");
  const [searchInput, setSearchInput] = useState<string>(urlQuery);
  const [searchQuery, setSearchQuery] = useState<string>(urlQuery);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [selectedGenre, setSelectedGenre] = useState<string>(ALL_GENRE_FILTER_VALUE);
  const [selectedPlatform, setSelectedPlatform] = useState<string>(ALL_PLATFORM_FILTER_VALUE);
  const [rowSnapshots, setRowSnapshots] = useState<Record<string, number[]>>({});
  const [loadingRowTitle, setLoadingRowTitle] = useState<string | null>(null);
  const [visibleGenreRows, setVisibleGenreRows] = useState<number>(INITIAL_GENRE_ROWS);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers>(
    () => createEmptyQuestionnaireAnswers(),
  );
  const [questionnaireComplete, setQuestionnaireComplete] = useState<boolean>(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState<boolean>(false);
  const [questionnaireStep, setQuestionnaireStep] = useState<number>(0);
  const [questionnaireValidationMessage, setQuestionnaireValidationMessage] =
    useState<string | null>(null);
  const [showQuestionnaireResult, setShowQuestionnaireResult] = useState<boolean>(false);
  const [dismissedQuestionnaireBanner, setDismissedQuestionnaireBanner] = useState<boolean>(false);
  const [recommendationLoading, setRecommendationLoading] = useState<boolean>(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationStrategy, setRecommendationStrategy] = useState<string | null>(null);
  const [recommendationTrace, setRecommendationTrace] = useState<RecommendationTrace | null>(null);
  const [recommendedGames, setRecommendedGames] = useState<GameItem[]>([]);
  const [, setBackendRecommendationScores] = useState<Record<number, number>>({});
  const [backendRecommendationRanks, setBackendRecommendationRanks] = useState<Record<number, number>>({});
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState<number[]>([]);
  const [savedRecommendationIds, setSavedRecommendationIds] = useState<number[]>([]);
  const [favoriteGameIds, setFavoriteGameIds] = useState<number[]>([]);
  const [favoriteSearchInput, setFavoriteSearchInput] = useState<string>("");
  const [favoriteSearchPage, setFavoriteSearchPage] = useState<number>(1);
  const [debouncedFavoriteSearchInput, setDebouncedFavoriteSearchInput] =
    useState<string>("");
  const [resultPage, setResultPage] = useState<number>(1);
  const [featuredRecommendationIndex, setFeaturedRecommendationIndex] = useState<number>(0);
  const avatarText = useMemo(() => getUserInitials(authUser), [authUser]);
  const authToken = authUser?.token?.trim() ?? "";
  const randomPoolFetchPromiseRef = useRef<Promise<unknown> | null>(null);
  const recommendationRunIdRef = useRef<number>(0);
  const loggedRecommendationEventKeysRef = useRef<Set<string>>(new Set());
  const recentBackfillAttemptsRef = useRef<number>(0);
  const searchGridSectionRef = useRef<HTMLElement | null>(null);
  const randomLanesSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendationSectionRef = useRef<HTMLDivElement | null>(null);
  const bannerTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const normalizedSearchQuery = collapseWhitespace(searchQuery);
  const recentReleaseWindowMonths =
    parseBoundedInt(
      searchParams.get("recent_months"),
      MIN_RECENT_RELEASE_WINDOW_MONTHS,
      MAX_RECENT_RELEASE_WINDOW_MONTHS,
    ) ?? DEFAULT_RECENT_RELEASE_WINDOW_MONTHS;
  const searchPageSize = 24;
  const searchOffset = (searchPage - 1) * searchPageSize;
  const questionnaireStorageKey = useMemo(() => {
    const identity = authUser?.id ?? authUser?.email ?? authUser?.username;
    if (!identity) return null;
    return `${QUESTIONNAIRE_STORAGE_PREFIX}:${identity}`;
  }, [authUser?.email, authUser?.id, authUser?.username]);
  const questionnaireFavoritesStorageKey = useMemo(() => {
    if (!questionnaireStorageKey) return null;
    return `${questionnaireStorageKey}:favorite_games`;
  }, [questionnaireStorageKey]);
  const recommendationEventsUrl = useMemo(() => {
    if (!authUser?.id) return null;
    return `${API_ROOT}/api/users/${authUser.id}/interactions/events`;
  }, [authUser?.id]);
  const questionnaireFacetsQuery = useQuery({
    queryKey: ["discover-questionnaire-facets", authUser?.id ?? "guest"],
    enabled: Boolean(authUser?.id),
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<QuestionnaireFacetsResponse> => {
      const response = await fetch(`${API_ROOT}/api/games/questionnaire-facets`, {
        ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
      });
      if (!response.ok) {
        throw new Error(`Questionnaire facets failed: ${response.status}`);
      }
      return (await response.json()) as QuestionnaireFacetsResponse;
    },
  });
  const showQuestionnaireBanner =
    !questionnaireComplete && !dismissedQuestionnaireBanner;
  const questionnaireQuestions = useMemo(
    () =>
      QUESTIONNAIRE_V1.questions.map((question) => {
        if (question.id === "theme_preferences") {
          return {
            ...question,
            options: rankThemeOptionsFromCatalog(question, questionnaireFacetsQuery.data),
          };
        }
        if (question.id === "primary_platform") {
          return {
            ...question,
            options: rankPlatformOptionsFromCatalog(question, questionnaireFacetsQuery.data),
          };
        }
        return question;
      }),
    [questionnaireFacetsQuery.data],
  );
  const recommendationEraPreference = useMemo(
    () => getRecommendationEraPreference(questionnaireAnswers),
    [questionnaireAnswers],
  );
  const questionnaireQuestionCount = questionnaireQuestions.length;
  const questionnaireTotal = questionnaireQuestionCount + 1;
  const isFavoriteQuestionStep = questionnaireStep === questionnaireQuestionCount;
  const activeQuestion = questionnaireQuestions[questionnaireStep] ?? null;
  const activeQuestionSelected = useMemo(
    () => (activeQuestion ? questionnaireAnswers[activeQuestion.id] ?? [] : []),
    [activeQuestion, questionnaireAnswers],
  );
  const favoriteCount = favoriteGameIds.length;
  const answeredQuestionCount = useMemo(
    () =>
      questionnaireQuestions.reduce((count, question) => {
        const selected = questionnaireAnswers[question.id] ?? [];
        return selected.length > 0 ? count + 1 : count;
      }, 0),
    [questionnaireAnswers, questionnaireQuestions],
  );
  const completedFavoriteStep = favoriteCount === FAVORITE_GAMES_TARGET ? 1 : 0;
  const completedStepCount = answeredQuestionCount + completedFavoriteStep;
  const questionnaireProgressPercent = useMemo(() => {
    if (!questionnaireTotal) return 0;
    return Math.round((completedStepCount / questionnaireTotal) * 100);
  }, [completedStepCount, questionnaireTotal]);
  const remainingQuestionCount = Math.max(0, questionnaireQuestionCount - answeredQuestionCount);
  const favoritesRemainingCount = Math.max(0, FAVORITE_GAMES_TARGET - favoriteCount);
  const activeQuestionSelectionLabels = useMemo(() => {
    if (!activeQuestion) return [] as string[];
    const optionMap = new Map(activeQuestion.options.map((option) => [option.id, option.label] as const));
    return activeQuestionSelected
      .map((selection) => optionMap.get(selection) ?? sentenceCase(selection))
      .filter(Boolean);
  }, [activeQuestion, activeQuestionSelected]);
  const questionnaireSelectionSummary = useMemo(
    () =>
      questionnaireQuestions.map((question, index) => {
        const selected = questionnaireAnswers[question.id] ?? [];
        const optionMap = new Map(question.options.map((option) => [option.id, option.label] as const));
        const labels = selected
          .map((selection) => optionMap.get(selection) ?? sentenceCase(selection))
          .filter(Boolean);
        return {
          id: question.id,
          step: index + 1,
          prompt: question.prompt,
          answered: labels.length > 0,
          labels,
        };
      }),
    [questionnaireAnswers, questionnaireQuestions],
  );

  useEffect(() => {
    setDismissedQuestionnaireBanner(false);
  }, [questionnaireStorageKey]);

  useEffect(() => {
    if (!questionnaireStorageKey) {
      setQuestionnaireComplete(false);
      setQuestionnaireAnswers(createEmptyQuestionnaireAnswers());
      return;
    }

    try {
      const raw = localStorage.getItem(questionnaireStorageKey);
      if (!raw) {
        setQuestionnaireComplete(false);
        setQuestionnaireAnswers(createEmptyQuestionnaireAnswers());
        return;
      }
      const parsed = normalizeStoredQuestionnaireAnswers(JSON.parse(raw));
      if (!parsed) {
        setQuestionnaireComplete(false);
        setQuestionnaireAnswers(createEmptyQuestionnaireAnswers());
        return;
      }
      setQuestionnaireAnswers(parsed);
      setQuestionnaireComplete(isQuestionnaireComplete(parsed));
    } catch {
      setQuestionnaireComplete(false);
      setQuestionnaireAnswers(createEmptyQuestionnaireAnswers());
    }
  }, [questionnaireStorageKey]);

  useEffect(() => {
    if (!questionnaireFavoritesStorageKey) {
      setFavoriteGameIds([]);
      return;
    }
    try {
      const raw = localStorage.getItem(questionnaireFavoritesStorageKey);
      if (!raw) {
        setFavoriteGameIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setFavoriteGameIds([]);
        return;
      }
      const normalized = parsed
        .filter((item): item is number => Number.isFinite(item))
        .map((item) => Number(item))
        .filter((item) => item > 0)
        .slice(0, FAVORITE_GAMES_TARGET);
      setFavoriteGameIds(normalized);
    } catch {
      setFavoriteGameIds([]);
    }
  }, [questionnaireFavoritesStorageKey]);

  useEffect(() => {
    if (!questionnaireStorageKey) return;
    try {
      localStorage.setItem(questionnaireStorageKey, JSON.stringify(questionnaireAnswers));
    } catch {
      // Ignore storage failures and continue.
    }
  }, [questionnaireAnswers, questionnaireStorageKey]);

  useEffect(() => {
    if (!questionnaireFavoritesStorageKey) return;
    try {
      localStorage.setItem(
        questionnaireFavoritesStorageKey,
        JSON.stringify(favoriteGameIds.slice(0, FAVORITE_GAMES_TARGET)),
      );
    } catch {
      // Ignore storage failures and continue.
    }
  }, [favoriteGameIds, questionnaireFavoritesStorageKey]);

  useEffect(() => {
    setSearchInput(urlQuery);
    setSearchQuery(urlQuery);
    setSearchPage(1);
  }, [urlQuery]);

  useEffect(() => {
    recentBackfillAttemptsRef.current = 0;
  }, [recentReleaseWindowMonths, normalizedSearchQuery]);

  const openQuestionnaireFlow = useCallback(() => {
    const firstIncompleteIndex = questionnaireQuestions.findIndex((question) => {
      const selected = questionnaireAnswers[question.id] ?? [];
      return selected.length === 0;
    });
    const shouldOpenFavoritesStep =
      firstIncompleteIndex < 0 && favoriteGameIds.length !== FAVORITE_GAMES_TARGET;
    setShowQuestionnaireResult(false);
    setQuestionnaireValidationMessage(null);
    let nextQuestionnaireStep = 0;
    if (firstIncompleteIndex >= 0) {
      nextQuestionnaireStep = firstIncompleteIndex;
    } else if (shouldOpenFavoritesStep) {
      nextQuestionnaireStep = questionnaireQuestionCount;
    }
    setQuestionnaireStep(nextQuestionnaireStep);
    setQuestionnaireOpen(true);
  }, [favoriteGameIds.length, questionnaireAnswers, questionnaireQuestionCount, questionnaireQuestions]);

  const fetchDiscoverSearchPage = useCallback(
    async (page: number, signal?: AbortSignal): Promise<SearchPageResult> => {
      const offset = (page - 1) * searchPageSize;
      const query = new URLSearchParams({
        q: normalizedSearchQuery,
        mode: "contains",
        limit: String(searchPageSize),
        offset: String(offset),
        include_media: "0",
        exclude_non_base: "1",
      });
      const response = await fetch(
        `${API_ROOT}/api/games/search?${query.toString()}`,
        {
          signal,
          ...(authToken
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {}),
        },
      );
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Search failed (${response.status}): ${body}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Unexpected search response shape");
      }
      const rawItems = payload as GameItem[];
      const items = rawItems.filter(
        (game) => !shouldHideFromDiscover(game),
      );
      return {
        items,
        hasMore: rawItems.length === searchPageSize,
      };
    },
    [authToken, normalizedSearchQuery, searchPageSize],
  );

  const {
    data: searchData,
    isPending: searchLoading,
    isFetching: searchFetching,
    error,
  } = useQuery<SearchPageResult, Error>({
    queryKey: [
      "discover-search-page",
      normalizedSearchQuery,
      searchPage,
      searchPageSize,
    ] as const,
    enabled: normalizedSearchQuery.length >= 1,
    queryFn: ({ signal }) => fetchDiscoverSearchPage(searchPage, signal),
    staleTime: 60_000,
    placeholderData: (previousData, previousQuery) => {
      const previousSearchQuery =
        Array.isArray(previousQuery?.queryKey) && typeof previousQuery.queryKey[1] === "string"
          ? previousQuery.queryKey[1]
          : null;
      return previousSearchQuery === normalizedSearchQuery ? previousData : undefined;
    },
  });

  const cards = useMemo(() => searchData?.items ?? [], [searchData?.items]);
  const filteredCards = useMemo(
    () =>
      cards.filter(
        (game) =>
          matchesGenreFilter(game, selectedGenre) &&
          matchesPlatformFilter(game, selectedPlatform),
      ),
    [cards, selectedGenre, selectedPlatform],
  );
  const hasMoreSearchResults = Boolean(searchData?.hasMore);
  const isLiveSearching =
    (searchLoading || searchFetching) && normalizedSearchQuery.length > 0;
  useEffect(() => {
    if (
      normalizedSearchQuery.length < 1 ||
      !hasMoreSearchResults ||
      searchLoading ||
      searchFetching
    ) {
      return;
    }
    const nextPage = searchPage + 1;
    void queryClient.prefetchQuery({
      queryKey: [
        "discover-search-page",
        normalizedSearchQuery,
        nextPage,
        searchPageSize,
      ] as const,
      queryFn: ({ signal }) => fetchDiscoverSearchPage(nextPage, signal),
      staleTime: 60_000,
    });
  }, [
    fetchDiscoverSearchPage,
    hasMoreSearchResults,
    normalizedSearchQuery,
    queryClient,
    searchFetching,
    searchLoading,
    searchPage,
    searchPageSize,
  ]);
  const normalizedFavoriteSearchInput = collapseWhitespace(debouncedFavoriteSearchInput);
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedFavoriteSearchInput(favoriteSearchInput);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [favoriteSearchInput]);

  useEffect(() => {
    setFavoriteSearchPage(1);
  }, [normalizedFavoriteSearchInput]);

  const {
    data: favoriteSearchData,
    isFetching: favoriteSearchLoading,
  } = useQuery<FavoriteSearchResult, Error>({
    queryKey: [
      "discover-questionnaire-favorite-search",
      normalizedFavoriteSearchInput,
      favoriteSearchPage,
    ] as const,
    enabled: questionnaireOpen && normalizedFavoriteSearchInput.length >= 2,
    queryFn: async ({ signal }) => {
      const fetchSearch = async (mode: "contains" | "starts_with", limit: number) => {
        const baseOffset = Math.max(0, favoriteSearchPage - 1) * limit;
        const query = new URLSearchParams({
          q: normalizedFavoriteSearchInput,
          mode,
          limit: String(limit),
          offset: String(baseOffset),
          include_media: "0",
          exclude_non_base: "1",
        });
        const response = await fetch(
          `${API_ROOT}/api/games/search?${query.toString()}`,
          {
            signal,
            ...(authToken
              ? { headers: { Authorization: `Bearer ${authToken}` } }
              : {}),
          },
        );
        if (!response.ok) return [] as GameItem[];
        const payload = await response.json();
        return Array.isArray(payload) ? (payload as GameItem[]) : [];
      };

      const startsWithMatches = await fetchSearch("starts_with", 20);
      const containsMatches =
        startsWithMatches.length >= 8
          ? []
          : await fetchSearch("contains", 24);

      const combinedById = new Map<number, GameItem>();
      [...startsWithMatches, ...containsMatches].forEach((game) => {
        if (!game || typeof game.id !== "number") return;
        if (!combinedById.has(game.id)) {
          combinedById.set(game.id, game);
        }
      });

      const baseMatches = Array.from(combinedById.values())
        .filter((game) => !shouldHideFromDiscover(game))
        .filter((game) => !favoriteGameIds.includes(game.id));
      const strictMatches = baseMatches.filter((game) => isEligibleFavoriteSearchGame(game));
      const source = strictMatches.length > 0 ? strictMatches : baseMatches;
      const normalizedQuery = normalizeTitleForSearch(normalizedFavoriteSearchInput);
      const uniqueByTitle = new Map<string, GameItem>();
      const scored = source
        .map((game) => {
          const normalizedName = normalizeTitleForSearch(game.name);
          const isExact = normalizedName === normalizedQuery;
          const startsWith = normalizedName.startsWith(normalizedQuery);
          const contains = normalizedName.includes(normalizedQuery);
          const variantPenalty = isLikelyVariantTitle(game.name) ? 1 : 0;
          return {
            game,
            isExact,
            startsWith,
            contains,
            variantPenalty,
          };
        })
        .sort((left, right) => {
          if (right.isExact !== left.isExact) return Number(right.isExact) - Number(left.isExact);
          if (right.startsWith !== left.startsWith) {
            return Number(right.startsWith) - Number(left.startsWith);
          }
          if (right.contains !== left.contains) return Number(right.contains) - Number(left.contains);
          if (left.variantPenalty !== right.variantPenalty) {
            return left.variantPenalty - right.variantPenalty;
          }
          const ratingDiff = getGameRating(right.game) - getGameRating(left.game);
          if (ratingDiff !== 0) return ratingDiff;
          const votesDiff = getGameVoteCount(right.game) - getGameVoteCount(left.game);
          if (votesDiff !== 0) return votesDiff;
          return left.game.name.localeCompare(right.game.name);
        });

      for (const row of scored) {
        const key = normalizeTitleForSearch(row.game.name);
        if (!key) continue;
        if (!uniqueByTitle.has(key)) {
          uniqueByTitle.set(key, row.game);
        }
      }

      const items = Array.from(uniqueByTitle.values()).slice(0, FAVORITE_SEARCH_PAGE_SIZE);
      const hasMore = startsWithMatches.length >= 20 || containsMatches.length >= 24;
      return { items, hasMore };
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
  const favoriteSearchResults = favoriteSearchData?.items ?? [];
  const hasMoreFavoriteSearch = Boolean(favoriteSearchData?.hasMore);
  const {
    data: favoriteSelectedGames = [],
    isFetching: favoriteSelectedGamesLoading,
  } = useQuery<GameItem[], Error>({
    queryKey: [
      "discover-questionnaire-favorite-selected",
      favoriteGameIds.join(","),
    ] as const,
    enabled: favoriteGameIds.length > 0,
    queryFn: async () => {
      const fetched = await Promise.all(
        favoriteGameIds.map(async (gameId) => {
          const response = await fetch(`${API_ROOT}/api/games/${gameId}`, {
            ...(authToken
              ? { headers: { Authorization: `Bearer ${authToken}` } }
              : {}),
          });
          if (!response.ok) return null;
          const payload = (await response.json()) as GameItem;
          return payload && typeof payload.id === "number" ? payload : null;
        }),
      );
      const byId = new Map<number, GameItem>();
      for (const item of fetched) {
        if (!item) continue;
        byId.set(item.id, item);
      }
      return favoriteGameIds
        .map((id) => byId.get(id))
        .filter((item): item is GameItem => Boolean(item))
        .filter((item) => !shouldHideFromDiscover(item));
    },
    staleTime: 60_000,
  });
  const questionnaireSnapshotChips = useMemo(() => {
    const selectedLabels = questionnaireSelectionSummary.flatMap((entry) => entry.labels);
    const favoriteLabels = favoriteSelectedGames.map((game) => game.name).filter(Boolean);
    return [...selectedLabels, ...favoriteLabels].slice(0, 10);
  }, [favoriteSelectedGames, questionnaireSelectionSummary]);
  const recommendationReasonGroups = useMemo<RecommendationReasonGroup[]>(() => {
    const profile: string[] = [];
    const sessionFit: string[] = [];
    const avoid: string[] = [];

    for (const entry of questionnaireSelectionSummary) {
      if (!entry.labels.length) continue;
      const labels = entry.labels.slice(0, entry.id === "avoid_content" ? 3 : 2);

      if (["preferred_pace", "era_preference", "challenge_preference"].includes(entry.id)) {
        profile.push(...labels);
        continue;
      }
      if (entry.id === "avoid_content") {
        avoid.push(...labels);
        continue;
      }
      sessionFit.push(...labels);
    }

    const groups: RecommendationReasonGroup[] = [];
    if (profile.length > 0) {
      groups.push({
        key: "profile",
        label: "Profile",
        chips: profile.slice(0, 4),
      });
    }
    if (sessionFit.length > 0) {
      groups.push({
        key: "session_fit",
        label: "Session fit",
        chips: sessionFit.slice(0, 4),
      });
    }
    if (avoid.length > 0) {
      groups.push({
        key: "avoid",
        label: "Avoid",
        chips: avoid.slice(0, 3),
        tone: "avoid",
      });
    }

    const favoriteLabels = favoriteSelectedGames
      .map((game) => game.name)
      .filter(Boolean)
      .slice(0, 3);
    if (favoriteLabels.length > 0) {
      groups.push({
        key: "favorite_anchors",
        label: "Favorite anchors",
        chips: favoriteLabels,
        tone: "favorite",
      });
    }
    return groups;
  }, [favoriteSelectedGames, questionnaireSelectionSummary]);
  const recommendationPositiveReasonChips = useMemo(
    () =>
      recommendationReasonGroups
        .filter((group) => group.key !== "avoid")
        .flatMap((group) => group.chips)
        .slice(0, 4),
    [recommendationReasonGroups],
  );
  const renderRecommendationReasonGroups = useCallback(
    (keyPrefix: string, emptyText: string) => {
      if (!recommendationReasonGroups.length) {
        return (
          <span className="discover-result-summary__empty">{emptyText}</span>
        );
      }
      return recommendationReasonGroups.map((group) => (
        <div
          key={`${keyPrefix}-${group.key}`}
          className={`discover-result-summary__group discover-result-summary__group--${group.tone ?? "default"}`}
        >
          <span className="discover-result-summary__group-label">{group.label}</span>
          <div className="discover-result-summary__chips">
            {group.chips.map((chip) => (
              <span
                key={`${keyPrefix}-${group.key}-${chip}`}
                className={`discover-result-summary__chip discover-result-summary__chip--${group.tone ?? "default"}`}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      ));
    },
    [recommendationReasonGroups],
  );

  useEffect(() => {
    if (!favoriteGameIds.length || favoriteSelectedGamesLoading) return;
    const allowedIds = new Set<number>(favoriteSelectedGames.map((game) => game.id));
    if (allowedIds.size === favoriteGameIds.length) return;
    setFavoriteGameIds((prev) => prev.filter((id) => allowedIds.has(id)));
  }, [favoriteGameIds.length, favoriteSelectedGames, favoriteSelectedGamesLoading]);
  const handleSearchSubmit = useCallback(() => {
    const nextQuery = collapseWhitespace(searchInput);
    startTransition(() => {
      setSearchPage(1);
      setSearchQuery(nextQuery);
    });
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    startTransition(() => {
      setSearchQuery("");
      setSearchPage(1);
    });
    navigate("/discover");
  }, [navigate]);
  const addFavoriteGame = useCallback((game: GameItem) => {
    setFavoriteGameIds((prev) => {
      if (prev.includes(game.id)) return prev;
      if (prev.length >= FAVORITE_GAMES_TARGET) return prev;
      return [...prev, game.id];
    });
    setFavoriteSearchInput("");
    setDebouncedFavoriteSearchInput("");
    setFavoriteSearchPage(1);
    setQuestionnaireValidationMessage(null);
  }, []);
  const removeFavoriteGame = useCallback((gameId: number) => {
    setFavoriteGameIds((prev) => prev.filter((id) => id !== gameId));
  }, []);

  const scrollToSection = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const getExploreDescription = useCallback((game: GameItem) => {
    const release = formatReleaseDate(game.release_date);
    const platforms = formatPlatformSummary(game.platform_names);
    return [
      release ? `Release: ${release}` : "Release: n/a",
      game.genre ? `Genre: ${game.genre}` : null,
      platforms ? `Platforms: ${platforms}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }, []);
  const postRecommendationEvent = useCallback(
    async (
      gameId: number,
      eventType: RecommendationEventType,
      rank: number | null,
      trace: RecommendationTrace | null,
      metadata?: Record<string, unknown>,
    ) => {
      if (!recommendationEventsUrl || !trace) return false;
      try {
        const response = await fetch(recommendationEventsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            game_id: gameId,
            request_id: trace.requestId,
            event_type: eventType,
            model_version: trace.modelVersion,
            ranking_profile: trace.rankingProfile,
            strategy: trace.strategy,
            outcome: trace.outcome,
            recommendation_rank: typeof rank === "number" ? rank : null,
            metadata: metadata ?? {},
          }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [authToken, recommendationEventsUrl],
  );

  const logRecommendationExposureBatch = useCallback(
    (games: GameItem[], trace: RecommendationTrace | null, ranks: Record<number, number>) => {
      if (!trace) return;
      for (const game of games) {
        const dedupeKey = `${trace.requestId}:recommendation_exposure:${game.id}`;
        if (loggedRecommendationEventKeysRef.current.has(dedupeKey)) continue;
        loggedRecommendationEventKeysRef.current.add(dedupeKey);
        void postRecommendationEvent(
          game.id,
          "recommendation_exposure",
          ranks[game.id] ?? null,
          trace,
          { surface: "discover_results" },
        );
      }
    },
    [postRecommendationEvent],
  );

  const openGameDetail = useCallback(
    (targetId: number, options?: { fromRecommendation?: boolean; rank?: number | null }) => {
      if (options?.fromRecommendation) {
        void postRecommendationEvent(
          targetId,
          "recommendation_open",
          options.rank ?? null,
          recommendationTrace,
          { surface: "discover_results" },
        );
      }
      navigate(`/games/${targetId}`);
    },
    [navigate, postRecommendationEvent, recommendationTrace],
  );

  const runQuestionnaireRecommendation = useCallback(async () => {
    const runId = recommendationRunIdRef.current + 1;
    recommendationRunIdRef.current = runId;
    if (!authUser?.id || !questionnaireComplete) {
      setRecommendedGames([]);
      setFeaturedRecommendationIndex(0);
      setBackendRecommendationScores({});
      setBackendRecommendationRanks({});
      setRecommendationStrategy(null);
      setRecommendationTrace(null);
      setDismissedRecommendationIds([]);
      setRecommendationError(null);
      return false;
    }

    setRecommendationLoading(true);
    setRecommendationError(null);
    setFeaturedRecommendationIndex(0);
    setDismissedRecommendationIds([]);
    setSavedRecommendationIds([]);
    loggedRecommendationEventKeysRef.current = new Set();
    try {
      const payload = buildRecommendRequestFromQuestionnaire(
        authUser.id,
        questionnaireAnswers,
        favoriteGameIds,
      );
      const response = await fetch(`${API_ROOT}/api/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Failed to fetch recommendations (${response.status}): ${detail}`);
      }

      const body = (await response.json()) as RecommendResponse;
      const candidateIds = Array.isArray(body.recommended_games)
        ? body.recommended_games.filter((id): id is number => Number.isFinite(id))
        : [];
      const scoredRecommendations = Array.isArray(body.scored_recommendations)
        ? body.scored_recommendations
        : [];
      const nextBackendScores: Record<number, number> = {};
      const nextBackendRanks: Record<number, number> = {};
      for (const row of scoredRecommendations) {
        if (!row || typeof row !== "object") continue;
        const gameId = Number(row.game_id);
        const score = Number(row.score);
        const rank = Number(row.rank);
        if (!Number.isFinite(gameId) || gameId <= 0) continue;
        if (Number.isFinite(score)) {
          nextBackendScores[gameId] = score;
        }
        if (Number.isFinite(rank) && rank > 0) {
          nextBackendRanks[gameId] = rank;
        }
      }
      candidateIds.forEach((gameId, index) => {
        if (!(gameId in nextBackendRanks)) {
          nextBackendRanks[gameId] = index + 1;
        }
      });
      const nextTrace: RecommendationTrace = {
        requestId: typeof body.request_id === "string" ? body.request_id : `discover:${Date.now()}`,
        modelVersion: typeof body.model_version === "string" ? body.model_version : "unknown",
        rankingProfile: typeof body.ranking_profile === "string" ? body.ranking_profile : "balanced_v1",
        outcome: typeof body.outcome === "string" ? body.outcome : "unknown",
        fallbackReason: typeof body.fallback_reason === "string" ? body.fallback_reason : null,
        strategy: typeof body.strategy === "string" ? body.strategy : null,
      };
      setBackendRecommendationScores(nextBackendScores);
      setBackendRecommendationRanks(nextBackendRanks);
      setRecommendationStrategy(typeof body.strategy === "string" ? body.strategy : null);
      setRecommendationTrace(nextTrace);

      if (!candidateIds.length) {
        setRecommendedGames([]);
        setFeaturedRecommendationIndex(0);
        setBackendRecommendationScores({});
        return true;
      }

      const cappedIds = Array.from(new Set(candidateIds)).slice(0, RECOMMENDATION_TARGET_SIZE);
      const initialIds = cappedIds.slice(0, RECOMMENDATION_INITIAL_DETAIL_COUNT);
      const remainingIds = cappedIds.slice(RECOMMENDATION_INITIAL_DETAIL_COUNT);

      const initialFetched = await fetchRecommendationDetailsByIds(initialIds, authToken);
      if (recommendationRunIdRef.current !== runId) return false;
      const initialVisibleRecommendations = initialFetched.filter((game): game is GameItem => {
        if (!game) return false;
        return (
          !shouldHideFromDiscover(game) &&
          !favoriteGameIds.includes(game.id) &&
          matchesEraPreference(game, recommendationEraPreference)
        );
      });

      setRecommendedGames(initialVisibleRecommendations);
      setFeaturedRecommendationIndex(0);
      logRecommendationExposureBatch(initialVisibleRecommendations, nextTrace, nextBackendRanks);
      setRecommendationLoading(false);

      void (async () => {
        const remainingFetched = await fetchRecommendationDetailsByIds(remainingIds, authToken);
        if (recommendationRunIdRef.current !== runId) return;
        const fullVisibleRecommendations = [
          ...initialVisibleRecommendations,
          ...remainingFetched.filter((game): game is GameItem => {
            if (!game) return false;
            return !shouldHideFromDiscover(game) && !favoriteGameIds.includes(game.id);
          }),
        ];
        const dedupedRecommendations = fullVisibleRecommendations.filter((game, index, all) =>
          all.findIndex((candidate) => candidate.id === game.id) === index &&
          matchesEraPreference(game, recommendationEraPreference),
        );
        if (dedupedRecommendations.length < RECOMMENDATION_TARGET_SIZE) {
          const existingIds = new Set<number>(
            dedupedRecommendations.map((game) => game.id),
          );
          const topUp = await fetchTopUpRecommendationGames(
            RECOMMENDATION_TARGET_SIZE - dedupedRecommendations.length,
            existingIds,
            new Set<number>(favoriteGameIds),
            authToken,
            recommendationEraPreference,
          );
          dedupedRecommendations.push(...topUp);
        }
        if (recommendationRunIdRef.current !== runId) return;
        const finalRecommendations = dedupedRecommendations.slice(0, RECOMMENDATION_TARGET_SIZE);
        setRecommendedGames(finalRecommendations);
        setFeaturedRecommendationIndex(0);
        logRecommendationExposureBatch(finalRecommendations, nextTrace, nextBackendRanks);
      })();
      return true;
    } catch (err) {
      setRecommendedGames([]);
      setFeaturedRecommendationIndex(0);
      setBackendRecommendationScores({});
      setBackendRecommendationRanks({});
      setRecommendationTrace(null);
      setRecommendationError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setRecommendationLoading(false);
    }
  }, [
    authToken,
    authUser?.id,
    favoriteGameIds,
    logRecommendationExposureBatch,
    questionnaireAnswers,
    questionnaireComplete,
    recommendationEraPreference,
  ]);

  useEffect(() => {
    void runQuestionnaireRecommendation();
  }, [runQuestionnaireRecommendation]);

  useEffect(() => {
    const shouldOpenQuestionnaire =
      searchParams.get("open_questionnaire") === "1" ||
      searchParams.get("open_questionnaire") === "true";
    if (!shouldOpenQuestionnaire) return;
    openQuestionnaireFlow();
  }, [openQuestionnaireFlow, searchParams]);

  const updateQuestionnaireAnswer = useCallback(
    (questionId: string, optionId: string, type: "single_select" | "multi_select") => {
      setQuestionnaireValidationMessage(null);
      setQuestionnaireAnswers((prev) => {
        const existing = prev[questionId] ?? [];
        let nextSelected: string[];
        if (type === "single_select") {
          nextSelected = [optionId];
        } else {
          const selectedSet = new Set(existing);
          if (selectedSet.has(optionId)) {
            selectedSet.delete(optionId);
          } else {
            selectedSet.add(optionId);
          }
          nextSelected = Array.from(selectedSet);
        }
        const nextAnswers = {
          ...prev,
          [questionId]: nextSelected,
        };
        setQuestionnaireComplete(isQuestionnaireComplete(nextAnswers));
        return nextAnswers;
      });
    },
    [],
  );

  const handleQuestionnairePrevious = useCallback(() => {
    setQuestionnaireValidationMessage(null);
    setQuestionnaireStep((current) => Math.max(0, current - 1));
  }, []);

  const handleQuestionnaireNext = useCallback(() => {
    if (!activeQuestion) return;
    if (activeQuestionSelected.length === 0) {
      setQuestionnaireValidationMessage("Please select at least one option to continue.");
      return;
    }
    setQuestionnaireValidationMessage(null);
    setQuestionnaireStep((current) =>
      Math.min(questionnaireTotal - 1, current + 1),
    );
  }, [activeQuestion, activeQuestionSelected.length, questionnaireTotal]);

  const handleQuestionnaireSubmit = useCallback(async () => {
    if (!questionnaireComplete) {
      const firstIncompleteIndex = questionnaireQuestions.findIndex((question) => {
        const selected = questionnaireAnswers[question.id] ?? [];
        return selected.length === 0;
      });
      if (firstIncompleteIndex >= 0) {
        setQuestionnaireStep(firstIncompleteIndex);
      }
      setQuestionnaireValidationMessage("Please complete all questions before saving.");
      return;
    }
    if (favoriteGameIds.length !== FAVORITE_GAMES_TARGET) {
      setQuestionnaireValidationMessage(
        `Please pick exactly ${FAVORITE_GAMES_TARGET} favorite games.`,
      );
      return;
    }
    setQuestionnaireValidationMessage(null);
    if (questionnaireStorageKey) {
      try {
        localStorage.setItem(questionnaireStorageKey, JSON.stringify(questionnaireAnswers));
      } catch {
        // Ignore storage failures and continue.
      }
    }
    setQuestionnaireOpen(false);
    const success = await runQuestionnaireRecommendation();
    setShowQuestionnaireResult(success);
  }, [
    favoriteGameIds.length,
    questionnaireQuestions,
    questionnaireAnswers,
    questionnaireComplete,
    questionnaireStorageKey,
    runQuestionnaireRecommendation,
  ]);

  const handleQuestionnaireRetake = useCallback(() => {
    openQuestionnaireFlow();
  }, [openQuestionnaireFlow]);

  const rankedRecommendedGames = useMemo(
    () => recommendedGames.filter((game) => !dismissedRecommendationIds.includes(game.id)),
    [dismissedRecommendationIds, recommendedGames],
  );

  const safeFeaturedRecommendationIndex = useMemo(
    () =>
      rankedRecommendedGames.length
        ? Math.min(featuredRecommendationIndex, rankedRecommendedGames.length - 1)
        : 0,
    [featuredRecommendationIndex, rankedRecommendedGames.length],
  );

  const topRecommendedGame = useMemo(
    () => rankedRecommendedGames[safeFeaturedRecommendationIndex] ?? null,
    [rankedRecommendedGames, safeFeaturedRecommendationIndex],
  );

  const additionalRecommendedGames = useMemo(
    () =>
      rankedRecommendedGames.filter(
        (_, index) => index !== safeFeaturedRecommendationIndex,
      ),
    [rankedRecommendedGames, safeFeaturedRecommendationIndex],
  );

  const recommendationDisplayRankById = useMemo(() => {
    const next = new Map<number, number>();
    rankedRecommendedGames.forEach((game, index) => {
      next.set(game.id, index + 1);
    });
    return next;
  }, [rankedRecommendedGames]);

  const topRecommendationDisplayRank = topRecommendedGame
    ? recommendationDisplayRankById.get(topRecommendedGame.id) ?? 1
    : 1;

  const canSwipeFeaturedRecommendations = rankedRecommendedGames.length > 1;

  const resultTotalPages = useMemo(
    () => Math.max(1, Math.ceil(additionalRecommendedGames.length / RESULT_PAGE_SIZE)),
    [additionalRecommendedGames.length],
  );

  const currentResultPage = Math.min(resultPage, resultTotalPages);

  const pagedAdditionalRecommendations = useMemo(() => {
    const start = (currentResultPage - 1) * RESULT_PAGE_SIZE;
    return additionalRecommendedGames.slice(start, start + RESULT_PAGE_SIZE);
  }, [additionalRecommendedGames, currentResultPage]);

  const handleRecommendationBannerTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      if (!canSwipeFeaturedRecommendations) {
        bannerTouchStartRef.current = null;
        return;
      }

      if (shouldIgnoreBannerSwipeTarget(event.target)) {
        bannerTouchStartRef.current = null;
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        bannerTouchStartRef.current = null;
        return;
      }

      bannerTouchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    },
    [canSwipeFeaturedRecommendations],
  );

  const handleRecommendationBannerTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      const start = bannerTouchStartRef.current;
      bannerTouchStartRef.current = null;

      if (!start || !canSwipeFeaturedRecommendations || event.changedTouches.length !== 1) return;
      if (shouldIgnoreBannerSwipeTarget(event.target)) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX < BANNER_SWIPE_TRIGGER_PX) return;
      if (absX <= absY * BANNER_SWIPE_VERTICAL_TOLERANCE) return;

      if (deltaX < 0) {
        setFeaturedRecommendationIndex((index) =>
          Math.min(rankedRecommendedGames.length - 1, index + 1),
        );
        setResultPage(1);
        return;
      }

      setFeaturedRecommendationIndex((index) => Math.max(0, index - 1));
      setResultPage(1);
    },
    [canSwipeFeaturedRecommendations, rankedRecommendedGames.length],
  );

  const topRecommendationSummary = useMemo(() => {
    const fallback = "We couldn't load details for the top recommendation yet.";
    if (!topRecommendedGame) {
      return {
        display: fallback,
        full: fallback,
      };
    }

    const reasons: string[] = [];
    const releaseLabel = formatReleaseDate(topRecommendedGame.release_date);
    const genreLabels = parseGenres(topRecommendedGame.genre).slice(0, 2);
    const topSignals = recommendationPositiveReasonChips.slice(0, 3);

    if (genreLabels.length > 0) {
      reasons.push(`Leans into ${genreLabels.join(" and ").toLowerCase()} picks`);
    }
    if (topSignals.length > 0) {
      reasons.push(`matches your profile around ${topSignals.join(", ")}`);
    }
    if (releaseLabel) {
      reasons.push(`released ${releaseLabel}`);
    }

    const source = collapseWhitespace(topRecommendedGame.description ?? "");
    const trimmedDescription = source.length > 260 ? `${source.slice(0, 260).trimEnd()}...` : source;

    if (!reasons.length && !source) {
      return {
        display: "Strong overall fit based on your answers, favorite anchors, and current ranking profile.",
        full: "Strong overall fit based on your answers, favorite anchors, and current ranking profile.",
      };
    }
    if (!source) {
      const summary = `${reasons.join(". ")}.`;
      return {
        display: summary,
        full: summary,
      };
    }
    if (!reasons.length) {
      return {
        display: trimmedDescription,
        full: source,
      };
    }
    return {
      display: `${reasons.join(". ")}. ${trimmedDescription}`,
      full: `${reasons.join(". ")}. ${source}`,
    };
  }, [recommendationPositiveReasonChips, topRecommendedGame]);

  const answerPreferenceTokens = useMemo(() => {
    const tokenSet = new Set<string>();
    for (const selected of Object.values(questionnaireAnswers)) {
      for (const value of selected) {
        tokenizePreferenceText(replaceAllCharacters(value, "_", " ")).forEach((token) => tokenSet.add(token));
      }
    }
    return tokenSet;
  }, [questionnaireAnswers]);

  const favoritePreferenceTokens = useMemo(() => {
    const tokenSet = new Set<string>();
    for (const game of favoriteSelectedGames) {
      tokenizePreferenceText(game.name).forEach((token) => tokenSet.add(token));
      tokenizePreferenceText(game.genre).forEach((token) => tokenSet.add(token));
    }
    return tokenSet;
  }, [favoriteSelectedGames]);

  const getPersonalizationSignal = useCallback((game: GameItem) => {
    const gameTokens = new Set<string>([
      ...tokenizePreferenceText(game.name),
      ...tokenizePreferenceText(game.genre),
      ...tokenizePreferenceText(game.description),
    ]);
    if (!gameTokens.size) return 0;

    const answerOverlap = answerPreferenceTokens.size
      ? Array.from(answerPreferenceTokens).filter((token) => gameTokens.has(token)).length /
        answerPreferenceTokens.size
      : 0;
    const favoriteOverlap = favoritePreferenceTokens.size
      ? Array.from(favoritePreferenceTokens).filter((token) => gameTokens.has(token)).length /
        favoritePreferenceTokens.size
      : 0;
    return clampNumber((answerOverlap * 0.55) + (favoriteOverlap * 0.45), 0, 1);
  }, [answerPreferenceTokens, favoritePreferenceTokens]);

  const recommendationDisplayScores = useMemo(() => {
    if (!rankedRecommendedGames.length) return new Map<number, number>();
    const rows = rankedRecommendedGames.map((game, index) => ({
      id: game.id,
      rank: index + 1,
      raw: recommendationRawSignalFromGame(
        game,
        index + 1,
        getPersonalizationSignal(game),
      ),
    }));
    const minRaw = Math.min(...rows.map((row) => row.raw));
    const maxRaw = Math.max(...rows.map((row) => row.raw));
    const span = maxRaw - minRaw;

    const scores = new Map<number, number>();
    let previousScore = RECOMMENDATION_SCORE_MAX;
    for (const row of rows) {
      let rawNormalized: number;
      if (span < 1e-6) {
        rawNormalized = clampNumber(
          1 - ((row.rank - 1) / Math.max(RECOMMENDATION_TARGET_SIZE - 1, 1)),
          0,
          1,
        );
      } else {
        rawNormalized = clampNumber((row.raw - minRaw) / span, 0, 1);
      }
      const rankPercentile = clampNumber(
        1 - ((row.rank - 1) / Math.max(rows.length - 1, 1)),
        0,
        1,
      );
      // Keep the visible score anchored to the displayed order, then let the
      // content signal shape the gaps within that order.
      const blended = clampNumber((rankPercentile * 0.76) + (rawNormalized * 0.24), 0, 1);
      const eased = Math.pow(blended, 0.88);
      const displayScore = Math.round(
        RECOMMENDATION_SCORE_MIN + (eased * RECOMMENDATION_SCORE_SPAN),
      );
      const monotonicScore =
        row.rank === 1
          ? displayScore
          : clampNumber(
              Math.min(previousScore - 1, displayScore),
              RECOMMENDATION_SCORE_MIN,
              RECOMMENDATION_SCORE_MAX,
            );
      scores.set(row.id, monotonicScore);
      previousScore = monotonicScore;
    }
    return scores;
  }, [getPersonalizationSignal, rankedRecommendedGames]);

  const effectiveRecommendationScores = useMemo(() => {
    // User-facing scores should reflect the visible recommendation stack after
    // filters, dismissals, and top-ups have been applied. Backend scores stay in
    // state for analytics and traceability, but the UI percentage is derived
    // from the current visible order so it remains stable and well-spread.
    return recommendationDisplayScores;
  }, [recommendationDisplayScores]);


  const getRecommendationRank = useCallback(
    (gameId: number, fallbackRank: number) => backendRecommendationRanks[gameId] ?? fallbackRank,
    [backendRecommendationRanks],
  );

  const handleRecommendationFavorite = useCallback(
    async (gameId: number, rank: number) => {
      const success = await postRecommendationEvent(
        gameId,
        "recommendation_favorite",
        rank,
        recommendationTrace,
        { surface: "discover_results" },
      );
      if (success) {
        setSavedRecommendationIds((prev) => (prev.includes(gameId) ? prev : [...prev, gameId]));
      }
    },
    [postRecommendationEvent, recommendationTrace],
  );

  const handleRecommendationDismiss = useCallback(
    async (gameId: number, rank: number) => {
      setDismissedRecommendationIds((prev) => (prev.includes(gameId) ? prev : [...prev, gameId]));
      await postRecommendationEvent(
        gameId,
        "recommendation_dismiss",
        rank,
        recommendationTrace,
        { surface: "discover_results" },
      );
    },
    [postRecommendationEvent, recommendationTrace],
  );

  useEffect(() => {
    setResultPage(1);
  }, [rankedRecommendedGames]);

  const randomPoolPageSize = 120;
  const {
    data: randomPoolData,
    isPending: randomPoolLoading,
    isFetchingNextPage: randomPoolLoadingMore,
    hasNextPage: hasMoreRandomPool,
    fetchNextPage: fetchNextRandomPoolPage,
  } = useInfiniteQuery<RandomPoolPage, Error>({
    queryKey: ["discover-random-pool", randomPoolPageSize] as const,
    queryFn: async ({ pageParam, signal }: { pageParam: unknown; signal?: AbortSignal }) => {
      const page = pageParam as number;
      const offset = (page - 1) * randomPoolPageSize;
      const query = new URLSearchParams({
        limit: String(randomPoolPageSize),
        offset: String(offset),
        include_media: "0",
        exclude_non_base: "1",
      });
      const response = await fetch(
        `${API_ROOT}/api/games?${query.toString()}`,
        {
          signal,
          ...(authToken
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {}),
        },
      );
      if (!response.ok) {
        throw new Error(`Random feed failed (${response.status})`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Unexpected random feed response shape");
      }
      const items = payload as GameItem[];
      return {
        items,
        page,
        hasMore: items.length === randomPoolPageSize,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: RandomPoolPage): number | undefined =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const randomPool = useMemo(() => {
    const pages = randomPoolData?.pages ?? [];
    const seen = new Set<number>();
    const merged: GameItem[] = [];
    for (const page of pages) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  }, [randomPoolData?.pages]);
  const discoverBasePool = useMemo(
    () => randomPool.filter((game) => !shouldHideFromDiscover(game)),
    [randomPool],
  );
  const filterSourceGames = useMemo(
    () => (normalizedSearchQuery ? cards : discoverBasePool),
    [cards, discoverBasePool, normalizedSearchQuery],
  );
  const genreFilterOptions = useMemo(
    () =>
      buildGenreFilterOptions(
        filterSourceGames.filter((game) =>
          matchesPlatformFilter(game, selectedPlatform),
        ),
        selectedGenre,
      ),
    [filterSourceGames, selectedGenre, selectedPlatform],
  );
  const platformFilterOptions = useMemo(
    () =>
      buildPlatformFilterOptions(
        filterSourceGames.filter((game) =>
          matchesGenreFilter(game, selectedGenre),
        ),
        selectedPlatform,
        questionnaireFacetsQuery.data?.platforms,
      ),
    [
      filterSourceGames,
      questionnaireFacetsQuery.data?.platforms,
      selectedGenre,
      selectedPlatform,
    ],
  );
  const selectedGenreLabel = useMemo(
    () => collapseWhitespace(selectedGenre) || null,
    [selectedGenre],
  );
  const selectedPlatformLabel = useMemo(
    () => collapseWhitespace(selectedPlatform) || null,
    [selectedPlatform],
  );
  const activeDiscoverFilterSummary = useMemo(() => {
    const parts = [
      selectedGenreLabel ? `Genre: ${selectedGenreLabel}` : null,
      selectedPlatformLabel ? `Platform: ${selectedPlatformLabel}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }, [selectedGenreLabel, selectedPlatformLabel]);
  const hasActiveDiscoverFilters = Boolean(activeDiscoverFilterSummary);
  const clearDiscoverFilters = useCallback(() => {
    setSelectedGenre(ALL_GENRE_FILTER_VALUE);
    setSelectedPlatform(ALL_PLATFORM_FILTER_VALUE);
  }, []);
  const discoverCarousels = useMemo(() => {
    const safePool = discoverBasePool.filter(
      (game) =>
        matchesGenreFilter(game, selectedGenre) &&
        matchesPlatformFilter(game, selectedPlatform),
    );
    if (!safePool.length) return [] as DiscoverCarousel[];

    const getVoteCount = (game: GameItem) =>
      Math.max(
        game.aggregated_rating_count ?? 0,
        game.total_rating_count ?? 0,
        game.popularity ?? 0,
      );

    const getRating = (game: GameItem) =>
      Math.max(game.aggregated_rating ?? 0, game.total_rating ?? 0);

    const orderedPool = stableOrderBySeed(safePool, "discover:pool");
    // Create a "Wildcard Queue" carousel that surfaces a mix of highly-rated games with moderate visibility, 
    // sorted by a combined score of rating and vote count to balance quality and obscurity. 
    // This provides a unique discovery lane that can surface hidden gems that might be missed in a pure popularity sort,
    //  while still maintaining a level of quality control through the rating threshold.
    const wildcardPool = [...safePool]
      .filter((game) => {
        const votes = getVoteCount(game);
        const rating = getRating(game);
        return (
          isReleasedGame(game) &&
          rating >= 68 &&
          votes >= 20 &&
          votes <= 1200 &&
          (game.popularity ?? 0) <= 1500
        );
      })
      .sort((a, b) => {
        const scoreA = getRating(a) - Math.log10((getVoteCount(a) || 1) + 1) * 4;
        const scoreB = getRating(b) - Math.log10((getVoteCount(b) || 1) + 1) * 4;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return hashString(`wildcard:${a.id}`) - hashString(`wildcard:${b.id}`);
      });
    const scoreMarathon = (game: GameItem) =>
      getRating(game) * 0.8 + Math.log10((getVoteCount(game) || 1) + 1) * 10;
    const strictMarathon = [...safePool]
      .filter((game) => {
        const votes = getVoteCount(game);
        const rating = getRating(game);
        const metadata = [game.genre, game.description, game.name]
          .filter(Boolean)
          .join(" ");
        return (
          isReleasedGame(game) &&
          hasMarathonGenreSignal(metadata) &&
          rating >= 60 &&
          votes >= 25 &&
          (game.popularity ?? 0) <= 2200
        );
      })
      .sort((a, b) => {
        const scoreA = scoreMarathon(a);
        const scoreB = scoreMarathon(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return hashString(`marathon:${a.id}`) - hashString(`marathon:${b.id}`);
      });
    const strictMarathonIds = new Set<number>(strictMarathon.map((game) => game.id));
    const fallbackMarathon = [...safePool]
      .filter((game) => {
        if (strictMarathonIds.has(game.id)) return false;
        if (!isReleasedGame(game)) return false;
        const votes = getVoteCount(game);
        const rating = getRating(game);
        return rating >= 58 && votes >= 8 && (game.popularity ?? 0) <= 6000;
      })
      .sort((a, b) => {
        const scoreA = scoreMarathon(a);
        const scoreB = scoreMarathon(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return hashString(`marathon:fallback:${a.id}`) - hashString(`marathon:fallback:${b.id}`);
      });
    const marathonTarget = INITIAL_ROW_ITEMS;
    const marathonPool = [...strictMarathon];
    if (marathonPool.length < marathonTarget) {
      marathonPool.push(...fallbackMarathon.slice(0, marathonTarget - marathonPool.length));
    }
    const marathonSeedIds = new Set<number>(marathonPool.map((game) => game.id));
    const marathonSeedPool = [...marathonPool];
    if (marathonSeedPool.length < marathonTarget) {
      marathonSeedPool.push(
        ...orderedPool
          .filter((game) => !marathonSeedIds.has(game.id))
          .slice(0, marathonTarget - marathonSeedPool.length),
      );
    }

    // Identify hidden gems as games that have a solid rating (70 or above) but relatively low visibility (fewer votes and lower popularity).
    const strictHiddenGems = [...safePool]
      .filter((game) =>
        isReleasedGame(game) &&
        getRating(game) >= 70 &&
        getVoteCount(game) < 50 &&
        (game.popularity ?? 0) < 100
      )
      .sort((a, b) => {
        const votesDiff = getVoteCount(a) - getVoteCount(b);
        if (votesDiff !== 0) return votesDiff;
        const popularityDiff = (a.popularity ?? 0) - (b.popularity ?? 0);
        if (popularityDiff !== 0) return popularityDiff;
        return getRating(b) - getRating(a);
      });
    const hiddenGemTarget = INITIAL_ROW_ITEMS;
    const strictIds = new Set<number>(strictHiddenGems.map((game) => game.id));
    const fallbackHiddenGems = [...safePool]
      .filter((game) =>
        !strictIds.has(game.id) &&
        isReleasedGame(game) &&
        getRating(game) >= 65 &&
        getVoteCount(game) < 200 &&
        (game.popularity ?? 0) < 500
      )
      .sort((a, b) => {
        const ratingDiff = getRating(b) - getRating(a);
        if (ratingDiff !== 0) return ratingDiff;
        const votesDiff = getVoteCount(a) - getVoteCount(b);
        if (votesDiff !== 0) return votesDiff;
        const popularityDiff = (a.popularity ?? 0) - (b.popularity ?? 0);
        if (popularityDiff !== 0) return popularityDiff;
        return a.id - b.id;
      });
    const hiddenGems = [...strictHiddenGems];
    if (hiddenGems.length < hiddenGemTarget) {
      hiddenGems.push(...fallbackHiddenGems.slice(0, hiddenGemTarget - hiddenGems.length));
    }

    const moodDefs = [
      { title: "Random Picks", badge: "Shuffle" },
      { title: "Wildcard Queue", badge: "Lucky" },
      { title: "Tonight's Roulette", badge: "Spin" },
      { title: "Unplanned Marathon", badge: "Chaos" },
    ];
    const moodRows = moodDefs
      .map((def, index) => {
        if (def.title === "Wildcard Queue") {
          const games = wildcardPool.length ? wildcardPool : orderedPool;
          return { ...def, games };
        }
        if (def.title === "Unplanned Marathon") {
          const games = marathonSeedPool.length ? marathonSeedPool : orderedPool;
          return { ...def, games };
        }
        const offset = safePool.length > 0 ? index % safePool.length : 0;
        const games =
          offset > 0
            ? [...orderedPool.slice(offset), ...orderedPool.slice(0, offset)]
            : orderedPool;
        return { ...def, games };
      })
      .filter((section) => section.games.length > 0);

    const genreBuckets = new Map<string, GameItem[]>();
    safePool.forEach((game) => {
      parseGenres(game.genre).forEach((genre) => {
        const bucket = genreBuckets.get(genre) ?? [];
        bucket.push(game);
        genreBuckets.set(genre, bucket);
      });
    });

    const genreRows = Array.from(genreBuckets.entries())
      .filter(([, games]) => games.length >= 4)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([genre, games]) => {
        const spotlightGames = [...games].sort((a, b) => {
          const releasedA = isReleasedGame(a) ? 1 : 0;
          const releasedB = isReleasedGame(b) ? 1 : 0;
          if (releasedB !== releasedA) return releasedB - releasedA;
          const ratingDiff = getRating(b) - getRating(a);
          if (ratingDiff !== 0) return ratingDiff;
          const votesDiff = getVoteCount(b) - getVoteCount(a);
          if (votesDiff !== 0) return votesDiff;
          const popularityDiff = (b.popularity ?? 0) - (a.popularity ?? 0);
          if (popularityDiff !== 0) return popularityDiff;
          return hashString(`genre:${genre}:${a.id}`) - hashString(`genre:${genre}:${b.id}`);
        });
        return {
          title: `${genre} Spotlights`,
          badge: "Genre",
          games: spotlightGames,
          rowType: "genre" as const,
        };
      })
      .filter((section) => section.games.length > 0);
    
    const now = new Date();
    const recentWindowStart = new Date();
    recentWindowStart.setMonth(now.getMonth() - recentReleaseWindowMonths);
    
    const scoreRecentRelease = (game: GameItem) =>
      getRating(game) * 0.9 + Math.log10((getVoteCount(game) || 1) + 1) * 10;
    const recentHits = [...safePool]
      .filter((game) => {
        if (shouldHideFromDiscover(game)) return false;
        if (!isReleasedGame(game, now)) return false;
        if (!game.release_date) return false;
        const releaseDate = new Date(game.release_date);
        return releaseDate >= recentWindowStart && releaseDate <= now;
      })
      .sort((a, b) => {
        const scoreA = scoreRecentRelease(a);
        const scoreB = scoreRecentRelease(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        const votesDiff = getVoteCount(b) - getVoteCount(a);
        if (votesDiff !== 0) return votesDiff;
        const left = new Date(a.release_date!).getTime();
        const right = new Date(b.release_date!).getTime();
        return right - left;
      });
    const recentTarget = INITIAL_ROW_ITEMS;
    const seededRecentHits = recentHits.slice(0, recentTarget);

    const scoreMomentum = (game: GameItem) => {
      if (!game.release_date) return Number.NEGATIVE_INFINITY;
      const releaseDate = new Date(game.release_date);
      if (Number.isNaN(releaseDate.getTime())) return Number.NEGATIVE_INFINITY;
      const dayMs = 24 * 60 * 60 * 1000;
      const daysSinceRelease = Math.max(
        0,
        (now.getTime() - releaseDate.getTime()) / dayMs,
      );
      const recencyBoost = Math.max(0, (120 - daysSinceRelease) / 120) * 30;
      const ratingComponent = getRating(game) * 0.7;
      const engagementComponent = Math.log10((getVoteCount(game) || 1) + 1) * 12;
      const popularityComponent = Math.log10((game.popularity ?? 0) + 1) * 8;
      return (
        ratingComponent +
        engagementComponent +
        popularityComponent +
        recencyBoost
      );
    };

    const momentumPicks = [...safePool]
      .filter((game) => isReleasedGame(game, now) && Boolean(game.release_date))
      .sort((a, b) => {
        const scoreA = scoreMomentum(a);
        const scoreB = scoreMomentum(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        const left = new Date(a.release_date!).getTime();
        const right = new Date(b.release_date!).getTime();
        if (right !== left) return right - left;
        return a.id - b.id;
      });

    const hiddenGemsRow: DiscoverCarousel | null = hiddenGems.length
      ? {
          title: "Hidden Gems",
          badge: "Hidden",
          games: hiddenGems,
        }
      : null;

    const specialRows: DiscoverCarousel[] = [
      {
        title: "Recently Released",
        badge: "New",
        games: seededRecentHits,
      },
      {
        title: "Momentum Picks",
        badge: "Rising",
        games: momentumPicks,
      },
    ].filter((section) => section.games.length > 0);

    const firstMoodRow = moodRows[0];
    const remainingMoodRows = moodRows.slice(1);

    return [
      ...(firstMoodRow ? [firstMoodRow] : []),
      ...(hiddenGemsRow ? [hiddenGemsRow] : []),
      ...remainingMoodRows,
      ...genreRows,
      ...specialRows,
    ];
  }, [
    discoverBasePool,
    recentReleaseWindowMonths,
    selectedGenre,
    selectedPlatform,
  ]);

  const discoverCarouselsByTitle = useMemo(() => {
    const map = new Map<string, DiscoverCarousel>();
    discoverCarousels.forEach((section) => {
      map.set(section.title, section);
    });
    return map;
  }, [discoverCarousels]);
  const recentReleasedCount = useMemo(
    () => discoverCarouselsByTitle.get("Recently Released")?.games.length ?? 0,
    [discoverCarouselsByTitle],
  );

  useEffect(() => {
    if (normalizedSearchQuery) return;
    if (recentReleasedCount >= INITIAL_ROW_ITEMS) return;
    if (!hasMoreRandomPool || randomPoolLoadingMore) return;
    if (recentBackfillAttemptsRef.current >= MAX_RECENT_RELEASE_BACKFILL_PAGES) {
      return;
    }
    if (randomPoolFetchPromiseRef.current) return;

    recentBackfillAttemptsRef.current += 1;
    const fetchPromise = fetchNextRandomPoolPage();
    randomPoolFetchPromiseRef.current = fetchPromise;
    void fetchPromise.finally(() => {
      if (randomPoolFetchPromiseRef.current === fetchPromise) {
        randomPoolFetchPromiseRef.current = null;
      }
    });
  }, [
    fetchNextRandomPoolPage,
    hasMoreRandomPool,
    normalizedSearchQuery,
    randomPoolLoadingMore,
    recentReleasedCount,
  ]);

  const displayedDiscoverCarousels = useMemo(() => {
    return discoverCarousels
      .map((section) => {
        const sourceById = new Map<number, GameItem>();
        section.games.forEach((game) => {
          sourceById.set(game.id, game);
        });
        const defaultIds = section.games
          .slice(0, INITIAL_ROW_ITEMS)
          .map((game) => game.id);
        const snapshotIds = rowSnapshots[section.title] ?? defaultIds;
        const resolvedIds = snapshotIds.filter((id) => sourceById.has(id));
        const targetSize = Math.max(defaultIds.length, snapshotIds.length);
        if (resolvedIds.length < targetSize) {
          const existing = new Set<number>(resolvedIds);
          for (const game of section.games) {
            if (resolvedIds.length >= targetSize) break;
            if (existing.has(game.id)) continue;
            existing.add(game.id);
            resolvedIds.push(game.id);
          }
        }
        const games = resolvedIds
          .map((id) => sourceById.get(id))
          .filter((item): item is GameItem => Boolean(item));
        if (!games.length) return null;
        return {
          ...section,
          games,
        };
      })
      .filter((section): section is DiscoverCarousel => Boolean(section));
  }, [discoverCarousels, rowSnapshots]);
  const visibleDisplayedDiscoverCarousels = useMemo(() => {
    let shownGenreRows = 0;
    return displayedDiscoverCarousels.filter((section) => {
      if (section.rowType !== "genre") return true;
      shownGenreRows += 1;
      return shownGenreRows <= visibleGenreRows;
    });
  }, [displayedDiscoverCarousels, visibleGenreRows]);
  const totalDisplayedGenreRows = useMemo(
    () => displayedDiscoverCarousels.filter((section) => section.rowType === "genre").length,
    [displayedDiscoverCarousels],
  );
  const hasMoreGenreRows = totalDisplayedGenreRows > visibleGenreRows;

  const loadMoreForRow = useCallback(
    async (title: string) => {
      const section = discoverCarouselsByTitle.get(title);
      if (!section) return;

      const defaultIds = section.games
        .slice(0, INITIAL_ROW_ITEMS)
        .map((game) => game.id);
      const currentIds = rowSnapshots[title] ?? defaultIds;
      const currentSet = new Set<number>(currentIds);
      const nextIds = section.games
        .map((game) => game.id)
        .filter((id) => !currentSet.has(id))
        .slice(0, ROW_STEP_ITEMS);

      if (nextIds.length > 0) {
        setRowSnapshots((prev) => {
          const baseIds = prev[title] ?? defaultIds;
          const seen = new Set<number>(baseIds);
          const appended = nextIds.filter((id) => !seen.has(id));
          return {
            ...prev,
            [title]: [...baseIds, ...appended],
          };
        });
        return;
      }

      if (!hasMoreRandomPool || randomPoolLoadingMore) return;
      if (randomPoolFetchPromiseRef.current) return;
      setLoadingRowTitle(title);
      const fetchPromise = fetchNextRandomPoolPage();
      randomPoolFetchPromiseRef.current = fetchPromise;
      try {
        await fetchPromise;
      } finally {
        if (randomPoolFetchPromiseRef.current === fetchPromise) {
          randomPoolFetchPromiseRef.current = null;
        }
        setLoadingRowTitle((current) => (current === title ? null : current));
      }
    },
    [
      discoverCarouselsByTitle,
      fetchNextRandomPoolPage,
      hasMoreRandomPool,
      randomPoolLoadingMore,
      rowSnapshots,
    ],
  );

  const goToPreviousSearchPage = useCallback(() => {
    startTransition(() => {
      setSearchPage((current) => Math.max(1, current - 1));
    });
  }, []);

  const goToNextSearchPage = useCallback(() => {
    if (!hasMoreSearchResults || searchLoading || searchFetching) return;
    startTransition(() => {
      setSearchPage((current) => current + 1);
    });
  }, [hasMoreSearchResults, searchFetching, searchLoading]);

  let searchResultsCountMessage = `Showing ${cards.length === 0 ? 0 : searchOffset + 1}-${searchOffset + cards.length} on page ${searchPage}.`;
  if (isLiveSearching) {
    searchResultsCountMessage = "Searching...";
  } else if (hasActiveDiscoverFilters) {
    searchResultsCountMessage = `Showing ${filteredCards.length} ${filteredCards.length === 1 ? "match" : "matches"} on page ${searchPage} for ${activeDiscoverFilterSummary}.`;
  }

  const discoverFeedSummaryMessage = hasActiveDiscoverFilters
    ? `Discover feed filtered to ${activeDiscoverFilterSummary}.`
    : "Showing all games. Enter a query or use the filters to narrow the feed.";

  let discoverToolbarSummaryMessage = "Filter options will appear once games load.";
  if (hasActiveDiscoverFilters) {
    discoverToolbarSummaryMessage = `Filtering discover to ${activeDiscoverFilterSummary}.`;
  } else if (genreFilterOptions.length > 0 || platformFilterOptions.length > 0) {
    discoverToolbarSummaryMessage = "Select a genre or platform to narrow the current feed.";
  }

  const showSearchGridLoader = isLiveSearching && cards.length === 0;
  const showSearchGridResults = !showSearchGridLoader && filteredCards.length > 0;
  const showSearchGridEmpty = !showSearchGridLoader && !showSearchGridResults;
  const showRecommendationLoading = questionnaireComplete && recommendationLoading;
  const showRecommendationError =
    questionnaireComplete && !recommendationLoading && Boolean(recommendationError);
  const recommendationReadyGame =
    questionnaireComplete && !recommendationLoading && !recommendationError
      ? topRecommendedGame
      : null;
  const showFavoriteSearchResults = favoriteSearchInput.trim().length >= 2;
  const showFavoriteSearchLoading = showFavoriteSearchResults && favoriteSearchLoading;
  const showFavoriteSearchMatches =
    showFavoriteSearchResults && !favoriteSearchLoading && favoriteSearchResults.length > 0;
  const showFavoriteSearchEmpty =
    showFavoriteSearchResults && !favoriteSearchLoading && favoriteSearchResults.length === 0;

  return (
    <div className="search-page" data-theme={theme}>
      <div className="search-shell">
        <header className="search-header">
          <button
            type="button"
            className="search-brand"
            onClick={() => navigate("/")}
          >
            <img src={logoUrl} alt="NextPlay Logo" />
            <span className="search-brand__text">
              <span className="search-brand__title">NextPlay</span>
              <span className="search-brand__subtitle">Discover</span>
            </span>
          </button>
          <nav className="search-nav" aria-label="Primary">
            <Navbar />
          </nav>
          <div className="search-actions">
            <Searchbar
              value={searchInput}
              onValueChange={setSearchInput}
              onSubmit={handleSearchSubmit}
            />
            <button
              type="button"
              className="search-avatar"
              aria-label="Account menu"
              onClick={() => navigate("/user")}
            >
              {avatarText}
            </button>
          </div>
        </header>

        <main className="search-content">
          <div className="search-layout">
            <section
              className="search-results search-results--full"
              aria-live="polite"
            >
              {error && <div className="search-error">{error.message}</div>}
              <section className="games-search-results" aria-live="polite">
                {normalizedSearchQuery ? (
                  <>
                    <p className="games-search-results__label">
                      Search results for "{normalizedSearchQuery}"
                    </p>
                    <p className="games-search-results__count">
                      {searchResultsCountMessage}
                    </p>
                    {isLiveSearching ? (
                      <Loader
                        title="Searching discover"
                        subtitle="Finding the best matches for your query..."
                        theme={theme}
                      />
                    ) : null}
                  </>
                ) : (
                  <p className="games-search-results__count">
                    {discoverFeedSummaryMessage}
                  </p>
                )}
              </section>
              <div className="discover-toolbar" aria-label="Discover filters">
                <label className="discover-filter" htmlFor="discover-genre-filter">
                  <span className="discover-filter__label">Genre filter</span>
                  <select
                    id="discover-genre-filter"
                    className="discover-filter__control"
                    value={selectedGenre}
                    onChange={(event) => setSelectedGenre(event.target.value)}
                  >
                    <option value={ALL_GENRE_FILTER_VALUE}>All genres</option>
                    {genreFilterOptions.map((option) => (
                      <option key={option.key} value={option.label}>
                        {option.count > 0
                          ? `${option.label} (${option.count})`
                          : option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="discover-filter" htmlFor="discover-platform-filter">
                  <span className="discover-filter__label">Platform filter</span>
                  <select
                    id="discover-platform-filter"
                    className="discover-filter__control"
                    value={selectedPlatform}
                    onChange={(event) => setSelectedPlatform(event.target.value)}
                  >
                    <option value={ALL_PLATFORM_FILTER_VALUE}>All platforms</option>
                    {platformFilterOptions.map((option) => (
                      <option key={option.key} value={option.label}>
                        {option.count > 0
                          ? `${option.label} (${option.count})`
                          : option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="discover-toolbar__summary">
                  {discoverToolbarSummaryMessage}
                </p>
              </div>
              <div className="search-quick-actions" aria-label="Discover quick actions">
                {normalizedSearchQuery ? (
                  <>
                    <button
                      type="button"
                      className="search-quick-actions__button"
                      onClick={() => scrollToSection(searchGridSectionRef.current)}
                    >
                      Jump to results
                    </button>
                    <button
                      type="button"
                      className="search-quick-actions__button"
                      onClick={clearSearch}
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="search-quick-actions__button"
                      onClick={() => scrollToSection(randomLanesSectionRef.current)}
                    >
                      Jump to lanes
                    </button>
                    <button
                      type="button"
                      className="search-quick-actions__button"
                      onClick={() =>
                        setVisibleGenreRows((current) => current + GENRE_ROWS_STEP)
                      }
                      disabled={!hasMoreGenreRows}
                    >
                      Load genre rows
                    </button>
                    <button
                      type="button"
                      className="search-quick-actions__button"
                      onClick={openQuestionnaireFlow}
                    >
                      {questionnaireComplete ? "Retake questionnaire" : "Start questionnaire"}
                    </button>
                  </>
                )}
                {hasActiveDiscoverFilters ? (
                  <button
                    type="button"
                    className="search-quick-actions__button"
                    onClick={clearDiscoverFilters}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              {showQuestionnaireBanner ? (
                <section className="games-questionnaire-banner" aria-label="Personalization prompt">
                  <p className="games-questionnaire-banner__eyebrow">Personalized Picks</p>
                  <h2 className="games-questionnaire-banner__title">
                    Out of ideas? We&apos;ll find your next favorite.
                  </h2>
                  <p className="games-questionnaire-banner__subtitle">
                    Answer a short questionnaire to tune recommendations. You can retake anytime.
                  </p>
                  <div className="games-questionnaire-banner__actions">
                    <button
                      type="button"
                      className="games-questionnaire-banner__button games-questionnaire-banner__button--primary"
                      onClick={openQuestionnaireFlow}
                    >
                      Start questionnaire
                    </button>
                    <button
                      type="button"
                      className="games-questionnaire-banner__button games-questionnaire-banner__button--ghost"
                      onClick={() => setDismissedQuestionnaireBanner(true)}
                    >
                      Maybe later
                    </button>
                  </div>
                </section>
              ) : null}

              {normalizedSearchQuery ? (
                <section
                  ref={searchGridSectionRef}
                  className="games-search-grid-section"
                  aria-live="polite"
                >
                  {showSearchGridLoader ? (
                    <Loader
                      title="Loading results"
                      subtitle="Pulling in matching games..."
                      theme={theme}
                    />
                  ) : null}
                  {showSearchGridResults ? (
                    <div className="games-search-grid">
                      {filteredCards.map((game) => (
                        <Card
                          key={`discover-search-grid-${game.id}`}
                          title={game.name || "Untitled"}
                          description={getExploreDescription(game)}
                          icon={
                            getPreferredCoverImage(game) ? (
                              <img
                                src={getPreferredCoverImage(game) ?? ""}
                                alt={game.name || "Game cover"}
                                className="card__image"
                                loading="lazy"
                              />
                            ) : undefined
                          }
                          onClick={() => navigate(`/games/${game.id}`)}
                          ariaLabel={`View details for ${game.name || "game"}`}
                        />
                      ))}
                    </div>
                  ) : null}
                  {showSearchGridEmpty ? (
                    <p className="games-search-grid__empty">
                      {hasActiveDiscoverFilters && cards.length > 0
                        ? `No games matched the current filters (${activeDiscoverFilterSummary}) on this page. Try another filter or clear them.`
                        : "No games matched that query. Try a shorter or broader term."}
                    </p>
                  ) : null}
                  {searchPage > 1 || hasMoreSearchResults ? (
                    <div className="games-pagination">
                      <button
                        type="button"
                        className="games-pagination__button"
                        onClick={goToPreviousSearchPage}
                        disabled={searchPage <= 1}
                      >
                        Previous
                      </button>
                      <span className="games-pagination__status">
                        Page {searchPage}
                      </span>
                      <button
                        type="button"
                        className="games-pagination__button"
                        onClick={goToNextSearchPage}
                        disabled={!hasMoreSearchResults || searchLoading || searchFetching}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
              {!normalizedSearchQuery ? (
                <div ref={randomLanesSectionRef} className="discover-random">
                  {randomPoolLoading && visibleDisplayedDiscoverCarousels.length === 0 ? (
                    <LoadingScreen
                      fullScreen
                      theme={theme}
                      eyebrow="Discover feed"
                      title="Building discover lanes"
                      subtitle="Mixing random, genre, and momentum picks."
                      hints={[
                        "Assembling fresh browse lanes",
                        "Balancing genre and momentum rows",
                        "Preparing recommendation hooks",
                      ]}
                    />
                  ) : null}
                  {showRecommendationLoading ? (
                    <div
                      ref={recommendationSectionRef}
                      className="games-recommendation-state"
                    >
                      <Loader
                        title="Refreshing algorithm verdicts"
                        subtitle="Recomputing recommendations from your answers..."
                        theme={theme}
                      />
                    </div>
                  ) : null}
                  {showRecommendationError ? (
                    <div
                      ref={recommendationSectionRef}
                      className="games-recommendation-state games-recommendation-state--error"
                    >
                      {recommendationError}
                    </div>
                  ) : null}
                  {recommendationReadyGame ? (
                    <section
                      ref={recommendationSectionRef}
                      className="games-home-recommendation discover-algorithm-verdict"
                      aria-label="Algorithm verdicts result"
                      onTouchStart={handleRecommendationBannerTouchStart}
                      onTouchEnd={handleRecommendationBannerTouchEnd}
                    >
                      <div className="games-result">
                        <header className="games-result__header">
                          <p className="games-result__eyebrow">Discover Match Feed</p>
                          <h2 className="games-result__title">
                            Queued for your next session.
                          </h2>
                        </header>

                        <section className="discover-result-summary" aria-label="Recommendation summary">
                          <div className="discover-result-summary__stats">
                            <article className="discover-result-summary__stat">
                              <span className="discover-result-summary__stat-value">{recommendedGames.length}</span>
                              <span className="discover-result-summary__stat-label">Picks ready</span>
                            </article>
                            <article className="discover-result-summary__stat">
                              <span className="discover-result-summary__stat-value">{favoriteCount}/{FAVORITE_GAMES_TARGET}</span>
                              <span className="discover-result-summary__stat-label">Anchor favorites</span>
                            </article>
                            <article className="discover-result-summary__stat">
                              <span className="discover-result-summary__stat-value">{recommendationTrace?.outcome === "fallback_only_mode" ? "Fallback" : "Hybrid"}</span>
                              <span className="discover-result-summary__stat-label">Engine mode</span>
                            </article>
                          </div>
                          <div className="discover-result-summary__groups">
                            {renderRecommendationReasonGroups(
                              "recommend-reason",
                              "Answer more questions to sharpen the feed.",
                            )}
                          </div>
                        </section>

                        <section className="games-result__card">
                          <div className="games-result__poster">
                            {getPreferredCoverImage(recommendationReadyGame) ? (
                              <img
                                src={getPreferredCoverImage(recommendationReadyGame) ?? ""}
                                alt={recommendationReadyGame.name || "Top recommendation cover"}
                                loading="lazy"
                              />
                            ) : (
                              <div className="games-result__poster-fallback">No image</div>
                            )}
                          </div>

                          <div className="games-result__content">
                            <span className="games-result__list-item-rank">
                              #{topRecommendationDisplayRank}
                            </span>
                            <h3>{recommendationReadyGame.name || "Top recommendation"}</h3>
                            <p className="games-result__summary" title={topRecommendationSummary.full}>{topRecommendationSummary.display}</p>
                            <div className="games-result__meta">
                              <span>
                                {formatReleaseDate(recommendationReadyGame.release_date)
                                  ? `Release: ${formatReleaseDate(recommendationReadyGame.release_date)}`
                                  : "Release: n/a"}
                              </span>
                              <span>{`Genre: ${recommendationReadyGame.genre ?? "n/a"}`}</span>
                              <span>{`Platforms: ${formatPlatformSummary(recommendationReadyGame.platform_names) ?? "n/a"}`}</span>
                              {recommendationStrategy ? (
                                <span>{`Strategy: ${recommendationStrategy}`}</span>
                              ) : null}
                              {recommendationTrace?.rankingProfile ? (
                                <span>{`Profile: ${recommendationTrace.rankingProfile}`}</span>
                              ) : null}
                            </div>
                          </div>

                          <aside className="games-result__score">
                            <p>Rank</p>
                            <div className="games-result__score-pill">
                              #{topRecommendationDisplayRank}
                            </div>
                            <p className="games-result__score-sub">
                              {`Score: ${effectiveRecommendationScores.get(recommendationReadyGame.id) ?? 99}%`}
                            </p>
                          </aside>
                        </section>

                        {additionalRecommendedGames.length > 0 ? (
                          <section className="games-result__list" aria-label="Additional recommendations">
                            <div className="games-result__list-header">
                              <h3>Up next</h3>
                              <p>{`Showing ${pagedAdditionalRecommendations.length} of ${additionalRecommendedGames.length}`}</p>
                            </div>
                            <div className="games-result__list-grid">
                              {pagedAdditionalRecommendations.map((game, index) => {
                                const visibleRank = recommendationDisplayRankById.get(game.id) ??
                                  (2 + ((currentResultPage - 1) * RESULT_PAGE_SIZE) + index);
                                const coverUrl = getPreferredCoverImage(game);
                                const modelRank = getRecommendationRank(game.id, visibleRank);
                                const isSaved = savedRecommendationIds.includes(game.id);
                                return (
                                  <article
                                    key={`discover-result-${game.id}`}
                                    className="games-result__list-item"
                                  >
                                    <button
                                      type="button"
                                      className="games-result__list-item-main"
                                      onClick={() =>
                                        openGameDetail(game.id, {
                                          fromRecommendation: true,
                                          rank: modelRank,
                                        })
                                      }
                                    >
                                      <span className="games-result__list-item-cover" aria-hidden="true">
                                        {coverUrl ? (
                                          <img
                                            src={coverUrl}
                                            alt=""
                                            loading="lazy"
                                          />
                                        ) : (
                                          <span className="games-result__list-item-cover-fallback">No image</span>
                                        )}
                                      </span>
                                      <span className="games-result__list-item-body">
                                      <span className="games-result__list-item-rank">{`#${visibleRank}`}</span>
                                      <span className="games-result__list-item-title">{game.name || "Untitled game"}</span>
                                      <span className="games-result__list-item-meta">
                                        {formatReleaseDate(game.release_date)
                                          ? `Release: ${formatReleaseDate(game.release_date)}`
                                          : "Release: n/a"}
                                      </span>
                                      <span className="games-result__list-item-meta">
                                        {`Score: ${effectiveRecommendationScores.get(game.id) ?? 58}%`}
                                      </span>
                                      </span>
                                    </button>
                                    <div className="games-result__list-item-actions">
                                      <button
                                        type="button"
                                        className="games-result__chip"
                                        onClick={() => void handleRecommendationFavorite(game.id, modelRank)}
                                      >
                                        {isSaved ? "Saved" : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        className="games-result__chip games-result__chip--ghost"
                                        onClick={() => void handleRecommendationDismiss(game.id, modelRank)}
                                      >
                                        Hide
                                      </button>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                            {resultTotalPages > 1 ? (
                              <div className="games-pagination games-result__pagination">
                                <button
                                  type="button"
                                  className="games-pagination__button"
                                  onClick={() => setResultPage((page) => Math.max(1, page - 1))}
                                  disabled={currentResultPage <= 1}
                                >
                                  Previous
                                </button>
                                <span className="games-pagination__status">
                                  Page {currentResultPage} of {resultTotalPages}
                                </span>
                                <button
                                  type="button"
                                  className="games-pagination__button"
                                  onClick={() =>
                                    setResultPage((page) => Math.min(resultTotalPages, page + 1))
                                  }
                                  disabled={currentResultPage >= resultTotalPages}
                                >
                                  Next
                                </button>
                              </div>
                            ) : null}
                            {canSwipeFeaturedRecommendations ? (
                              <p className="discover-banner-swipe-hint">
                                Swipe left or right on this banner to browse picks.
                              </p>
                            ) : null}
                          </section>
                        ) : null}

                        <footer className="games-result__actions">
                          <button
                            type="button"
                            className="games-result__button games-result__button--primary"
                            onClick={() => {
                              void runQuestionnaireRecommendation();
                              recommendationSectionRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            }}
                          >
                            Refresh picks
                          </button>
                          <button
                            type="button"
                            className="games-result__button games-result__button--ghost"
                            onClick={handleQuestionnaireRetake}
                          >
                            Retake questionnaire
                          </button>
                          <button
                            type="button"
                            className="games-result__button games-result__button--ghost"
                            onClick={() =>
                              void handleRecommendationFavorite(
                                recommendationReadyGame.id,
                                getRecommendationRank(
                                  recommendationReadyGame.id,
                                  topRecommendationDisplayRank,
                                ),
                              )
                            }
                          >
                            {savedRecommendationIds.includes(recommendationReadyGame.id)
                              ? "Saved"
                              : `Save #${topRecommendationDisplayRank}`}
                          </button>
                          <button
                            type="button"
                            className="games-result__button games-result__button--ghost"
                            onClick={() =>
                              void handleRecommendationDismiss(
                                recommendationReadyGame.id,
                                getRecommendationRank(
                                  recommendationReadyGame.id,
                                  topRecommendationDisplayRank,
                                ),
                              )
                            }
                          >
                            {`Hide #${topRecommendationDisplayRank} pick`}
                          </button>
                          <button
                            type="button"
                            className="games-result__button games-result__button--ghost"
                            onClick={() =>
                              openGameDetail(recommendationReadyGame.id, {
                                fromRecommendation: true,
                                rank: getRecommendationRank(
                                  recommendationReadyGame.id,
                                  topRecommendationDisplayRank,
                                ),
                              })
                            }
                          >
                            {`Open #${topRecommendationDisplayRank} pick`}
                          </button>
                        </footer>
                      </div>
                    </section>
                  ) : null}                  {!randomPoolLoading && visibleDisplayedDiscoverCarousels.length === 0 ? (
                    <section className="games-search-grid-section discover-empty-state" aria-live="polite">
                      <p className="games-search-grid__empty">
                        {hasActiveDiscoverFilters
                          ? `No games are available for the current filters (${activeDiscoverFilterSummary}). Try another filter or clear them.`
                          : "No discover lanes are available right now."}
                      </p>
                    </section>
                  ) : null}

                  {visibleDisplayedDiscoverCarousels.map((section) => {
                    const sourceSection = discoverCarouselsByTitle.get(section.title);
                    const localHasMore = (sourceSection?.games.length ?? 0) > section.games.length;
                    return (
                    <GameCarousel
                      key={section.title}
                      title={section.title}
                      badge={section.badge}
                      games={section.games}
                      onSelect={openGameDetail}
                      getDescription={getExploreDescription}
                      itemWidth={190}
                      onLoadMore={() => loadMoreForRow(section.title)}
                      canLoadMore={localHasMore || Boolean(hasMoreRandomPool)}
                      isLoadingMore={
                        localHasMore
                          ? false
                          : randomPoolLoadingMore && loadingRowTitle === section.title
                      }
                      loadMoreThreshold={420}
                      navStepItems={2}
                      showLaneStatus
                      laneLoadingText="Loading more games..."
                      laneEndText="End of this lane."
                    />
                    );
                  })}
                  {hasMoreGenreRows ? (
                    <div className="games-load-more">
                      <button
                        type="button"
                        className="games-pagination__button"
                        onClick={() =>
                          setVisibleGenreRows((current) => current + GENRE_ROWS_STEP)
                        }
                      >
                        Load more Genre Spotlights
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </main>
        <SiteFooter />
      </div>

      {questionnaireOpen ? (
        <div className="games-questionnaire-backdrop" role="dialog" aria-modal="true">
          <div className="games-questionnaire">
            <p className="games-questionnaire__eyebrow">Discover setup</p>
            <h2 className="games-questionnaire__title">Tell us what you like</h2>
            <p className="games-questionnaire__subtitle">
              We use this to personalize your discover feed. You can retake anytime.
            </p>
            <div className="discover-questionnaire-status" aria-label="Questionnaire status overview">
              <article className="discover-questionnaire-status__card">
                <span className="discover-questionnaire-status__value">{questionnaireProgressPercent}%</span>
                <span className="discover-questionnaire-status__label">Profile built</span>
              </article>
              <article className="discover-questionnaire-status__card">
                <span className="discover-questionnaire-status__value">{remainingQuestionCount}</span>
                <span className="discover-questionnaire-status__label">Questions left</span>
              </article>
              <article className="discover-questionnaire-status__card">
                <span className="discover-questionnaire-status__value">{favoritesRemainingCount}</span>
                <span className="discover-questionnaire-status__label">Favorites left</span>
              </article>
            </div>
            <div className="games-questionnaire__progress" aria-live="polite">
              <p className="games-questionnaire__progress-label">
                {`Question ${Math.min(questionnaireStep + 1, questionnaireTotal)} of ${questionnaireTotal}`}
              </p>
              <p className="games-questionnaire__progress-count">
                {`${completedStepCount}/${questionnaireTotal} answered`}
              </p>
            </div>
            <div
              className="games-questionnaire__progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={questionnaireProgressPercent}
              aria-label="Questionnaire completion"
            >
              <span
                className="games-questionnaire__progress-fill"
                style={{ width: `${questionnaireProgressPercent}%` }}
              />
            </div>
            <div className="discover-questionnaire-compact" aria-label="Questionnaire summary">
              <article className="discover-questionnaire-compact__card">
                <span className="discover-questionnaire-compact__label">Current focus</span>
                <p className="discover-questionnaire-compact__value">
                  {!isFavoriteQuestionStep && activeQuestion
                    ? activeQuestion.prompt
                    : `Pick ${FAVORITE_GAMES_TARGET} all-time favorites`}
                </p>
              </article>
              <article className="discover-questionnaire-compact__card">
                <span className="discover-questionnaire-compact__label">Profile snapshot</span>
                <div className="discover-questionnaire-compact__chips">
                  {questionnaireSnapshotChips.length > 0 ? (
                    questionnaireSnapshotChips.slice(0, 6).map((chip) => (
                      <span key={`compact-${chip}`} className="discover-questionnaire-compact__chip">
                        {chip}
                      </span>
                    ))
                  ) : (
                    <span className="discover-questionnaire-compact__empty">Your answers will show up here.</span>
                  )}
                </div>
              </article>
            </div>
            <div className="games-questionnaire__body discover-questionnaire-body">
              {!isFavoriteQuestionStep && activeQuestion ? (
                <section key={activeQuestion.id} className="games-questionnaire__question discover-questionnaire-card">
                  <div className="discover-questionnaire-question__header">
                    <span className="discover-questionnaire-question__step">{`Step ${questionnaireStep + 1}`}</span>
                    <h3>{activeQuestion.prompt}</h3>
                  </div>
                  <p className="games-questionnaire__hint">
                    {activeQuestion.type === "multi_select"
                      ? "Select one or more options. Keep it broad only if you actually want broader results."
                      : "Select the closest fit for your default taste right now."}
                  </p>
                  <div className="games-questionnaire__options">
                    {activeQuestion.options.map((option) => {
                      const isActive = activeQuestionSelected.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`games-questionnaire__option${isActive ? " is-active" : ""}`}
                          onClick={() =>
                            updateQuestionnaireAnswer(
                              activeQuestion.id,
                              option.id,
                              activeQuestion.type,
                            )
                          }
                          aria-pressed={isActive}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="discover-questionnaire-selection" aria-live="polite">
                    <span className="discover-questionnaire-selection__label">Selected</span>
                    <div className="discover-questionnaire-selection__chips">
                      {activeQuestionSelectionLabels.length > 0 ? (
                        activeQuestionSelectionLabels.map((label) => (
                          <span key={`selected-${activeQuestion?.id}-${label}`} className="discover-questionnaire-selection__chip">
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="discover-questionnaire-selection__empty">Nothing selected yet.</span>
                      )}
                    </div>
                  </div>
                </section>
              ) : null}
              {isFavoriteQuestionStep ? (
                <section className="games-questionnaire__question games-questionnaire__question--favorites discover-questionnaire-card">
                  <h3>{`Top ${FAVORITE_GAMES_TARGET} games of all time`}</h3>
                  <p className="games-questionnaire__hint">
                    This step gives the feed stronger anchors. Search is limited to released, high-confidence titles. Pick exactly 3.
                  </p>
                  <input
                    type="text"
                    className="games-questionnaire__search-input"
                    placeholder="Search game title..."
                    value={favoriteSearchInput}
                    onChange={(event) => {
                      setFavoriteSearchInput(event.target.value);
                    }}
                    disabled={favoriteCount >= FAVORITE_GAMES_TARGET}
                  />
                  <p className="games-questionnaire__hint games-questionnaire__favorites-count">
                    {`Selected ${favoriteCount}/${FAVORITE_GAMES_TARGET}`}
                  </p>
                  <div className="discover-questionnaire-selection discover-questionnaire-selection--favorites" aria-live="polite">
                    <span className="discover-questionnaire-selection__label">Submission readiness</span>
                    <div className="discover-questionnaire-selection__chips">
                      <span className="discover-questionnaire-selection__chip">{favoriteCount === FAVORITE_GAMES_TARGET ? "Ready to submit" : `${favoritesRemainingCount} favorite${favoritesRemainingCount === 1 ? "" : "s"} left`}</span>
                      <span className="discover-questionnaire-selection__chip discover-questionnaire-selection__chip--muted">Released only</span>
                    </div>
                  </div>
                  {favoriteSelectedGames.length > 0 ? (
                    <div className="games-questionnaire__favorites">
                      {favoriteSelectedGames.map((game) => (
                        <button
                          key={`favorite-selected-${game.id}`}
                          type="button"
                          className="games-questionnaire__favorite-chip"
                          onClick={() => removeFavoriteGame(game.id)}
                        >
                          {`${game.name} x`}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {showFavoriteSearchResults ? (
                    <div className="games-questionnaire__favorites-search-results">
                      {showFavoriteSearchLoading ? (
                        <p className="games-questionnaire__hint">Searching...</p>
                      ) : null}
                      {showFavoriteSearchMatches ? (
                        <>
                          {favoriteSearchResults.map((game) => (
                            <button
                              key={`favorite-search-${game.id}`}
                              type="button"
                              className="games-questionnaire__favorite-result"
                              onClick={() => addFavoriteGame(game)}
                              disabled={favoriteCount >= FAVORITE_GAMES_TARGET}
                            >
                              <span className="games-questionnaire__favorite-result-cover" aria-hidden="true">
                                {getPreferredCoverImage(game) ? (
                                  <img
                                    src={getPreferredCoverImage(game) ?? ""}
                                    alt=""
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="games-questionnaire__favorite-result-cover-fallback">
                                    No image
                                  </span>
                                )}
                              </span>
                              <span className="games-questionnaire__favorite-result-name">
                                {game.name}
                              </span>
                            </button>
                          ))}
                          <div className="games-pagination games-result__pagination games-questionnaire__favorites-pagination">
                            <button
                              type="button"
                              className="games-pagination__button"
                              onClick={() =>
                                setFavoriteSearchPage((page) => Math.max(1, page - 1))
                              }
                              disabled={favoriteSearchPage <= 1 || favoriteSearchLoading}
                            >
                              Previous
                            </button>
                            <span className="games-pagination__status">
                              Page {favoriteSearchPage}
                            </span>
                            <button
                              type="button"
                              className="games-pagination__button"
                              onClick={() => setFavoriteSearchPage((page) => page + 1)}
                              disabled={!hasMoreFavoriteSearch || favoriteSearchLoading}
                            >
                              Next
                            </button>
                          </div>
                        </>
                      ) : null}
                      {showFavoriteSearchEmpty ? (
                        <p className="games-questionnaire__hint">No matches found.</p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
            {questionnaireValidationMessage ? (
              <p className="games-questionnaire__validation">{questionnaireValidationMessage}</p>
            ) : null}
            <div className="games-questionnaire__actions">
              <button
                type="button"
                className="games-questionnaire__button games-questionnaire__button--ghost"
                onClick={() => {
                  setQuestionnaireValidationMessage(null);
                  setQuestionnaireOpen(false);
                }}
              >
                Skip for now
              </button>
              <div className="games-questionnaire__step-actions">
                <button
                  type="button"
                  className="games-questionnaire__button games-questionnaire__button--ghost"
                  onClick={handleQuestionnairePrevious}
                  disabled={questionnaireStep <= 0}
                >
                  Previous
                </button>
                {!isFavoriteQuestionStep ? (
                  <button
                    type="button"
                    className="games-questionnaire__button games-questionnaire__button--primary"
                    onClick={handleQuestionnaireNext}
                    disabled={activeQuestionSelected.length === 0}
                  >
                    Next question
                  </button>
                ) : (
                  <button
                    type="button"
                    className="games-questionnaire__button games-questionnaire__button--primary"
                    onClick={() => {
                      void handleQuestionnaireSubmit();
                    }}
                    disabled={
                      recommendationLoading || favoriteCount !== FAVORITE_GAMES_TARGET
                    }
                  >
                    {recommendationLoading ? "Saving..." : "Save and get recommendations"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showQuestionnaireResult ? (
        <div className="games-result-backdrop" role="dialog" aria-modal="true">
          <div className="games-result games-result--discover-dialog">
            <header className="games-result__header">
              <p className="games-result__eyebrow">Discover Match Feed</p>
              <h2 className="games-result__title">
                Your Discover picks are ready.
              </h2>
            </header>
            <section className="discover-result-summary discover-result-summary--dialog" aria-label="Recommendation summary">
              <div className="discover-result-summary__stats">
                <article className="discover-result-summary__stat">
                  <span className="discover-result-summary__stat-value">{recommendedGames.length}</span>
                  <span className="discover-result-summary__stat-label">Picks queued</span>
                </article>
                <article className="discover-result-summary__stat">
                  <span className="discover-result-summary__stat-value">{questionnaireProgressPercent}%</span>
                  <span className="discover-result-summary__stat-label">Questionnaire complete</span>
                </article>
                <article className="discover-result-summary__stat">
                  <span className="discover-result-summary__stat-value">{recommendationTrace?.rankingProfile ?? "balanced_v1"}</span>
                  <span className="discover-result-summary__stat-label">Ranking profile</span>
                </article>
              </div>
              <div className="discover-result-summary__groups">
                {renderRecommendationReasonGroups(
                  "dialog-reason",
                  "Your saved answers will shape the next recommendation refresh.",
                )}
              </div>
            </section>
            {topRecommendedGame ? (
              <section className="games-result__card">
                <div className="games-result__poster">
                  {getPreferredCoverImage(topRecommendedGame) ? (
                    <img
                      src={getPreferredCoverImage(topRecommendedGame) ?? ""}
                      alt={topRecommendedGame.name || "Top recommendation cover"}
                      loading="lazy"
                    />
                  ) : (
                    <div className="games-result__poster-fallback">No image</div>
                  )}
                </div>
                <div className="games-result__content">
                  <span className="games-result__list-item-rank">#1</span>
                  <h3>{topRecommendedGame.name || "Top recommendation"}</h3>
                  <p className="games-result__summary" title={topRecommendationSummary.full}>{topRecommendationSummary.display}</p>
                  <div className="games-result__meta">
                    <span>
                      {formatReleaseDate(topRecommendedGame.release_date)
                        ? `Release: ${formatReleaseDate(topRecommendedGame.release_date)}`
                        : "Release: n/a"}
                    </span>
                    <span>{`Genre: ${topRecommendedGame.genre ?? "n/a"}`}</span>
                    <span>{`Platforms: ${formatPlatformSummary(topRecommendedGame.platform_names) ?? "n/a"}`}</span>
                  </div>
                </div>
                <aside className="games-result__score">
                  <p>Rank</p>
                  <div className="games-result__score-pill">#1</div>
                  <p className="games-result__score-sub">
                    {`Score: ${effectiveRecommendationScores.get(topRecommendedGame.id) ?? 99}%`}
                  </p>
                </aside>
              </section>
            ) : (
              <section className="games-result__empty">
                <p>{recommendationError ?? "No recommendation returned yet. Try again."}</p>
              </section>
            )}
            <footer className="games-result__actions">
              <button
                type="button"
                className="games-result__button games-result__button--primary"
                onClick={() => {
                  setShowQuestionnaireResult(false);
                  recommendationSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                Open Discover feed
              </button>
              <button
                type="button"
                className="games-result__button games-result__button--ghost"
                onClick={handleQuestionnaireRetake}
              >
                Retake questionnaire
              </button>
              {topRecommendedGame ? (
                <button
                  type="button"
                  className="games-result__button games-result__button--ghost"
                  onClick={() => {
                    setShowQuestionnaireResult(false);
                    openGameDetail(topRecommendedGame.id);
                  }}
                >
                  Open #1 pick
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DiscoverPage;










