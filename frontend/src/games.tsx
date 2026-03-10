import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "./components/card";
import GameCarousel from "./components/GameCarousel";
import Lightbox from "./components/Lightbox";
import Navbar from "./components/Navbar";
import Searchbar from "./components/Searchbar";
import SiteFooter from "./components/SiteFooter";
import logoUrl from "./assets/logo.png";
import { getUserInitials, type AuthUser } from "./utils/authUser";
import {
  QUESTIONNAIRE_V1,
  buildRecommendRequestFromQuestionnaire,
  createEmptyQuestionnaireAnswers,
  isQuestionnaireComplete,
  normalizeStoredQuestionnaireAnswers,
  type QuestionnaireAnswers,
} from "./recommender/questionnaire";
import "./games.css";

// Define the structure of a game item based on expected API response fields
type GameItem = {
  id: number;
  name: string;
  description?: string;
  release_date?: string;
  genre?: string;
  publishers?: string;
  cover_image?: string;
  story?: string;
  screenshots?: string[];
  trailers?: string[];
  trailer_url?: string;
  popularity?: number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  media?: GameMedia[];
  nsfw?: boolean;
  is_nsfw?: boolean;
  adult?: boolean;
  age_rating?: string | number;
};

type GameMedia = {
  media_type?: string;
  url?: string;
};

type GamesPage = {
  items: GameItem[];
  page: number;
  hasMore: boolean;
};

type SearchPageResult = {
  items: GameItem[];
  hasMore: boolean;
};

type RecommendResponse = {
  user_id: number;
  recommended_games: number[];
  strategy?: string;
};

type GamesProps = {
  authUser: AuthUser | null;
};

const QUESTIONNAIRE_STORAGE_PREFIX = "nextplay_questionnaire_v1";

// Utility function to remove duplicate games from a list based on their unique IDs
const dedupeGames = (items: GameItem[]) => {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const mergeUniqueGames = (existing: GameItem[], incoming: GameItem[]) => {
  if (!incoming.length) return existing;
  const merged = [...existing];
  const seen = new Set<number>(existing.map((item) => item.id));
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
};

// Determine the default base URL for the API from environment variables
const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);
const API_ROOT = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

// Normalize media  URLs to ensure they are absolute and use HTTPS
const normalizeMediaUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
};

