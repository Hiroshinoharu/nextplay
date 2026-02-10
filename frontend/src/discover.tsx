import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
};

type SearchPageResult = {
  items: GameItem[];
  hasMore: boolean;
};

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

const normalizeMediaUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
};

const shuffleGames = (items: GameItem[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

function DiscoverPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchPage, setSearchPage] = useState<number>(1);
  const normalizedSearchQuery = collapseWhitespace(searchQuery);
  const searchPageSize = 24;
  const searchOffset = (searchPage - 1) * searchPageSize;

  const { data: searchData, isPending, isFetching, error } = useQuery<SearchPageResult, Error>({
    queryKey: ["discover-search-page", normalizedSearchQuery, searchPage, searchPageSize] as const,
    enabled: normalizedSearchQuery.length >= 1,
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({
        q: normalizedSearchQuery,
        mode: "contains",
        limit: String(searchPageSize),
        offset: String(searchOffset),
        include_media: "1",
      });
      const response = await fetch(`${API_ROOT}/api/games/search?${query.toString()}`, {
        signal,
      });
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
  const isLiveSearching = (isPending || isFetching) && normalizedSearchQuery.length > 0;
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

  const { data: randomPool = [] } = useQuery<GameItem[], Error>({
    queryKey: ["discover-random-pool"] as const,
    queryFn: async ({ signal }) => {
      const query = new URLSearchParams({
        limit: "0",
        include_media: "1",
      });
      const response = await fetch(`${API_ROOT}/api/games?${query.toString()}`, { signal });
      if (!response.ok) {
        throw new Error(`Random feed failed (${response.status})`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Unexpected random feed response shape");
      }
      return payload as GameItem[];
    },
    staleTime: 5 * 60_000,
  });

  const randomCarousels = useMemo(() => {
    if (!randomPool.length) return [] as Array<{ title: string; badge: string; games: GameItem[] }>;
    const shuffled = shuffleGames(randomPool);
    const defs = [
      { title: "Random Picks", badge: "Shuffle" },
      { title: "Hidden Gems", badge: "Mix" },
      { title: "Wildcard Queue", badge: "Lucky" },
      { title: "Tonight's Roulette", badge: "Spin" },
      { title: "Unplanned Marathon", badge: "Chaos" },
    ];
    const pageSize = 20;
    return defs
      .map((def, index) => {
        const start = index * pageSize;
        const games = shuffled.slice(start, start + pageSize);
        return { ...def, games };
      })
      .filter((section) => section.games.length > 0);
  }, [randomPool]);

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
            <section className="search-results search-results--full" aria-live="polite">
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
                <section className="games-search-grid-section" aria-live="polite">
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
                      No games matched that query. Try a shorter or broader term.
                    </p>
                  )}
                  {cards.length > 0 && (searchPage > 1 || hasMoreSearchResults) ? (
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
                  {randomCarousels.map((section) => (
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
                    />
                  ))}
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
