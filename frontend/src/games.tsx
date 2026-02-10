import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Card from "./components/card";
import GameCarousel from "./components/GameCarousel";
import Lightbox from "./components/Lightbox";
import Navbar from "./components/Navbar";
import Searchbar from "./components/Searchbar";
import SiteFooter from "./components/SiteFooter";
import logoUrl from "./assets/logo.png";
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
const tokenizeSearchQuery = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 1);

const scoreGameSimilarity = (game: GameItem, terms: string[]) => {
  if (!terms.length) return 0;
  const name = (game.name ?? "").toLowerCase();
  const genre = (game.genre ?? "").toLowerCase();
  const publishers = (game.publishers ?? "").toLowerCase();
  const description = collapseWhitespace(
    [game.description, game.story].filter(Boolean).join(" "),
  ).toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (name === term) score += 100;
    else if (name.startsWith(term)) score += 45;
    else if (name.includes(term)) score += 28;

    if (genre.includes(term)) score += 16;
    if (publishers.includes(term)) score += 12;
    if (description.includes(term)) score += 8;
  }

  return score;
};

// Define the CSS styles for the loading spinner component using styled-components
const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
};

const isReleasedGames = (game: GameItem, now: Date = new Date()) => {
  const releaseDate = parseReleaseDate(game.release_date);
  return releaseDate ? releaseDate <= now : true;
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

// Main Games component handling game list view
function Games() {
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
  const normalizedSearchQuery = collapseWhitespace(searchQuery).toLowerCase();
  const pageSize = 48; // Number of games to fetch per page for general lists
  const upcomingPageSize = 24; // Number of unreleased games per page
  const maxGames = 0; // Maximum number of games to load in total

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
      console.debug(
        `Fetching games from: ${root}/api/games?include_media=1&${query.toString()}`,
      );
      const url = `${root}/api/games?include_media=1&${query.toString()}`;
      const response = await fetch(url, { signal });
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
    [baseUrl],
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
        const response = await fetch(`${root}/api/games/popular?${query.toString()}`, { signal });
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
      if (currentYearGames.length >= 300) {
        return dedupeGames(currentYearGames).slice(0, 300);
      }
      const previousYearGames = await fetchPopularByYear(currentYear - 1);
      return dedupeGames([...currentYearGames, ...previousYearGames]).slice(0, 300);
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

  const searchTerms = useMemo(
    () => tokenizeSearchQuery(normalizedSearchQuery),
    [normalizedSearchQuery],
  );

  const matchesSearchQuery = useCallback(
    (game: GameItem) => {
      if (!normalizedSearchQuery) return true;
      const searchableText = [
        game.name,
        game.genre,
        game.publishers,
        game.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedSearchQuery);
    },
    [normalizedSearchQuery]
  );
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) return [] as GameItem[];
    const ranked = games
      .map((game) => ({
        game,
        score: scoreGameSimilarity(game, searchTerms),
      }))
      .filter((entry) => entry.score > 0);
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const bPopularity = b.game.popularity ?? 0;
      const aPopularity = a.game.popularity ?? 0;
      return bPopularity - aPopularity;
    });
    return ranked.map((entry) => entry.game);
  }, [games, normalizedSearchQuery, searchTerms]);

  const filteredGames = useMemo(
    () =>
      normalizedSearchQuery ? searchResults : games.filter(matchesSearchQuery),
    [games, matchesSearchQuery, normalizedSearchQuery, searchResults]
  );

  const filteredUpcomingGames = useMemo(() => upcomingGames, [upcomingGames]);

  // Combine errors from different queries into a single error message for easier handling and display in the UI, ensuring that users are informed of any issues that occur during data fetching while also providing a clear and concise error message when multiple queries may have failed
  const gamesError =
    gamesQueryError?.message ?? 
    upcomingQueryError?.message ??
    trendingQueryError?.message ??
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
    const withReleaseDates = filteredGames.filter((game) =>
      Boolean(parseReleaseDate(game.release_date)),
    );
    return withReleaseDates.length ? withReleaseDates : filteredGames;
  }, [filteredGames]);

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
      const randomIndex = Math.floor(Math.random() * featuredCandidates.length);
      return featuredCandidates[randomIndex].id ?? null;
    });
  }, [featuredCandidates]);

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
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load featured game: ${response.status}`);
        }
        const data = (await response.json()) as GameItem;
        if (!data || typeof data !== "object") {
          throw new Error("Invalid featured game response");
        }
        setFeaturedDetail(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setFeaturedDetail(null);
      }
    };
    loadFeaturedDetail();
    return () => controller.abort();
  }, [baseUrl, featuredGameId]);

  const featuredGame = featuredGameId
    ? (featuredCandidates.find((game) => game.id === featuredGameId) ?? null)
    : featuredCandidates.length
      ? featuredCandidates[
          Math.floor(Math.random() * featuredCandidates.length)
        ]
      : null;

  const heroGame =
    featuredDetail && featuredDetail.id === featuredGameId
      ? featuredDetail
      : featuredGame;
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

    setFeaturedMediaPick((current) => {
      const next = Math.floor(Math.random() * heroPreferredPool.length);
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
  const releasedGames = useMemo(
    () =>  filteredGames.filter((game) => isReleasedGames(game)),
    [filteredGames],
    );
  // The topTenGames list is created by slicing the first 10 games from the releasedGames list, which contains only games that have been released based on their release dates. This list is used for the "Top Ten" carousel to showcase a curated selection of recently released games, providing users with a quick overview of popular titles that are currently available to play.
  const topTenGames = useMemo(() => releasedGames.slice(0, 10), [releasedGames]);
  const upcomingList = filteredUpcomingGames;

  // The trendingList is determined by checking if there are any recent popular games available. If there are, it uses that list; otherwise, 
  // it falls back to using the first 10 games from the discovery list. This logic ensures that the "Trending" carousel always has content to display, 
  // prioritizing recent popular games when available while still providing a fallback option to maintain an engaging user experience.
  const trendingList = useMemo(
    () => 
      recentPopularGames.length
        ? recentPopularGames
        : releasedGames.slice(0, 10),
    [recentPopularGames, releasedGames],
  );

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    setSearchQuery(collapseWhitespace(searchInput));
  }, [searchInput]);

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
              NP
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
                      ]);
                    }}
                    disabled={gamesLoading || upcomingLoading || trendingLoading}
                  >
                    {gamesLoading || upcomingLoading || trendingLoading
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
                  Showing {searchResults.length} related game
                  {searchResults.length === 1 ? "" : "s"}.
                </p>
              </>
            ) : (
               <p className="games-search-results__count">
                Showing all games. Enter a query and press Enter to filter.
              </p>
            )}
          </section>

          {normalizedSearchQuery ? (
            <section className="games-search-grid-section" aria-live="polite">
              {searchResults.length ? (
                <div className="games-search-grid">
                  {searchResults.slice(0, 24).map((game) => (
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
            </section>
          ) : null}

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

          <GameCarousel
            title="Top 10 of all time"
            badge="Ranked"
            games={topTenGames}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            showRank
            itemWidth={200}
            getDescription={getReleaseDescription}
          />

          <GameCarousel
            title="Trending Games"
            badge="Hot"
            games={trendingList}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            itemWidth={190}
            getDescription={getReleaseDescription}
          />

        </main>
        <SiteFooter />
      </div>

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
