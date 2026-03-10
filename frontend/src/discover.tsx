import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "./components/card";
import GameCarousel from "./components/GameCarousel";
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
import "./discover.css";
import "./games.css";

type GameItem = {
  id: number;
  name: string;
  release_date?: string;
  genre?: string;
  cover_image?: string;
  description?: string;
  nsfw?: boolean;
  is_nsfw?: boolean;
  adult?: boolean;
  age_rating?: string | number;
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  popularity?: number;
};

type SearchPageResult = {
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
};

type RecommendResponse = {
  user_id: number;
  recommended_games: number[];
  strategy?: string;
};

const QUESTIONNAIRE_STORAGE_PREFIX = "nextplay_questionnaire_v1";
const RESULT_PAGE_SIZE = 6;

const INITIAL_ROW_ITEMS = 24;
const ROW_STEP_ITEMS = 24;
const INITIAL_GENRE_ROWS = 6;
const GENRE_ROWS_STEP = 6;
const MAX_RECENT_RELEASE_BACKFILL_PAGES = 1;
const MIN_RECENT_RELEASE_WINDOW_MONTHS = 1;
const MAX_RECENT_RELEASE_WINDOW_MONTHS = 12;

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

const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);
const API_ROOT = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

const DEFAULT_RECENT_RELEASE_WINDOW_MONTHS =
  parseBoundedInt(
    import.meta.env.VITE_DISCOVER_RECENT_RELEASE_WINDOW_MONTHS,
    MIN_RECENT_RELEASE_WINDOW_MONTHS,
    MAX_RECENT_RELEASE_WINDOW_MONTHS,
  ) ?? 2;

const collapseWhitespace = (value?: string) => {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
};

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

const normalizeMediaUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
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

const recommendationScoreFromRank = (rank: number) =>
  Math.max(50, Math.round(100 - (rank - 1) * 2.5));

// This parseGenres the genre string from the API, which may be a comma-separated list, and returns the first genre for display in the carousel description.
const parseGenres = (value?: string) => {
  if (!value) return [] as string[];
  const unique = new Set<string>();
  value
    .split(/[,/|]/)
    .map((part) => collapseWhitespace(part))
    .filter(Boolean)
    .forEach((part) => unique.add(part));
  return Array.from(unique);
};

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
  value.toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();
const NORMALIZED_NSFW_TERMS = NSFW_TERMS.map((term) => normalizeFilterText(term))
  .filter(Boolean);

