import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

// Main Games component handling game list view
function Games() {
  // Router and state hooks
  const navigate = useNavigate();
  const [baseUrl] = useState<string>(API_ROOT);
  const [games, setGames] = useState<GameItem[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [gamesLoading, setGamesLoading] = useState<boolean>(false);
  const [gamesLoadingMore, setGamesLoadingMore] = useState<boolean>(false);
  const [hasMoreGames, setHasMoreGames] = useState<boolean>(true);
  const [nextPage, setNextPage] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [featuredGameId, setFeaturedGameId] = useState<number | null>(null);
  const [featuredDetail, setFeaturedDetail] = useState<GameItem | null>(null);
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
      console.debug(
        `Fetching games from: ${root}/api/games?limit=${pageSize}&offset=${offset}`,
      );
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

  const loadGamesPage = useCallback(
    async (page: number, mode: "replace" | "append") => {
      if (mode === "replace") {
        setGamesLoading(true);
      } else {
        setGamesLoadingMore(true);
      }
      setGamesError(null);
      try {
        const data = await fetchPage(page);
        setGames((previous) => {
          const merged =
            mode === "replace"
              ? dedupeGames(data)
              : mergeUniqueGames(previous, dedupeGames(data));
          const capped = maxGames > 0 ? merged.slice(0, maxGames) : merged;
          const reachedCap = maxGames > 0 && merged.length >= maxGames;
          setHasMoreGames(!reachedCap && data.length === pageSize);
          setNextPage(page + 1);
          return capped;
        });
      } catch (error: unknown) {
        setGamesError(
          error instanceof Error
            ? error.message
            : "An unknown error occurred while loading games.",
        );
      } finally {
        if (mode === "replace") {
          setGamesLoading(false);
        } else {
          setGamesLoadingMore(false);
        }
      }
    },
    [fetchPage, maxGames, pageSize],
  );

  const loadMoreGames = useCallback(async () => {
    if (!hasMoreGames || gamesLoadingMore || gamesLoading) return;
    await loadGamesPage(nextPage, "append");
  }, [hasMoreGames, gamesLoadingMore, gamesLoading, loadGamesPage, nextPage]);

  useEffect(() => {
    // Load the list of games when the gamesUrl changes
    loadGamesPage(1, "replace");
  }, [loadGamesPage]);

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

  const featuredCover = normalizeMediaUrl(heroGame?.cover_image ?? undefined);
  const featuredMedia = Array.isArray(heroGame?.media) ? heroGame?.media : [];
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
              <img src={heroMediaUrl} alt={heroGame?.name || "Featured game"} />
            ) : null}
            <div className="games-hero__shade" />
          </div>
          <div className="games-hero__content">
            {heroGame ? (
              <>
                <p className="games-hero__eyebrow">Featured today</p>
                <h1 className="games-hero__title">{heroGame.name}</h1>
                <p className="games-hero__desc">
                  {heroGame.description || "A fresh pick from your library."}
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
                    onClick={() => void loadGamesPage(1, "replace")}
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

          <div className="games-pagination" aria-live="polite">
            <button
              className="games-pagination__button"
              type="button"
              onClick={loadMoreGames}
              disabled={!hasMoreGames || gamesLoadingMore || gamesLoading}
            >
              {gamesLoadingMore
                ? "Loading more..."
                : hasMoreGames
                  ? `Load more (${nextPage})`
                  : "No more games"}
            </button>
          </div>
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
