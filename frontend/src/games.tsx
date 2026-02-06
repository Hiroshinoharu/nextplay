import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GameCarousel from "./components/GameCarousel";
import Navbar from "./components/Navbar";
import Searchbar from "./components/Searchbar";
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
  media?: GameMedia[];
};

type GameMedia = {
  media_type?: string;
  url?: string;
};

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

const formatReleaseDate = (value?: string) => {
  const parsed = parseReleaseDate(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

// Main Games component handling game list view
function Games() {
  // Router and state hooks
  const navigate = useNavigate();
  const [baseUrl] = useState<string>(API_ROOT);
  const [games, setGames] = useState<GameItem[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [gamesLoading, setGamesLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [featuredGameId, setFeaturedGameId] = useState<number | null>(null);
  const [featuredDetail, setFeaturedDetail] = useState<GameItem | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadMoreRef, setLoadMoreRef] = useState<HTMLDivElement | null>(null);
  const [supportsObserver, setSupportsObserver] = useState<boolean>(true);

  const pageSize = 200; // Number of games to fetch per page
  const maxGames = 0; // Maximum number of games to load in total

  const fetchPage = useCallback(
    async (page: number) => {
      // Ensure the base URL is properly formatted and does not have trailing slashes
      const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
      const root = trimmedBaseUrl.endsWith("/api")
        ? trimmedBaseUrl.slice(0, -4)
        : trimmedBaseUrl;
      const offset = (page - 1) * pageSize;
      console.debug(`Fetching games from: ${root}/api/games?limit=${pageSize}&offset=${offset}`);
      const url = `${root}/api/games?limit=${pageSize}&offset=${offset}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid API response: expected an array of games");
      }
      return data as GameItem[];
    },
    [baseUrl, pageSize],
  );

  const loadGames = useCallback(async () => {
    setGamesLoading(true);
    setGamesError(null);
    try {
      let page = 1;
      let accumulated: GameItem[] = [];
      // Fetch all pages up front until the API indicates no more results.
      while (true) {
        const data = await fetchPage(page);
        if (page === 1) {
          accumulated = dedupeGames(data);
        } else {
          const before = accumulated.length;
          accumulated = mergeUniqueGames(accumulated, data);
          if (accumulated.length === before) break;
        }
        if (maxGames > 0 && accumulated.length >= maxGames) {
          accumulated = accumulated.slice(0, maxGames);
          break;
        }
        if (data.length < pageSize) break;
        page += 1;
      }
      setGames(accumulated);
      setCurrentPage(page);
      setHasMore(false);
    } catch (error: unknown) {
      setGamesError(
        error instanceof Error ? error.message : "Failed to load games",
      );
    } finally {
      setGamesLoading(false);
    }
  }, [fetchPage, pageSize]);

  const loadMoreGames = useCallback(async () => {
    if (isLoadingMore || gamesLoading || !hasMore) return;
    setIsLoadingMore(true);
    setGamesError(null);
    const nextPage = currentPage + 1;
    try {
      const data = await fetchPage(nextPage);
      if (data.length === 0) {
        setHasMore(false);
        return;
      }
      setGames((prev) => mergeUniqueGames(prev, data));
      setCurrentPage(nextPage);
      setHasMore(data.length === pageSize);
    } catch (error: unknown) {
      setGamesError(
        error instanceof Error ? error.message : "Failed to load games",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, fetchPage, gamesLoading, hasMore, isLoadingMore, pageSize]);
  
  useEffect(() => {
    // Load the list of games when the gamesUrl changes
    loadGames();
  }, [loadGames]);

  useEffect(() => {
    setSupportsObserver(typeof window !== "undefined" && "IntersectionObserver" in window);
  }, []);

  useEffect(() => {
    if (!supportsObserver) return;
    if (!loadMoreRef || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting) return;
        loadMoreGames();
      },
      { rootMargin: "200px" },
    );
    observer.observe(loadMoreRef);
    return () => observer.disconnect();
  }, [hasMore, loadMoreGames, loadMoreRef, supportsObserver]);

  useEffect(() => {
    const message = gamesError;
    if (!message) return;
    setToastMessage(message);
    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [gamesError]);

  const openGameDetail = (targetId: number) => {
    navigate(`/games/${targetId}`);
  };

  const featuredCandidates = useMemo(() => {
    const withReleaseDates = games.filter((game) =>
      Boolean(parseReleaseDate(game.release_date)),
    );
    return withReleaseDates.length ? withReleaseDates : games;
  }, [games]);

  useEffect(() => {
    // Scroll to top when the featured game changes
    if (!featuredCandidates.length) {
      setFeaturedGameId(null);
      setFeaturedDetail(null);
      return;
    }

    setFeaturedGameId((prevId) => {
      if (prevId && featuredCandidates.some((game) => game.id === prevId)) {
        return prevId;
      }
      const randomIndex = Math.floor(Math.random() * featuredCandidates.length);
      return featuredCandidates[randomIndex].id ?? null;
    });
  }, [featuredCandidates]);

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

  const featuredCover = normalizeMediaUrl(
    heroGame?.cover_image ?? undefined,
  );
  const featuredMedia = Array.isArray(heroGame?.media)
    ? heroGame?.media
    : [];
  const featuredMediaItems = featuredMedia
    .filter(
      (item) =>
        item.media_type === "screenshot" || item.media_type === "artwork",
    )
    .map((item) => ({
      type: item.media_type ?? "screenshot",
      url: normalizeMediaUrl(item.url),
    }))
    .filter((item): item is { type: string; url: string } => Boolean(item.url));
  const heroMediaUrl =
    featuredMediaItems.find((item) => item.type === "artwork")?.url ??
    featuredMediaItems[0]?.url ??
    upgradeIgdbSize(featuredCover, "t_1080p");
  const featuredScreenshots = featuredMediaItems.length
    ? featuredMediaItems.map((item) => item.url)
    : (heroGame?.screenshots ?? [])
        .map((screenshot) => normalizeMediaUrl(screenshot))
        .filter((screenshot): screenshot is string => Boolean(screenshot));
  const carouselCover = (game: GameItem) => normalizeMediaUrl(game.cover_image);

  // Filter upcoming games based on release date
  const upcomingGames = useMemo(() => {
    const now = new Date();
    return games
      .filter((game) => {
        const date = parseReleaseDate(game.release_date);
        return Boolean(date && date > now);
      })
      .sort((a, b) => {
        const dateA = parseReleaseDate(a.release_date);
        const dateB = parseReleaseDate(b.release_date);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      });
  }, [games]);

  // Prepare game lists for carousels
  const topTenGames = games.slice(0, 10);
  const discoveryGames = games.slice(10, 20);
  const upcomingList = upcomingGames;
  
  const discoveryList = discoveryGames.length
    ? discoveryGames
    : games.slice(0, 10);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const showPrevShot = useCallback(() => {
    if (!featuredScreenshots.length) return;
    setLightboxIndex((current) => {
      if (current === null) return 0;
      return (
        (current - 1 + featuredScreenshots.length) % featuredScreenshots.length
      );
    });
  }, [featuredScreenshots.length]);

  const showNextShot = useCallback(() => {
    if (!featuredScreenshots.length) return;
    setLightboxIndex((current) => {
      if (current === null) return 0;
      return (current + 1) % featuredScreenshots.length;
    });
  }, [featuredScreenshots.length]);

  // Keyboard navigation for lightbox controls
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevShot();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextShot();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeLightbox, lightboxIndex, showNextShot, showPrevShot]);

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
            <Searchbar />
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
              />
            ) : null}
            <div className="games-hero__shade" />
          </div>
          <div className="games-hero__content">
            {heroGame ? (
              <>
                <p className="games-hero__eyebrow">Featured today</p>
                <h1 className="games-hero__title">{heroGame.name}</h1>
                <p className="games-hero__desc">
                  {heroGame.description ||
                    "A fresh pick from your library."}
                </p>
                <div className="games-hero__meta">
                  <span>{heroGame.genre ?? "Genre: n/a"}</span>
                  <span>{heroGame.publishers ?? "Publisher: n/a"}</span>
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
                    onClick={loadGames}
                    disabled={gamesLoading}
                  >
                    {gamesLoading ? "Refreshing..." : "Refresh list"}
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

          <GameCarousel
            title="Upcoming Games"
            badge="Preview"
            games={upcomingList}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            itemWidth={190}
            getDescription={(game) =>
              formatReleaseDate(game.release_date)
                ? `Release: ${formatReleaseDate(game.release_date)}`
                : "Release: n/a"
            }
          />

          <GameCarousel
            title="Top Rated Games"
            badge="Popular"
            games={topTenGames}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            itemWidth={200}
            getDescription={(game) =>
              game.genre ? `Genre: ${game.genre}` : "Genre: n/a"
            }
          />

          <GameCarousel
            title="Top 10 of all time"
            badge="Ranked"
            games={topTenGames}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            showRank
            itemWidth={200}
            getDescription={(game) =>
              game.genre ? `Genre: ${game.genre}` : "Genre: n/a"
            }
          />

          <GameCarousel
            title="Explore more"
            badge="Discover"
            games={discoveryList}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            itemWidth={190}
            getDescription={(game) =>
              [
                formatReleaseDate(game.release_date)
                  ? `Release: ${formatReleaseDate(game.release_date)}`
                  : null,
                game.genre ? `Genre: ${game.genre}` : null,
              ]
                .filter(Boolean)
                .join("\n")
            }
          />

          <GameCarousel
            title="RPG Games"
            badge="Genre"
            games={games.filter((game) => game.genre?.toLowerCase().includes("rpg"))}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            itemWidth={190}
            getDescription = {(game) =>
              formatReleaseDate(game.release_date)
                ? `Release: ${formatReleaseDate(game.release_date)}`
                : "Release: n/a"
            }
          />

          <GameCarousel
            title="Strategy Games"
            badge="Genre"
            games={games.filter((game) => game.genre?.toLowerCase().includes("strategy"))}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            itemWidth={190}
            getDescription = {(game) =>
              formatReleaseDate(game.release_date)
                ? `Release: ${formatReleaseDate(game.release_date)}`
                : "Release: n/a"
            }
          />

          <section className="games-section">
            <div className="games-section__header">
              <h2 className="games-section__title">All games</h2>
              <span className="games-section__badge">
                {games.length ? `${games.length} loaded` : "All games"}
              </span>
            </div>
            <GameCarousel
              title="All games"
              games={games}
              onSelect={openGameDetail}
              getCoverUrl={carouselCover}
              itemWidth={190}
              showHeader={false}
              getDescription={(game) =>
                game.release_date
                  ? `Release: ${formatReleaseDate(game.release_date)}`
                  : "Release: TBA"
              }
            />
            <div className="games-load-more" ref={setLoadMoreRef}>
              {hasMore ? (
                supportsObserver ? (
                  <span className="games-pagination__status">
                    {isLoadingMore || gamesLoading ? "Loading more..." : "Scroll to load more"}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="games-pagination__button"
                    onClick={loadMoreGames}
                    disabled={isLoadingMore || gamesLoading}
                  >
                    {isLoadingMore || gamesLoading ? "Loading..." : "Load more"}
                  </button>
                )
              ) : (
                <span className="games-pagination__status">All games loaded</span>
              )}
            </div>
          </section>
        </main>
        <footer className="landing__footer">
          <div className="landing__footer-grid">
            <div className="landing__footer-brand">
              <div className="landing__logo">
                <img src={logoUrl} alt="NextPlay Logo" width={56} height={56} />
                <span>NextPlay</span>
              </div>
              <p>
                Find your next obsession with curated picks, social play, and
                smart recommendations.
              </p>
            </div>
            <div className="landing__footer-section">
              <h4>Product</h4>
              <ul>
                <li>Discover</li>
                <li>Collections</li>
                <li>Party Finder</li>
                <li>Wishlist</li>
              </ul>
            </div>
            <div className="landing__footer-section">
              <h4>Company</h4>
              <ul>
                <li>About</li>
                <li>Careers</li>
                <li>Press</li>
                <li>Contact</li>
              </ul>
            </div>
            <div className="landing__footer-section">
              <h4>Resources</h4>
              <ul>
                <li>Help Center</li>
                <li>Community</li>
                <li>Developers</li>
                <li>Status</li>
              </ul>
            </div>
            <div className="landing__footer-section">
              <h4>Stay in the loop</h4>
              <p>Weekly drops, co-op nights, and hot releases.</p>
              <div className="landing__footer-form">
                <input
                  type="email"
                  placeholder="you@email.com"
                  aria-label="Email address"
                />
                <button type="button">Subscribe</button>
              </div>
            </div>
          </div>
          <div className="landing__footer-bottom">
            <span>© 2026 NextPlay. All rights reserved.</span>
            <div className="landing__footer-links">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Cookies</span>
            </div>
          </div>
        </footer>
      </div>

      {toastMessage && <div className="games-toast">{toastMessage}</div>}
      {lightboxIndex !== null && featuredScreenshots.length ? (
        <div className="games-lightbox" onClick={closeLightbox}>
          <div
            className="games-lightbox__dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="games-lightbox__close"
              onClick={closeLightbox}
              aria-label="Close screenshots"
            >
              Close
            </button>
            <button
              type="button"
              className="games-lightbox__nav games-lightbox__nav--prev"
              onClick={showPrevShot}
              aria-label="Previous screenshot"
            >
              Prev
            </button>
            <img
              src={featuredScreenshots[lightboxIndex]}
              alt={`Screenshot ${lightboxIndex + 1} of ${featuredGame?.name}`}
              className="games-lightbox__image"
            />
            <button
              type="button"
              className="games-lightbox__nav games-lightbox__nav--next"
              onClick={showNextShot}
              aria-label="Next screenshot"
            >
              Next
            </button>
            <div className="games-lightbox__caption">
              Screenshot {lightboxIndex + 1} of {featuredScreenshots.length}
            </div>
          </div>
        </div>
      ) : null}
    </div>
    
  );
}

export default Games;