// Upgrade IGDB image URLs to a specified size by replacing the size segment in the URL
const upgradeIgdbSize = (url: string | null, size: string) => {
  if (!url) return null;
  return url.replace(/\/t_[^/]+\//, `/${size}/`);
};

// Parse release date strings into Date objects, returning null for invalid or missing dates
const parseReleaseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

// Format release dates into a human-readable string format, or return null if the date is invalid
const formatReleaseDate = (value?: string) => {
  const parsed = parseReleaseDate(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

// Collapse consecutive whitespace characters in a string into a single space and trim leading/trailing whitespace, returning an empty string if the input is undefined or null
const collapseWhitespace = (value?: string) => {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
};

// Define the CSS styles for the loading spinner component using styled-components
const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
};

const isReleasedGames = (game: GameItem, now: Date = new Date()) => {
  const releaseDate = parseReleaseDate(game.release_date);
  return releaseDate ? releaseDate <= now : false;
};

const getEffectiveRatingCount = (game: GameItem) =>
  Math.max(game.aggregated_rating_count ?? 0, game.total_rating_count ?? 0);

const getEffectiveRating = (game: GameItem) =>
  Math.max(game.aggregated_rating ?? 0, game.total_rating ?? 0);

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
];

const normalizeFilterText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();
const NORMALIZED_NSFW_TERMS = NSFW_TERMS.map((term) => normalizeFilterText(term))
  .filter(Boolean);

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

const NON_BASE_CONTENT_MATCHER =
  /\b(dlc|downloadable content|expansion(?: pack)?|add[- ]?on|bonus(?: content)?|soundtrack|artbook|season pass|character pass|battle pass|starter pack|founder'?s pack|cosmetic(?: pack)?|skin(?: pack| set)?|costume(?: pack)?|outfit(?: pack)?|upgrade pack|item pack|consumable(?: pack)?|bundle|edition upgrade|currency pack|booster pack|mission pack)\b/i;

const isNonBaseContentGame = (game: GameItem) => {
  const metadataText = [game.name, game.genre, game.description, game.story]
    .filter(Boolean)
    .join(" ");
  return NON_BASE_CONTENT_MATCHER.test(metadataText);
};

type HeroMediaSource = "artwork" | "screenshot" | "cover";

type HeroMediaCandidate = {
  url: string;
  source: HeroMediaSource;
};

const HERO_MIN_WIDTH = 720;
const HERO_MIN_HEIGHT = 400;
const HERO_MIN_ASPECT = 1.3;
const HERO_MAX_ASPECT = 2.2;

const hashStringToSeed = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createPrng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const pickPseudoRandomIndex = (length: number, seedKey: string) => {
  if (length <= 1) return 0;
  const nextRandom = createPrng(hashStringToSeed(seedKey));
  return Math.floor(nextRandom() * length);
};

// Main Games component handling game list view
function Games({ authUser }: GamesProps) {
  // Router and state hooks
  const navigate = useNavigate();
  const baseUrl = API_ROOT;
  // State for managing toast messages, lightbox index, featured game details, media orientation, and hero media selection
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [featuredGameId, setFeaturedGameId] = useState<number | null>(null);
  const [featuredDetail, setFeaturedDetail] = useState<GameItem | null>(null);
  const [landscapeByUrl, setLandscapeByUrl] = useState<Record<string, boolean>>(
    {},
  );
  const [failedHeroUrls, setFailedHeroUrls] = useState<Record<string, true>>({});
  const [featuredMediaPick, setFeaturedMediaPick] = useState<number>(0);
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>(""); // Separate state for the actual search query to trigger searches on submit rather than on every keystroke
  const [searchPage, setSearchPage] = useState<number>(1);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers>(
    () => createEmptyQuestionnaireAnswers(),
  );
  const [questionnaireOpen, setQuestionnaireOpen] = useState<boolean>(false);
  const [showQuestionnaireResult, setShowQuestionnaireResult] = useState<boolean>(false);
  const [recommendationLoading, setRecommendationLoading] = useState<boolean>(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationStrategy, setRecommendationStrategy] = useState<string | null>(null);
  const [recommendedGames, setRecommendedGames] = useState<GameItem[]>([]);
  const avatarText = useMemo(() => getUserInitials(authUser), [authUser]);
  const authToken = authUser?.token?.trim() ?? "";
  const [searchParams] = useSearchParams();
  const searchGridSectionRef = useRef<HTMLElement | null>(null);
  const upcomingSectionRef = useRef<HTMLElement | null>(null);
  const topRatedSectionRef = useRef<HTMLElement | null>(null);
  const trendingSectionRef = useRef<HTMLElement | null>(null);
  const normalizedSearchQuery = collapseWhitespace(searchQuery).toLowerCase();
  const pageSize = 48; // Number of games to fetch per page for general lists
  const upcomingPageSize = 24; // Number of unreleased games per page
  const searchPageSize = 24;
  const maxGames = 0; // Maximum number of games to load in total
  const topMinRatingCount = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get(
      "top_min_rating_count",
    );
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) return 50;
    return Math.floor(parsed);
  }, []);
  const topPriorVotes = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get("top_prior_votes");
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 200;
    return Math.floor(parsed);
  }, []);
  const topPopularityWeight = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get(
      "top_popularity_weight",
    );
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }, []);
  const questionnaireStorageKey = useMemo(() => {
    const identity = authUser?.id ?? authUser?.email ?? authUser?.username;
    if (!identity) return null;
    return `${QUESTIONNAIRE_STORAGE_PREFIX}:${identity}`;
  }, [authUser?.email, authUser?.id, authUser?.username]);

  const fetchGamesPage = useCallback(
    async ({
      page,
      limit,
      upcomingOnly = false,
      searchQuery,
      signal,
    }: {
      page: number;
      limit: number;
      upcomingOnly?: boolean;
      searchQuery?: string;
      signal?: AbortSignal;
    }): Promise<GamesPage> => {
      // Ensure the base URL is properly formatted and does not have trailing slashes
      const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
      const root = trimmedBaseUrl.endsWith("/api")
        ? trimmedBaseUrl.slice(0, -4)
        : trimmedBaseUrl;
      const offset = (page - 1) * limit;
      const query = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (upcomingOnly) {
        query.set("upcoming", "true");
      }
      if (searchQuery) {
        query.set("q", searchQuery);
      }
      query.set("exclude_non_base", "1");
      console.debug(
        `Fetching games from: ${root}/api/games?include_media=1&${query.toString()}`,
      );
      const url = `${root}/api/games?include_media=1&${query.toString()}`;
      const response = await fetch(url, {
        signal,
        ...(authToken
          ? { headers: { Authorization: `Bearer ${authToken}` } }
          : {}),
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid API response: expected an array of games");
      }
      return {
        items: dedupeGames(data as GameItem[]),
        page,
        hasMore: data.length === limit,
      };
    },
    [authToken, baseUrl],
  );

  // Use the useInfiniteQuery hook to manage fetching paginated game data, with support for loading more pages and handling errors
  const {
    data: gamesData,
    error: gamesQueryError,
    isPending: gamesLoading,
    refetch: refetchGames,
  } = useInfiniteQuery<GamesPage, Error>({
    queryKey: ["games", baseUrl, pageSize, normalizedSearchQuery] as const,
    queryFn: ({ pageParam }: { pageParam: unknown }) =>
      fetchGamesPage({
        page: pageParam as number,
        limit: pageSize,
        searchQuery: normalizedSearchQuery || undefined,
      }),
    enabled: true,
    initialPageParam: 1,
    getNextPageParam: (lastPage: GamesPage): number | undefined =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 60_000,
  });

  // Fetch a single recent trending batch (no pagination), up to 300 items.
  const {
    data: recentPopularGames = [],
    error: trendingQueryError,
    isPending: trendingLoading,
    refetch: refetchTrendingGames,
  } = useQuery<GameItem[], Error>({
    queryKey: ["games-trending-recent", baseUrl] as const,
    queryFn: async ({ signal }) => {
      const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
      const root = trimmedBaseUrl.endsWith("/api")
        ? trimmedBaseUrl.slice(0, -4)
        : trimmedBaseUrl;
      const currentYear = new Date().getFullYear();
      const fetchPopularByYear = async (year: number) => {
        const query = new URLSearchParams({
          year: String(year),
          limit: String(300),
          min_rating_count: "1",
          include_media: "1",
        });
        const response = await fetch(`${root}/api/games/popular?${query.toString()}`, {
          signal,
          ...(authToken
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {}),
        });
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error("Invalid API response: expected an array of games");
        }
        return data as GameItem[];
      };

      const currentYearGames = await fetchPopularByYear(currentYear);
      if (currentYearGames.length > 0) {
        return dedupeGames(currentYearGames).slice(0, 300);
      }
      const previousYearGames = await fetchPopularByYear(currentYear - 1);
      return dedupeGames(previousYearGames).slice(0, 300);
    },
    staleTime: 5 * 60_000,
  });

  // Use the useInfiniteQuery hook to manage fetching paginated upcoming game data, with support for loading more pages and handling errors, ensuring that users can easily discover new and unreleased games while also providing a seamless experience for loading additional content as needed
  const {
    data: upcomingData,
    error: upcomingQueryError,
    isPending: upcomingLoading,
    isFetchingNextPage: upcomingLoadingMore,
    hasNextPage: hasMoreUpcomingGames,
    fetchNextPage: fetchNextUpcomingPage,
    refetch: refetchUpcomingGames,
  } = useInfiniteQuery<GamesPage, Error>({
    queryKey: ["games-upcoming", baseUrl, upcomingPageSize] as const,
    queryFn: ({ pageParam, signal }: { pageParam: unknown; signal?: AbortSignal }) =>
      fetchGamesPage({
        page: pageParam as number,
        limit: upcomingPageSize,
        upcomingOnly: true,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: GamesPage): number | undefined =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60_000,
  });

  // Use the useQuery hook to fetch a single batch of top-rated games of all time, with support for handling errors and managing loading state, providing users with access to highly rated games based on specified criteria for minimum rating count and prior votes to ensure that the displayed games have a significant level of user engagement and feedback
  const {
    data: topAllTimeGames = [],
    error: topGamesQueryError,
    isPending: topGamesLoading,
    refetch: refetchTopGames,
  } = useQuery<GameItem[], Error>({
    queryKey: [
      "games-top-all-time",
      baseUrl,
      topMinRatingCount,
      topPriorVotes,
      topPopularityWeight,
    ] as const,
    queryFn: async ({ signal }) => {
      const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
      const root = trimmedBaseUrl.endsWith("/api")
        ? trimmedBaseUrl.slice(0, -4)
        : trimmedBaseUrl;
      const query = new URLSearchParams({
        limit: "120",
        min_rating_count: String(topMinRatingCount),
        prior_votes: String(topPriorVotes),
        popularity_weight: String(topPopularityWeight),
        include_media: "0",
      });
      const response = await fetch(`${root}/api/games/top?${query.toString()}`, {
        signal,
        ...(authToken
          ? { headers: { Authorization: `Bearer ${authToken}` } }
          : {}),
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid API response: expected an array of games");
      }
      return dedupeGames(data as GameItem[]);
    },
    staleTime: 5 * 60_000,
  });

  const searchOffset = (searchPage - 1) * searchPageSize;

  const {
    data: serverSearchResults,
    error: searchQueryError,
    isPending: searchLoading,
    isFetching: searchFetching,
  } = useQuery<SearchPageResult, Error>({
    queryKey: [
      "games-search-page",
      baseUrl,
      normalizedSearchQuery,
      searchPage,
      searchPageSize,
    ] as const,
    enabled: normalizedSearchQuery.length > 0,
    queryFn: async ({ signal }) => {
      const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
      const root = trimmedBaseUrl.endsWith("/api")
        ? trimmedBaseUrl.slice(0, -4)
        : trimmedBaseUrl;
      const params = new URLSearchParams({
        q: normalizedSearchQuery,
        mode: "contains",
        limit: String(searchPageSize),
        offset: String(searchOffset),
        include_media: "1",
        exclude_non_base: "1",
      });
      const response = await fetch(`${root}/api/games/search?${params.toString()}`, {
        signal,
        ...(authToken
          ? { headers: { Authorization: `Bearer ${authToken}` } }
          : {}),
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Invalid API response: expected an array of games");
      }
      const items = dedupeGames(payload as GameItem[]);
      return {
        items,
        hasMore: items.length === searchPageSize,
      };
    },
    staleTime: 60_000,
  });

  // Memoize the list of games by merging pages and removing duplicates, ensuring that the list updates efficiently when new data is fetched and that the total number of games does not exceed the specified maximum if one is set
  const games = useMemo(() => {
    const pages = gamesData?.pages ?? [];
    let merged: GameItem[] = [];
    for (const page of pages) {
      merged = mergeUniqueGames(merged, page.items);
      if (maxGames > 0 && merged.length >= maxGames) {
        return merged.slice(0, maxGames);
      }
    }
    return merged;
  }, [gamesData?.pages, maxGames]);

  // Memoize the list of upcoming games by merging pages and removing duplicates, ensuring that the list updates efficiently when new data is fetched and that the total number of upcoming games does not exceed the specified maximum if one is set
  const upcomingGames = useMemo(() => {
    const pages = upcomingData?.pages ?? [];
    let merged: GameItem[] = [];
    for (const page of pages) {
      merged = mergeUniqueGames(merged, page.items);
      if (maxGames > 0 && merged.length >= maxGames) {
        return merged.slice(0, maxGames);
      }
    }
    return merged;
  }, [upcomingData?.pages, maxGames]);

  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) return [] as GameItem[];
    return serverSearchResults?.items ?? [];
  }, [normalizedSearchQuery, serverSearchResults]);
  const hasMoreSearchResults = Boolean(serverSearchResults?.hasMore);

  const filteredGames = useMemo(
    () => (normalizedSearchQuery ? searchResults : games),
    [games, normalizedSearchQuery, searchResults]
  );

  const filteredUpcomingGames = useMemo(() => upcomingGames, [upcomingGames]);

  // Combine errors from different queries into a single error message for easier handling and display in the UI, ensuring that users are informed of any issues that occur during data fetching while also providing a clear and concise error message when multiple queries may have failed
  const gamesError =
    gamesQueryError?.message ?? 
    upcomingQueryError?.message ??
    trendingQueryError?.message ??
    topGamesQueryError?.message ??
    searchQueryError?.message ??
    null;
  const hasMoreUpcoming = Boolean(hasMoreUpcomingGames);

  // Callback function for loading more upcoming games, with checks to prevent multiple simultaneous fetches and to ensure that there are more pages to load before attempting to fetch additional data, providing a smooth and responsive experience for users as they explore the upcoming game library and discover new content without encountering issues related to excessive or redundant API calls
  const loadMoreUpcomingGames = useCallback(async () => {
    if (!hasMoreUpcoming || upcomingLoadingMore || upcomingLoading) return;
    await fetchNextUpcomingPage();
  }, [
    fetchNextUpcomingPage,
    hasMoreUpcoming,
    upcomingLoading,
    upcomingLoadingMore,
  ]);

  // useEffect for displaying error messages as toast notifications when the gamesError state changes
  useEffect(() => {
    // If there is no error message, do not display a toast
    const message = gamesError;
    if (!message) return;
    setToastMessage(message);
    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [gamesError]);

  // useCallback function for navigating to the game detail page when a game item is clicked, providing a seamless transition for users as they explore individual game details and ensuring that the correct game ID is included in the URL for proper routing and data fetching on the detail page
  const openGameDetail = useCallback(
    (targetId: number) => {
      navigate(`/games/${targetId}`);
    },
    [navigate],
  );

  // useCallback function for opening the lightbox to display a selected media item, with logic to determine the index of the selected media within the list of featured media candidates and to set the lightbox index accordingly, providing an immersive experience for users as they view game media in a larger format while ensuring that the correct media item is displayed based on user interaction
  const featuredCandidates = useMemo(() => {
    const safePool = filteredGames.filter(
      (game) => !isNsfwGame(game) && !isNonBaseContentGame(game),
    );
    const withReleaseDates = safePool.filter((game) =>
      Boolean(parseReleaseDate(game.release_date)),
    );
    return withReleaseDates.length ? withReleaseDates : safePool;
  }, [filteredGames]);
  const featuredCandidatesKey = useMemo(
    () => featuredCandidates.map((game) => String(game.id)).join("|"),
    [featuredCandidates],
  );

  // useEffect for selecting a featured game when the list of featured candidates changes, with logic to maintain the current featured game if it is still in the list of candidates or to randomly select a new featured game if the current one is no longer available, ensuring that the hero section of the page remains dynamic and engaging while also providing consistency for users as they explore the game library
  useEffect(() => {
    // Scroll to top when the featured game changes
    if (!featuredCandidates.length) {
      setFeaturedGameId(null);
      setFeaturedDetail(null);
      return;
    }

    // If the current featured game is still in the list of candidates, keep it as the featured game. Otherwise, randomly select a new featured game from the candidates. This logic ensures that the featured game remains consistent for users as long as it is still relevant, while also allowing for dynamic updates to the hero section when the list of candidates changes due to new data being fetched or other factors.
    setFeaturedGameId((prevId) => {
      if (prevId && featuredCandidates.some((game) => game.id === prevId)) {
        return prevId;
      }
      const nextIndex = pickPseudoRandomIndex(
        featuredCandidates.length,
        `featured:${featuredCandidatesKey}`,
      );
      return featuredCandidates[nextIndex].id ?? null;
    });
  }, [featuredCandidates, featuredCandidatesKey]);

  // useEffect for fetching detailed information about the featured game when the featuredGameId changes, with logic to handle API requests and responses, update the featuredDetail state, and manage potential errors gracefully, ensuring that users have access to comprehensive information about the featured game while also providing a responsive experience as they explore the hero section of the page
  useEffect(() => {
    if (!featuredGameId) {
      setFeaturedDetail(null);
      return;
    }
    const controller = new AbortController();
    const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
    const root = trimmedBaseUrl.endsWith("/api")
      ? trimmedBaseUrl.slice(0, -4)
      : trimmedBaseUrl;
    const url = `${root}/api/games/${featuredGameId}`;
    const loadFeaturedDetail = async () => {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          ...(authToken
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {}),
        });
        if (!response.ok) {
          throw new Error(`Failed to load featured game: ${response.status}`);
        }
        const data = (await response.json()) as GameItem;
        if (!data || typeof data !== "object") {
          throw new Error("Invalid featured game response");
        }
        if (isNsfwGame(data) || isNonBaseContentGame(data)) {
          setFeaturedDetail(null);
          return;
        }
        setFeaturedDetail(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setFeaturedDetail(null);
      }
    };
    loadFeaturedDetail();
    return () => controller.abort();
  }, [baseUrl, featuredGameId, authToken]);

  const featuredGame = featuredGameId
    ? (featuredCandidates.find((game) => game.id === featuredGameId) ?? null)
    : featuredCandidates.length
      ? featuredCandidates[
          pickPseudoRandomIndex(
            featuredCandidates.length,
            `featured-fallback:${featuredCandidatesKey}`,
          )
        ]
      : null;

  const heroGame = useMemo(() => {
    if (
      featuredDetail &&
      featuredDetail.id === featuredGameId &&
      !isNsfwGame(featuredDetail) &&
      !isNonBaseContentGame(featuredDetail)
    ) {
      return featuredDetail;
    }
    if (
      featuredGame &&
      !isNsfwGame(featuredGame) &&
      !isNonBaseContentGame(featuredGame)
    ) {
      return featuredGame;
    }
    return null;
  }, [featuredDetail, featuredGame, featuredGameId]);
  const heroDescriptionSource = collapseWhitespace(
    heroGame?.description || heroGame?.story,
  );
  const heroDescription = heroDescriptionSource
    ? truncateText(heroDescriptionSource, 420)
    : "A fresh pick from your library.";

  const featuredCover = normalizeMediaUrl(heroGame?.cover_image ?? undefined);
  const featuredMedia = useMemo(
    () => (Array.isArray(heroGame?.media) ? heroGame.media : []),
    [heroGame?.media],
  );
  const featuredScreenshotMedia = useMemo(
    () =>
      Array.from(
        new Set(
          featuredMedia
            .filter((item) => item.media_type === "screenshot")
            .map((item) => normalizeMediaUrl(item.url))
            .filter((url): url is string => Boolean(url)),
        ),
      ),
    [featuredMedia],
  );
  const featuredArtworkMedia = useMemo(
    () =>
      Array.from(
        new Set(
          featuredMedia
            .filter((item) => item.media_type === "artwork")
            .map((item) => normalizeMediaUrl(item.url))
            .filter((url): url is string => Boolean(url)),
        ),
      ),
    [featuredMedia],
  );
  const featuredFallbackScreenshots = useMemo(
    () =>
      Array.from(
        new Set(
          (heroGame?.screenshots ?? [])
            .map((screenshot) => normalizeMediaUrl(screenshot))
            .filter((screenshot): screenshot is string => Boolean(screenshot)),
        ),
      ),
    [heroGame?.screenshots],
  );
  const coverFallbackUrl = upgradeIgdbSize(featuredCover, "t_1080p");
  const featuredMediaCandidates = useMemo(
    () =>
      Array.from(
        new Set([
          ...featuredArtworkMedia,
          ...featuredScreenshotMedia,
          ...featuredFallbackScreenshots,
          ...(coverFallbackUrl ? [coverFallbackUrl] : []),
        ]),
      ),
    [
      coverFallbackUrl,
      featuredArtworkMedia,
      featuredFallbackScreenshots,
      featuredScreenshotMedia,
    ],
  );

  // Analyze the dimensions of candidate media URLs to determine which ones are suitable for use as hero images, and store the results in the landscapeByUrl state for efficient lookup when rendering the hero section
  // This effect creates Image objects for each candidate URL and checks their dimensions when they load. It updates the landscapeByUrl state to indicate whether each URL is landscape-oriented and meets certain size and aspect ratio criteria for use as a hero image. The effect also handles cleanup to avoid updating state after unmounting.
  useEffect(() => {
    if (typeof Image === "undefined") return;
    const pending = featuredMediaCandidates.filter(
      (url) => landscapeByUrl[url] === undefined,
    );
    if (!pending.length) return;

    let isActive = true;
    for (const url of pending) {
      const image = new Image();
      image.onload = () => {
        if (!isActive) return;
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        const aspect = height > 0 ? width / height : 0;
        const isLandscape = width > height;
        const hasHeroLikeSize =
          width >= HERO_MIN_WIDTH && height >= HERO_MIN_HEIGHT;
        const hasHeroLikeAspect =
          aspect >= HERO_MIN_ASPECT && aspect <= HERO_MAX_ASPECT;
        // Treat very wide, short assets as logo/title strips and exclude them.
        const isHeroEligible =
          isLandscape && hasHeroLikeSize && hasHeroLikeAspect;
        setLandscapeByUrl((current) => {
          if (current[url] !== undefined) return current;
          return { ...current, [url]: isHeroEligible };
        });
      };
      image.onerror = () => {
        if (!isActive) return;
        setLandscapeByUrl((current) => {
          if (current[url] !== undefined) return current;
          return { ...current, [url]: false };
        });
      };
      image.src = url;
    }

    return () => {
      isActive = false;
    };
  }, [featuredMediaCandidates, landscapeByUrl]);

  // Use useMemo to create filtered lists of media URLs that are eligible for use as hero images based on their dimensions, and to determine the preferred pool of media for the hero section. This allows the component to efficiently select an appropriate hero image from the available media while avoiding URLs that have been determined to be ineligible or have failed to load. The effect also includes logic to randomly pick a featured media URL from the preferred pool whenever the hero game changes or when the eligibility of media URLs is updated.
  const heroEligibleArtworkMedia = useMemo(
    () =>
      featuredArtworkMedia.filter((url) => landscapeByUrl[url] === true),
    [featuredArtworkMedia, landscapeByUrl],
  );
  const heroEligibleScreenshotMedia = useMemo(
    () =>
      featuredScreenshotMedia.filter((url) => landscapeByUrl[url] === true),
    [featuredScreenshotMedia, landscapeByUrl],
  );
  const heroEligibleFallbackScreenshots = useMemo(
    () =>
      featuredFallbackScreenshots.filter((url) => landscapeByUrl[url] === true),
    [featuredFallbackScreenshots, landscapeByUrl],
  );
  // Provisional pools (unknown size yet) keep hero from going black while dimensions load.
  const provisionalScreenshotMedia = useMemo(
    () =>
      featuredScreenshotMedia.filter((url) => landscapeByUrl[url] !== false),
    [featuredScreenshotMedia, landscapeByUrl],
  );
  const provisionalFallbackScreenshots = useMemo(
    () =>
      featuredFallbackScreenshots.filter((url) => landscapeByUrl[url] !== false),
    [featuredFallbackScreenshots, landscapeByUrl],
  );
  const heroEligibleArtworkPool = useMemo(
    () =>
      heroEligibleArtworkMedia.filter((url) => !failedHeroUrls[url]),
    [heroEligibleArtworkMedia, failedHeroUrls],
  );
  const heroEligibleScreenshotPool = useMemo(
    () =>
      heroEligibleScreenshotMedia.filter((url) => !failedHeroUrls[url]),
    [heroEligibleScreenshotMedia, failedHeroUrls],
  );
  const heroEligibleFallbackScreenshotPool = useMemo(
    () =>
      heroEligibleFallbackScreenshots.filter((url) => !failedHeroUrls[url]),
    [heroEligibleFallbackScreenshots, failedHeroUrls],
  );
  const provisionalScreenshotPool = useMemo(
    () =>
      provisionalScreenshotMedia.filter((url) => !failedHeroUrls[url]),
    [provisionalScreenshotMedia, failedHeroUrls],
  );
  const provisionalFallbackScreenshotPool = useMemo(
    () =>
      provisionalFallbackScreenshots.filter((url) => !failedHeroUrls[url]),
    [provisionalFallbackScreenshots, failedHeroUrls],
  );
  const coverHeroCandidate =
    coverFallbackUrl && !failedHeroUrls[coverFallbackUrl]
      ? coverFallbackUrl
      : null;
  const heroPreferredPool = useMemo(() => {
    if (heroEligibleScreenshotPool.length) return heroEligibleScreenshotPool;
    if (heroEligibleFallbackScreenshotPool.length) {
      return heroEligibleFallbackScreenshotPool;
    }
    if (provisionalScreenshotPool.length) return provisionalScreenshotPool;
    if (provisionalFallbackScreenshotPool.length) {
      return provisionalFallbackScreenshotPool;
    }
    if (heroEligibleArtworkPool.length) {
      return heroEligibleArtworkPool;
    }
    return [];
  }, [
    heroEligibleArtworkPool,
    heroEligibleFallbackScreenshotPool,
    heroEligibleScreenshotPool,
    provisionalFallbackScreenshotPool,
    provisionalScreenshotPool,
  ]);
  const heroPreferredPoolKey = useMemo(
    () => heroPreferredPool.join("|"),
    [heroPreferredPool],
  );
  
  useEffect(() => {
    if (!heroPreferredPool.length) {
      setFeaturedMediaPick((current) => (current === 0 ? current : 0));
      return;
    }

    // If the current pick is out of bounds for the new pool, reset to 0. Otherwise, randomly pick a new index that is different from the current one to ensure variety in the hero images while maintaining consistency when possible.
    setFeaturedMediaPick((current) => {
      const next = pickPseudoRandomIndex(
        heroPreferredPool.length,
        `hero-media:${heroGame?.id ?? "none"}:${heroPreferredPoolKey}`,
      );
      if (heroPreferredPool.length === 1) return 0;
      if (next === current) {
        return (current + 1) % heroPreferredPool.length;
      }
      return next;
    });
  }, [heroGame?.id, heroPreferredPool.length, heroPreferredPoolKey]);

  const activeHeroMedia: HeroMediaCandidate | null = useMemo(() => {
    if (heroEligibleScreenshotPool.length) {
      return {
        url: heroEligibleScreenshotPool[
          featuredMediaPick % heroEligibleScreenshotPool.length
        ],
        source: "screenshot",
      };
    }
    if (heroEligibleFallbackScreenshotPool.length) {
      return {
        url: heroEligibleFallbackScreenshotPool[
          featuredMediaPick % heroEligibleFallbackScreenshotPool.length
        ],
        source: "screenshot",
      };
    }
    if (provisionalScreenshotPool.length) {
      return {
        url: provisionalScreenshotPool[
          featuredMediaPick % provisionalScreenshotPool.length
        ],
        source: "screenshot",
      };
    }
    if (provisionalFallbackScreenshotPool.length) {
      return {
        url: provisionalFallbackScreenshotPool[
          featuredMediaPick % provisionalFallbackScreenshotPool.length
        ],
        source: "screenshot",
      };
    }
    if (heroEligibleArtworkPool.length) {
      return {
        url: heroEligibleArtworkPool[
          featuredMediaPick % heroEligibleArtworkPool.length
        ],
        source: "artwork",
      };
    }
    if (coverHeroCandidate) {
      return { url: coverHeroCandidate, source: "cover" };
    }
    return null;
  }, [
    coverHeroCandidate,
    featuredMediaPick,
    heroEligibleArtworkPool,
    heroEligibleFallbackScreenshotPool,
    heroEligibleScreenshotPool,
    provisionalFallbackScreenshotPool,
    provisionalScreenshotPool,
  ]);

  const heroMediaUrl = activeHeroMedia?.url ?? null;
  const heroMediaClassName =
    activeHeroMedia?.source === "cover"
      ? "games-hero__image games-hero__image--cover"
      : activeHeroMedia?.source === "artwork"
        ? "games-hero__image games-hero__image--artwork"
        : "games-hero__image games-hero__image--screenshot";
  
  // The featuredScreenshots list is created by selecting the appropriate pool of media URLs based on their eligibility for use as hero images, and then applying a rotation based on the featuredMediaPick index to ensure that different media items are showcased in the hero section over time. This allows the component to dynamically display a variety of media from the featured game while prioritizing those that are best suited for the hero image based on their dimensions and aspect ratios.
  const featuredScreenshots = useMemo(() => {
    const base = heroEligibleScreenshotPool.length
      ? heroEligibleScreenshotPool
      : heroEligibleFallbackScreenshotPool.length
        ? heroEligibleFallbackScreenshotPool
        : provisionalScreenshotPool.length
          ? provisionalScreenshotPool
          : provisionalFallbackScreenshotPool.length
            ? provisionalFallbackScreenshotPool
            : heroEligibleArtworkPool.length
              ? heroEligibleArtworkPool
              : [];
    if (!base.length) return [];
    const offset = featuredMediaPick % base.length;
    if (offset === 0) return base;
    return [
      ...base.slice(offset),
      ...base.slice(0, offset),
    ];
  }, [
    heroEligibleScreenshotPool,
    heroEligibleFallbackScreenshotPool,
    provisionalScreenshotPool,
    provisionalFallbackScreenshotPool,
    heroEligibleArtworkPool,
    featuredMediaPick,
  ]);
  // useCallback functions for rendering game items in carousels, including logic to determine the appropriate cover image and description for each game based on available data. These functions are passed as props to the GameCarousel components to ensure consistent rendering of game items across different carousels while allowing for dynamic content based on the specific media and metadata of each game.
  const carouselCover = useCallback(
    (game: GameItem) => normalizeMediaUrl(game.cover_image),
    [],
  );
  // The getReleaseDescription function formats the release date of a game into a human-readable string, or returns "n/a" if the release date is not available or invalid. This function is used to provide consistent release information for games displayed in the carousels.
  const getReleaseDescription = useCallback((game: GameItem) => {
    const release = formatReleaseDate(game.release_date);
    return release ? `Release: ${release}` : "Release: n/a";
  }, []);
  
  // The getExploreDescription function constructs a multi-line description for a game that includes its release date and genre if available. It filters out any null values to ensure that only valid information is included in the final description string, which is used in the "Explore" carousel to provide users with key details about each game at a glance.
  const getExploreDescription = useCallback((game: GameItem) => {
    const release = formatReleaseDate(game.release_date);
    return [
      release ? `Release: ${release}` : null,
      game.genre ? `Genre: ${game.genre}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }, []);

  // Prepare game lists for carousels
  const safeFilteredGames = useMemo(
    () => filteredGames.filter((game) => !isNsfwGame(game)),
    [filteredGames],
  );
  const safeFilteredUpcomingGames = useMemo(
    () => filteredUpcomingGames.filter((game) => !isNsfwGame(game)),
    [filteredUpcomingGames],
  );
  const safeTopAllTimeGames = useMemo(
    () => topAllTimeGames.filter((game) => !isNsfwGame(game)).slice(0, 100),
    [topAllTimeGames],
  );
  const safeRecentPopularGames = useMemo(
    () => recentPopularGames.filter((game) => !isNsfwGame(game)),
    [recentPopularGames],
  );

  const releasedGames = useMemo(
    () => safeFilteredGames.filter((game) => isReleasedGames(game)),
    [safeFilteredGames],
  );
  // The topTenGames list is created by slicing the first 10 games from the releasedGames list, which contains only games that have been released based on their release dates. This list is used for the "Top Ten" carousel to showcase a curated selection of recently released games, providing users with a quick overview of popular titles that are currently available to play.
  const topTenFallbackGames = useMemo(() => {
    return [...releasedGames]
      .filter((game) => getEffectiveRatingCount(game) > 0)
      .sort((a, b) => {
        const countDiff = getEffectiveRatingCount(b) - getEffectiveRatingCount(a);
        if (countDiff !== 0) return countDiff;
        const ratingDiff = getEffectiveRating(b) - getEffectiveRating(a);
        if (ratingDiff !== 0) return ratingDiff;
        const popularityDiff = (b.popularity ?? 0) - (a.popularity ?? 0);
        if (popularityDiff !== 0) return popularityDiff;
        return a.id - b.id;
      });
  }, [releasedGames]);
  const topTenGames = safeTopAllTimeGames.length
    ? safeTopAllTimeGames
    : topTenFallbackGames;
  const upcomingList = safeFilteredUpcomingGames;

  // The trendingList is determined by checking if there are any recent popular games available. If there are, it uses that list; otherwise, 
  // it falls back to using the first 10 games from the discovery list. This logic ensures that the "Trending" carousel always has content to display, 
  // prioritizing recent popular games when available while still providing a fallback option to maintain an engaging user experience.
  const trendingList = useMemo(
    () => 
      safeRecentPopularGames.length
        ? safeRecentPopularGames
        : releasedGames,
    [safeRecentPopularGames, releasedGames],
  );
  const questionnaireComplete = useMemo(
    () => isQuestionnaireComplete(questionnaireAnswers),
    [questionnaireAnswers],
  );
  const runQuestionnaireRecommendation = useCallback(
    async (answers: QuestionnaireAnswers) => {
      if (!authUser?.id) {
        setRecommendationError("User id is required to request recommendations.");
        return false;
      }
      setRecommendationLoading(true);
      setRecommendationError(null);
      try {
        const payload = buildRecommendRequestFromQuestionnaire(authUser.id, answers);
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

        setRecommendationStrategy(typeof body.strategy === "string" ? body.strategy : null);

        if (!candidateIds.length) {
          setRecommendedGames([]);
          return true;
        }

        const fetched = await Promise.all(
          candidateIds.map(async (gameId) => {
            const gameResponse = await fetch(`${API_ROOT}/api/games/${gameId}`, {
              ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
            });
            if (!gameResponse.ok) return null;
            const game = (await gameResponse.json()) as GameItem;
            return game && typeof game.id === "number" ? game : null;
          }),
        );

        setRecommendedGames(
          fetched.filter(
            (game): game is GameItem => {
              if (!game) return false;
              return !isNsfwGame(game) && !isNonBaseContentGame(game);
            },
          ),
        );
        return true;
      } catch (err) {
        setRecommendedGames([]);
        setRecommendationError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setRecommendationLoading(false);
      }
    },
    [authToken, authUser?.id],
  );

  useEffect(() => {
    const empty = createEmptyQuestionnaireAnswers();
    if (!questionnaireStorageKey) {
      setQuestionnaireAnswers(empty);
      setQuestionnaireOpen(false);
      setRecommendationStrategy(null);
      setRecommendedGames([]);
      setRecommendationError(null);
      setShowQuestionnaireResult(false);
      return;
    }

    try {
      const raw = localStorage.getItem(questionnaireStorageKey);
      if (!raw) {
        setQuestionnaireAnswers(empty);
        setQuestionnaireOpen(false);
        setRecommendationStrategy(null);
        setRecommendedGames([]);
        setRecommendationError(null);
        setShowQuestionnaireResult(false);
        return;
      }
      const parsed = normalizeStoredQuestionnaireAnswers(JSON.parse(raw));
      if (!parsed) {
        setQuestionnaireAnswers(empty);
        setQuestionnaireOpen(false);
        setShowQuestionnaireResult(false);
        return;
      }
      setQuestionnaireAnswers(parsed);
      setQuestionnaireOpen(false);
      setShowQuestionnaireResult(false);
      if (isQuestionnaireComplete(parsed)) {
        void runQuestionnaireRecommendation(parsed);
      } else {
        setRecommendationStrategy(null);
        setRecommendedGames([]);
        setRecommendationError(null);
      }
    } catch {
      setQuestionnaireAnswers(empty);
      setQuestionnaireOpen(false);
      setRecommendationStrategy(null);
      setRecommendedGames([]);
      setRecommendationError(null);
      setShowQuestionnaireResult(false);
    }
  }, [questionnaireStorageKey, runQuestionnaireRecommendation]);

  useEffect(() => {
    const shouldOpenQuestionnaire =
      searchParams.get("open_questionnaire") === "1" ||
      searchParams.get("open_questionnaire") === "true";
    if (!shouldOpenQuestionnaire) return;
    setShowQuestionnaireResult(false);
    setQuestionnaireOpen(true);
  }, [searchParams]);

  const updateQuestionnaireAnswer = useCallback(
    (questionId: string, optionId: string, type: "single_select" | "multi_select") => {
      setQuestionnaireAnswers((prev) => {
        const existing = prev[questionId] ?? [];
        if (type === "single_select") {
          return {
            ...prev,
            [questionId]: [optionId],
          };
        }
        const set = new Set(existing);
        if (set.has(optionId)) {
          set.delete(optionId);
        } else {
          set.add(optionId);
        }
        return {
          ...prev,
          [questionId]: Array.from(set),
        };
      });
    },
    [],
  );

  const handleQuestionnaireSubmit = useCallback(async () => {
    if (!questionnaireComplete) return;
    if (questionnaireStorageKey) {
      try {
        localStorage.setItem(questionnaireStorageKey, JSON.stringify(questionnaireAnswers));
      } catch {
        // Ignore storage failures and continue with in-memory answers.
      }
    }
    setQuestionnaireOpen(false);
    const success = await runQuestionnaireRecommendation(questionnaireAnswers);
    setShowQuestionnaireResult(success);
  }, [
    questionnaireAnswers,
    questionnaireComplete,
    questionnaireStorageKey,
    runQuestionnaireRecommendation,
  ]);

  const handleQuestionnaireRetake = useCallback(() => {
    setShowQuestionnaireResult(false);
    setQuestionnaireOpen(true);
  }, []);

  const topRecommendedGame = useMemo(
    () => recommendedGames[0] ?? null,
    [recommendedGames],
  );

  const topRecommendationSummary = useMemo(() => {
    if (!topRecommendedGame) return "We couldn't load details for the top recommendation yet.";
    const source = collapseWhitespace(
      topRecommendedGame.description || topRecommendedGame.story || "",
    );
    if (!source) return "Open this title to view full details and see why it matches your answers.";
    return truncateText(source, 260);
  }, [topRecommendedGame]);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    setSearchPage(1);
    setSearchQuery(collapseWhitespace(searchInput));
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setSearchPage(1);
  }, []);

  const scrollToSection = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="games-page">
      <div className="games-shell">
        <header className="games-header">
          <button
            type="button"
            className="games-brand"
            onClick={() => navigate("/")}
          >
            <img src={logoUrl} alt="NextPlay Logo" />
            <span className="games-brand__text">
              <span className="games-brand__title">NextPlay</span>
              <span className="games-brand__subtitle">Home Page</span>
            </span>
          </button>
          <nav className="games-nav" aria-label="Primary">
            <Navbar />
          </nav>
          <div className="games-actions">
            <Searchbar
            value={searchInput}
            onValueChange={setSearchInput}
            onSubmit={handleSearchSubmit} 
            />
            <button
              type="button"
              className="games-avatar"
              aria-label="Account menu"
              onClick={() => navigate("/user")}
            >
              {avatarText}
            </button>
          </div>
        </header>

        <section className="games-hero">
          <div className="games-hero__media">
            {heroMediaUrl ? (
              <img
                src={heroMediaUrl}
                alt={heroGame?.name || "Featured game"}
                className={heroMediaClassName}
                onError={() => {
                  if (!heroMediaUrl) return;
                  setFailedHeroUrls((current) => {
                    if (current[heroMediaUrl]) return current;
                    return { ...current, [heroMediaUrl]: true };
                  });
                }}
              />
            ) : null}
            <div className="games-hero__shade" />
          </div>
          <div className="games-hero__content">
            {heroGame ? (
              <>
                <p className="games-hero__eyebrow">Featured today</p>
                <h1 className="games-hero__title" title={heroGame.name}>
                  {heroGame.name}
                </h1>
                <p
                  className="games-hero__desc"
                  title={heroDescriptionSource || undefined}
                >
                  {heroDescription}
                </p>
                <div className="games-hero__meta">
                  <span>{"Genre: " + (heroGame.genre ?? "n/a")}</span>
                  <span>{"Publisher: " + (heroGame.publishers ?? "n/a")}</span>
                  <span>
                    {formatReleaseDate(heroGame.release_date)
                      ? `Release: ${formatReleaseDate(heroGame.release_date)}`
                      : "Release: n/a"}
                  </span>
                </div>
                <div className="games-hero__actions">
                  <button
                    type="button"
                    className="games-hero__button games-hero__button--primary"
                    onClick={() => {
                      if (heroGame?.id) openGameDetail(heroGame.id);
                    }}
                    disabled={!heroGame.id}
                  >
                    View details
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="games-hero__eyebrow">Library loading</p>
                <h1 className="games-hero__title">Loading games...</h1>
                <p className="games-hero__desc">
                  We will surface a featured title as soon as your API responds.
                </p>
                <div className="games-hero__actions">
                  <button
                    type="button"
                    className="games-hero__button games-hero__button--ghost"
                    onClick={() => {
                      void Promise.all([
                        refetchGames(),
                        refetchUpcomingGames(),
                        refetchTrendingGames(),
                        refetchTopGames(),
                      ]);
                    }}
                    disabled={
                      gamesLoading ||
                      upcomingLoading ||
                      trendingLoading ||
                      topGamesLoading ||
                      searchLoading ||
                      searchFetching
                    }
                  >
                    {gamesLoading || upcomingLoading || trendingLoading || topGamesLoading || searchLoading || searchFetching
                      ? "Refreshing..."
                      : "Refresh list"}
                  </button>
                </div>
              </>
            )}
          </div>
          {featuredScreenshots.length ? (
            <div className="games-hero__screenshots games-hero__screenshots--overlay">
              <p className="games-hero__screenshots-label">Screenshots</p>
              <div className="games-hero__screenshots-row">
                {featuredScreenshots.slice(0, 5).map((screenshot, index) => (
                  <button
                    key={`${heroGame?.id}-screenshot-${index}`}
                    type="button"
                    className="games-hero__screenshot-button"
                    onClick={() => setLightboxIndex(index)}
                    aria-label={`Open screenshot ${index + 1} of ${heroGame?.name}`}
                  >
                    <img
                      src={screenshot}
                      alt={`Screenshot ${index + 1} of ${heroGame?.name}`}
                      className="games-hero__screenshot"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <main className="games-content">
          {gamesError && <div className="games-alert">{gamesError}</div>}

          <section className="games-search-results" aria-live="polite">
            {normalizedSearchQuery ? (
              <>
                <p className="games-search-results__label">
                  Search results for "{normalizedSearchQuery}"
                </p>
                <p className="games-search-results__count">
                  {searchLoading || searchFetching
                    ? "Searching..."
                    : `Showing ${searchResults.length === 0 ? 0 : searchOffset + 1}-${searchOffset + searchResults.length} on page ${searchPage}.`}
                </p>
              </>
            ) : (
               <p className="games-search-results__count">
                Showing all games. Enter a query and press Enter to filter.
              </p>
            )}
          </section>
          <div className="games-quick-actions" aria-label="Page quick actions">
            {normalizedSearchQuery ? (
              <>
                <button
                  type="button"
                  className="games-quick-actions__button"
                  onClick={() => scrollToSection(searchGridSectionRef.current)}
                >
                  Jump to results
                </button>
                <button
                  type="button"
                  className="games-quick-actions__button"
                  onClick={clearSearch}
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="games-quick-actions__button"
                  onClick={() => scrollToSection(upcomingSectionRef.current)}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  className="games-quick-actions__button"
                  onClick={() => scrollToSection(topRatedSectionRef.current)}
                >
                  Top rated
                </button>
                <button
                  type="button"
                  className="games-quick-actions__button"
                  onClick={() => scrollToSection(trendingSectionRef.current)}
                >
                  Trending
                </button>
              </>
            )}
          </div>

          {normalizedSearchQuery ? (
            <section
              ref={searchGridSectionRef}
              className="games-search-grid-section"
              aria-live="polite"
            >
              {searchResults.length ? (
                <div className="games-search-grid">
                  {searchResults.map((game) => (
                    <Card
                      key={`search-grid-${game.id}`}
                      title={game.name || "Untitled"}
                      description={getExploreDescription(game)}
                      icon={
                        carouselCover(game) ? (
                          <img
                            src={carouselCover(game) ?? ""}
                            alt={game.name || "Game cover"}
                            className="card__image"
                            loading="lazy"
                          />
                        ) : undefined
                      }
                      onClick={() => openGameDetail(game.id)}
                      ariaLabel={`View details for ${game.name || "game"}`}
                    />
                  ))}
                </div>
              ) : (
                <p className="games-search-grid__empty">
                  No games matched that query. Try a shorter or broader term.
                </p>
              )}
              {searchPage > 1 || hasMoreSearchResults ? (
                <div className="games-pagination">
                  <button
                    type="button"
                    className="games-pagination__button"
                    onClick={() => setSearchPage((current) => Math.max(1, current - 1))}
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
                    onClick={() => setSearchPage((current) => current + 1)}
                    disabled={!hasMoreSearchResults || searchLoading || searchFetching}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {!normalizedSearchQuery ? (
            <>
              <section ref={upcomingSectionRef}>
                <GameCarousel
                  title="Upcoming Games"
                  badge="Preview"
                  games={upcomingList}
                  onSelect={openGameDetail}
                  getCoverUrl={carouselCover}
                  itemWidth={190}
                  onLoadMore={loadMoreUpcomingGames}
                  canLoadMore={hasMoreUpcoming}
                  isLoadingMore={upcomingLoadingMore}
                  getDescription={getReleaseDescription}
                />
              </section>

              <section ref={topRatedSectionRef}>
                <GameCarousel
                  title="Top Rated of all time"
                  badge="Ranked"
                  games={topTenGames}
                  onSelect={openGameDetail}
                  getCoverUrl={carouselCover}
                  showRank
                  itemWidth={200}
                  getDescription={getReleaseDescription}
                />
              </section>

              <section ref={trendingSectionRef}>
                <GameCarousel
                  title="Trending Games"
                  badge="Hot"
                  games={trendingList}
                  onSelect={openGameDetail}
                  getCoverUrl={carouselCover}
                  itemWidth={190}
                  getDescription={getReleaseDescription}
                />
              </section>
            </>
          ) : null}

        </main>
        <SiteFooter />
      </div>

      {questionnaireOpen ? (
        <div className="games-questionnaire-backdrop" role="dialog" aria-modal="true">
          <div className="games-questionnaire">
            <p className="games-questionnaire__eyebrow">First-run setup</p>
            <h2 className="games-questionnaire__title">Tell us what you like</h2>
            <p className="games-questionnaire__subtitle">
              We use this once to personalize recommendations. You can retake it any time.
            </p>
            <div className="games-questionnaire__body">
              {QUESTIONNAIRE_V1.questions.map((question) => {
                const selected = new Set(questionnaireAnswers[question.id] ?? []);
                return (
                  <section key={question.id} className="games-questionnaire__question">
                    <h3>{question.prompt}</h3>
                    <div className="games-questionnaire__options">
                      {question.options.map((option) => {
                        const isActive = selected.has(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`games-questionnaire__option${isActive ? " is-active" : ""}`}
                            onClick={() =>
                              updateQuestionnaireAnswer(question.id, option.id, question.type)
                            }
                            aria-pressed={isActive}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="games-questionnaire__actions">
              <button
                type="button"
                className="games-questionnaire__button games-questionnaire__button--ghost"
                onClick={() => {
                  setQuestionnaireOpen(false);
                }}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="games-questionnaire__button games-questionnaire__button--primary"
                onClick={() => {
                  void handleQuestionnaireSubmit();
                }}
                disabled={!questionnaireComplete || recommendationLoading}
              >
                {recommendationLoading ? "Saving..." : "Save and get recommendations"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showQuestionnaireResult ? (
        <div className="games-result-backdrop" role="dialog" aria-modal="true">
          <div className="games-result">
            <header className="games-result__header">
              <p className="games-result__eyebrow">Results Page</p>
              <h2 className="games-result__title">
                The algorithm&apos;s verdict: this one&apos;s made for you.
              </h2>
            </header>

            {topRecommendedGame ? (
              <section className="games-result__card">
                <div className="games-result__poster">
                  {normalizeMediaUrl(topRecommendedGame.cover_image) ? (
                    <img
                      src={normalizeMediaUrl(topRecommendedGame.cover_image) ?? ""}
                      alt={topRecommendedGame.name || "Top recommendation cover"}
                      loading="lazy"
                    />
                  ) : (
                    <div className="games-result__poster-fallback">No image</div>
                  )}
                </div>

                <div className="games-result__content">
                  <h3>{topRecommendedGame.name || "Top recommendation"}</h3>
                  <p>{topRecommendationSummary}</p>
                  <div className="games-result__meta">
                    <span>
                      {formatReleaseDate(topRecommendedGame.release_date)
                        ? `Release: ${formatReleaseDate(topRecommendedGame.release_date)}`
                        : "Release: n/a"}
                    </span>
                    <span>{`Genre: ${topRecommendedGame.genre ?? "n/a"}`}</span>
                  </div>
                </div>

                <aside className="games-result__score">
                  <p>Score</p>
                  <div className="games-result__score-pill">
                    {recommendationStrategy ? "Top Pick" : "Rank #1"}
                  </div>
                </aside>
              </section>
            ) : (
              <section className="games-result__empty">
                <p>{recommendationError ?? "No recommendation returned yet. Try retaking the questionnaire."}</p>
              </section>
            )}

            <footer className="games-result__actions">
              <button
                type="button"
                className="games-result__button games-result__button--primary"
                onClick={() => setShowQuestionnaireResult(false)}
              >
                Continue to home feed
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
                  Open top pick
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}

      {toastMessage && <div className="games-toast">{toastMessage}</div>}
      <Lightbox
        images={featuredScreenshots}
        activeIndex={lightboxIndex}
        onChangeIndex={setLightboxIndex}
        onClose={closeLightbox}
        altContext={featuredGame?.name ?? "featured game"}
      />
    </div>
  );
}

export default Games;