// A more comprehensive list of NSFW terms to check against game metadata for filtering out adult content from random carousels. This is still not perfect but should catch a wider range of explicit content based on common terminology.
const NON_BASE_CONTENT_MATCHER =
  /\b(dlc|downloadable content|expansion(?: pack)?|add[- ]?on|bonus(?: content)?|soundtrack|artbook|season pass|character pass|battle pass|starter pack|founder'?s pack|cosmetic(?: pack)?|skin(?: pack| set)?|costume(?: pack)?|outfit(?: pack)?|upgrade pack|item pack|consumable pack|limited edition|deluxe edition upgrade|ultimate edition upgrade)\b/i;

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

const isNonBaseContentGame = (game: GameItem) => {
  const metadataText = [game.name, game.genre, game.description]
    .filter(Boolean)
    .join(" ");
  return NON_BASE_CONTENT_MATCHER.test(metadataText);
};

type DiscoverCarousel = {
  title: string;
  badge: string;
  games: GameItem[];
  rowType?: "genre";
};

function DiscoverPage({ authUser }: DiscoverPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQuery = collapseWhitespace(searchParams.get("q") ?? "");
  const [searchInput, setSearchInput] = useState<string>(urlQuery);
  const [searchQuery, setSearchQuery] = useState<string>(urlQuery);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [rowSnapshots, setRowSnapshots] = useState<Record<string, number[]>>({});
  const [loadingRowTitle, setLoadingRowTitle] = useState<string | null>(null);
  const [visibleGenreRows, setVisibleGenreRows] = useState<number>(INITIAL_GENRE_ROWS);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers>(
    () => createEmptyQuestionnaireAnswers(),
  );
  const [questionnaireComplete, setQuestionnaireComplete] = useState<boolean>(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState<boolean>(false);
  const [showQuestionnaireResult, setShowQuestionnaireResult] = useState<boolean>(false);
  const [dismissedQuestionnaireBanner, setDismissedQuestionnaireBanner] = useState<boolean>(false);
  const [recommendationLoading, setRecommendationLoading] = useState<boolean>(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationStrategy, setRecommendationStrategy] = useState<string | null>(null);
  const [recommendedGames, setRecommendedGames] = useState<GameItem[]>([]);
  const [resultPage, setResultPage] = useState<number>(1);
  const avatarText = useMemo(() => getUserInitials(authUser), [authUser]);
  const authToken = authUser?.token?.trim() ?? "";
  const randomPoolFetchPromiseRef = useRef<Promise<unknown> | null>(null);
  const recentBackfillAttemptsRef = useRef<number>(0);
  const searchGridSectionRef = useRef<HTMLElement | null>(null);
  const randomLanesSectionRef = useRef<HTMLDivElement | null>(null);
  const recommendationSectionRef = useRef<HTMLDivElement | null>(null);
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
  const showQuestionnaireBanner =
    !questionnaireComplete && !dismissedQuestionnaireBanner;

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
    setSearchInput(urlQuery);
    setSearchQuery(urlQuery);
    setSearchPage(1);
  }, [urlQuery]);

  useEffect(() => {
    recentBackfillAttemptsRef.current = 0;
  }, [recentReleaseWindowMonths, normalizedSearchQuery]);

  const {
    data: searchData,
    isPending,
    isFetching,
    error,
  } = useQuery<SearchPageResult, Error>({
    queryKey: [
      "discover-search-page",
      normalizedSearchQuery,
      searchPage,
      searchPageSize,
    ] as const,
    enabled: normalizedSearchQuery.length >= 1,
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({
        q: normalizedSearchQuery,
        mode: "contains",
        limit: String(searchPageSize),
        offset: String(searchOffset),
        include_media: "1",
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
      const items = payload as GameItem[];
      return {
        items,
        hasMore: items.length === searchPageSize,
      };
    },
    staleTime: 60_000,
  });

  const cards = useMemo(() => searchData?.items ?? [], [searchData?.items]);
  const hasMoreSearchResults = Boolean(searchData?.hasMore);
  const isLiveSearching =
    (isPending || isFetching) && normalizedSearchQuery.length > 0;
  const handleSearchSubmit = useCallback(() => {
    setSearchPage(1);
    setSearchQuery(collapseWhitespace(searchInput));
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
    setSearchPage(1);
    navigate("/discover");
  }, [navigate]);

  const scrollToSection = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const getExploreDescription = useCallback((game: GameItem) => {
    const release = formatReleaseDate(game.release_date);
    return [
      release ? `Release: ${release}` : null,
      game.genre ? `Genre: ${game.genre}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }, []);
  const openGameDetail = useCallback(
    (targetId: number) => {
      navigate(`/games/${targetId}`);
    },
    [navigate],
  );

  const runQuestionnaireRecommendation = useCallback(async () => {
    if (!authUser?.id || !questionnaireComplete) {
      setRecommendedGames([]);
      setRecommendationStrategy(null);
      setRecommendationError(null);
      return false;
    }

    setRecommendationLoading(true);
    setRecommendationError(null);
    try {
      const payload = buildRecommendRequestFromQuestionnaire(authUser.id, questionnaireAnswers);
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
        fetched.filter((game): game is GameItem => {
          if (!game) return false;
          return !isNsfwGame(game) && !isNonBaseContentGame(game);
        }),
      );
      return true;
    } catch (err) {
      setRecommendedGames([]);
      setRecommendationError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setRecommendationLoading(false);
    }
  }, [authToken, authUser?.id, questionnaireAnswers, questionnaireComplete]);

  useEffect(() => {
    void runQuestionnaireRecommendation();
  }, [runQuestionnaireRecommendation]);

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

  const handleQuestionnaireSubmit = useCallback(async () => {
    if (!questionnaireComplete) return;
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
    questionnaireAnswers,
    questionnaireComplete,
    questionnaireStorageKey,
    runQuestionnaireRecommendation,
  ]);

  const handleQuestionnaireRetake = useCallback(() => {
    setShowQuestionnaireResult(false);
    setQuestionnaireOpen(true);
  }, []);

  const rankedRecommendedGames = useMemo(() => {
    if (recommendedGames.length <= 1) return recommendedGames;
    const answerSignature = Object.entries(questionnaireAnswers)
      .map(([questionId, selected]) => `${questionId}:${[...selected].sort().join(",")}`)
      .sort()
      .join("|");
    const headWindow = Math.min(4, recommendedGames.length);
    const offset = hashString(answerSignature) % headWindow;
    if (offset === 0) return recommendedGames;
    return [
      recommendedGames[offset],
      ...recommendedGames.filter((_, index) => index !== offset),
    ];
  }, [questionnaireAnswers, recommendedGames]);

  const topRecommendedGame = useMemo(
    () => rankedRecommendedGames[0] ?? null,
    [rankedRecommendedGames],
  );

  const additionalRecommendedGames = useMemo(
    () => rankedRecommendedGames.slice(1),
    [rankedRecommendedGames],
  );

  const resultTotalPages = useMemo(
    () => Math.max(1, Math.ceil(additionalRecommendedGames.length / RESULT_PAGE_SIZE)),
    [additionalRecommendedGames.length],
  );

  const currentResultPage = Math.min(resultPage, resultTotalPages);

  const pagedAdditionalRecommendations = useMemo(() => {
    const start = (currentResultPage - 1) * RESULT_PAGE_SIZE;
    return additionalRecommendedGames.slice(start, start + RESULT_PAGE_SIZE);
  }, [additionalRecommendedGames, currentResultPage]);

  const topRecommendationSummary = useMemo(() => {
    if (!topRecommendedGame) return "We couldn't load details for the top recommendation yet.";
    const source = collapseWhitespace(topRecommendedGame.description ?? "");
    if (!source) return "Open this title to view full details and see why it matches your answers.";
    return source.length > 260 ? `${source.slice(0, 260).trimEnd()}...` : source;
  }, [topRecommendedGame]);

  useEffect(() => {
    setResultPage(1);
  }, [rankedRecommendedGames]);

  const randomPoolPageSize = 120;
  const {
    data: randomPoolData,
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
        random: "1",
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
  const discoverCarousels = useMemo(() => {
    const safePool = randomPool.filter(
      (game) => !isNsfwGame(game) && !isNonBaseContentGame(game),
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
    const MARATHON_GENRE_MATCHER =
      /\b(rpg|role[- ]?playing|strategy|simulation|sim|management|city builder|4x|grand strategy|turn[- ]based|sandbox|survival|crafting|open world|adventure)\b/i;
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
          MARATHON_GENRE_MATCHER.test(metadata) &&
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
        !isNonBaseContentGame(game) &&
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
        !isNonBaseContentGame(game) &&
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
        if (isNsfwGame(game) || isNonBaseContentGame(game)) return false;
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
  }, [randomPool, recentReleaseWindowMonths]);

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

  const handlePreviousSearchPage = useCallback(() => {
    setSearchPage((current) => Math.max(1, current - 1));
  }, []);

  const handleNextSearchPage = useCallback(() => {
    setSearchPage((current) => current + 1);
  }, []);

  return (
    <div className="search-page">
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
                      {isLiveSearching
                        ? "Searching..."
                        : `Showing ${cards.length === 0 ? 0 : searchOffset + 1}-${searchOffset + cards.length} on page ${searchPage}.`}
                    </p>
                  </>
                ) : (
                  <p className="games-search-results__count">
                    Showing all games. Enter a query and press Enter to filter.
                  </p>
                )}
              </section>
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
                      onClick={() => {
                        setShowQuestionnaireResult(false);
                        setQuestionnaireOpen(true);
                      }}
                    >
                      {questionnaireComplete ? "Retake questionnaire" : "Start questionnaire"}
                    </button>
                  </>
                )}
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
                      onClick={() => {
                        setShowQuestionnaireResult(false);
                        setQuestionnaireOpen(true);
                      }}
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
                  {cards.length ? (
                    <div className="games-search-grid">
                      {cards.map((game) => (
                        <Card
                          key={`discover-search-grid-${game.id}`}
                          title={game.name || "Untitled"}
                          description={getExploreDescription(game)}
                          icon={
                            normalizeMediaUrl(game.cover_image) ? (
                              <img
                                src={normalizeMediaUrl(game.cover_image) ?? ""}
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
                  ) : (
                    <p className="games-search-grid__empty">
                      No games matched that query. Try a shorter or broader
                      term.
                    </p>
                  )}
                  {searchPage > 1 || hasMoreSearchResults ? (
                    <div className="games-pagination">
                      <button
                        type="button"
                        className="games-pagination__button"
                        onClick={handlePreviousSearchPage}
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
                        onClick={handleNextSearchPage}
                        disabled={!hasMoreSearchResults || isLiveSearching}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}
              {!normalizedSearchQuery ? (
                <div ref={randomLanesSectionRef} className="discover-random">
                  {questionnaireComplete ? (
                    recommendationLoading ? (
                      <div
                        ref={recommendationSectionRef}
                        className="games-recommendation-state"
                      >
                        Refreshing algorithm verdicts...
                      </div>
                    ) : recommendationError ? (
                      <div
                        ref={recommendationSectionRef}
                        className="games-recommendation-state games-recommendation-state--error"
                      >
                        {recommendationError}
                      </div>
                    ) : topRecommendedGame ? (
                      <section
                        ref={recommendationSectionRef}
                        className="games-home-recommendation discover-algorithm-verdict"
                        aria-label="Algorithm verdicts result"
                      >
                        <div className="games-result">
                          <header className="games-result__header">
                            <p className="games-result__eyebrow">Algorithm Verdicts Result</p>
                            <h2 className="games-result__title">
                              This ranking is generated for your profile.
                            </h2>
                          </header>

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
                                {recommendationStrategy ? (
                                  <span>{`Strategy: ${recommendationStrategy}`}</span>
                                ) : null}
                              </div>
                            </div>

                            <aside className="games-result__score">
                              <p>Score</p>
                              <div className="games-result__score-pill">
                                {`${recommendationScoreFromRank(1)}%`}
                              </div>
                            </aside>
                          </section>

                          {additionalRecommendedGames.length > 0 ? (
                            <section className="games-result__list" aria-label="Additional recommendations">
                              <div className="games-result__list-header">
                                <h3>More ranked picks</h3>
                                <p>{`Showing ${pagedAdditionalRecommendations.length} of ${additionalRecommendedGames.length}`}</p>
                              </div>
                              <div className="games-result__list-grid">
                                {pagedAdditionalRecommendations.map((game, index) => {
                                  const rank = 2 + ((currentResultPage - 1) * RESULT_PAGE_SIZE) + index;
                                  const coverUrl = normalizeMediaUrl(game.cover_image);
                                  return (
                                    <button
                                      key={`discover-result-${game.id}`}
                                      type="button"
                                      className="games-result__list-item"
                                      onClick={() => openGameDetail(game.id)}
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
                                      <span className="games-result__list-item-rank">{`#${rank}`}</span>
                                      <span className="games-result__list-item-title">{game.name || "Untitled game"}</span>
                                      <span className="games-result__list-item-meta">
                                        {formatReleaseDate(game.release_date)
                                          ? `Release: ${formatReleaseDate(game.release_date)}`
                                          : "Release: n/a"}
                                      </span>
                                      <span className="games-result__list-item-meta">
                                        {`Score: ${recommendationScoreFromRank(rank)}%`}
                                      </span>
                                      </span>
                                    </button>
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
                              Refresh ranking
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
                              onClick={() => openGameDetail(topRecommendedGame.id)}
                            >
                              Open #1 pick
                            </button>
                          </footer>
                        </div>
                      </section>
                    ) : null
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
                      getDescription={(game) => {
                        const release = formatReleaseDate(game.release_date);
                        return release ? `Release: ${release}` : "Release: n/a";
                      }}
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
                onClick={() => setQuestionnaireOpen(false)}
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
                Algorithm verdicts are ready for you.
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
                  <div className="games-result__score-pill">{`${recommendationScoreFromRank(1)}%`}</div>
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
                Continue to discover
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
