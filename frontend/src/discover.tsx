import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Card from "./components/card";
import GameCarousel from "./components/GameCarousel";
import Navbar from "./components/Navbar";
import Searchbar from "./components/Searchbar";
import SiteFooter from "./components/SiteFooter";
import logoUrl from "./assets/logo.png";
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

const INITIAL_ROW_ITEMS = 24;
const ROW_STEP_ITEMS = 24;
const INITIAL_GENRE_ROWS = 6;
const GENRE_ROWS_STEP = 6;

const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);
const API_ROOT = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

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

// A more comprehensive list of NSFW terms to check against game metadata for filtering out adult content from random carousels. This is still not perfect but should catch a wider range of explicit content based on common terminology.
const NON_BASE_CONTENT_MATCHER =
  /\b(dlc|downloadable content|expansion|add[- ]?on|bonus(?: content)?|soundtrack|artbook|season pass|starter pack|founder'?s pack|cosmetic pack|additional| difficulty | skin set | limited edition| deluxe | Ssason)\b/i;

const isNsfwGame = (game: GameItem) => {
  if (game.nsfw || game.is_nsfw || game.adult) return true;
  const ageRatingText = String(game.age_rating ?? "");
  const metadataText = [game.name, game.genre, game.description, ageRatingText]
    .filter(Boolean)
    .join(" ");
  const normalizedText = normalizeFilterText(metadataText);
  return NSFW_TERMS.some((term) => normalizedText.includes(term));
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

function DiscoverPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchPage, setSearchPage] = useState<number>(1);
  const [rowSnapshots, setRowSnapshots] = useState<Record<string, number[]>>({});
  const [visibleGenreRows, setVisibleGenreRows] = useState<number>(INITIAL_GENRE_ROWS);
  const normalizedSearchQuery = collapseWhitespace(searchQuery);
  const searchPageSize = 24;
  const searchOffset = (searchPage - 1) * searchPageSize;

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
      });
      const response = await fetch(
        `${API_ROOT}/api/games/search?${query.toString()}`,
        {
          signal,
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
        { signal },
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
      .map(([genre, games]) => ({
        title: `${genre} Spotlights`,
        badge: "Genre",
        games: stableOrderBySeed(games, `discover:genre:${genre}`),
        rowType: "genre" as const,
      }))
      .filter((section) => section.games.length > 0);

    const recentHits = [...safePool]
      .filter((game) => Boolean(game.release_date))
      .sort((a, b) => {
        const left = new Date(a.release_date!).getTime();
        const right = new Date(b.release_date!).getTime();
        return right - left;
      });

    const alphabeticQueue = [...safePool]
      .filter((game) => Boolean(game.release_date))
      .sort((a, b) => {
        a.name = a.name ?? "";
        b.name = b.name ?? "";
        return a.name.localeCompare(b.name);
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
        games: recentHits,
      },
      {
        title: "A-Z Queue",
        badge: "A-Z",
        games: alphabeticQueue,
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
  }, [randomPool]);

  const discoverCarouselsByTitle = useMemo(() => {
    const map = new Map<string, DiscoverCarousel>();
    discoverCarousels.forEach((section) => {
      map.set(section.title, section);
    });
    return map;
  }, [discoverCarousels]);

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
      await fetchNextRandomPoolPage();
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
              NP
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

              {normalizedSearchQuery ? (
                <section
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
                  {cards.length > 0 &&
                  (searchPage > 1 || hasMoreSearchResults) ? (
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
                <div className="discover-random">
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
                      isLoadingMore={randomPoolLoadingMore}
                      loadMoreThreshold={420}
                      isolateRendering
                      initialVisibleItems={INITIAL_ROW_ITEMS}
                      visibleItemsStep={ROW_STEP_ITEMS}
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
    </div>
  );
}

export default DiscoverPage;
