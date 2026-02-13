import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "./components/Button";
import Lightbox from "./components/Lightbox";
import Navbar from "./components/Navbar";
import ScreenshotGallery from "./components/ScreenshotGallery";
import Searchbar from "./components/Searchbar";
import TrailerGallery from "./components/TrailerGallery";
import logoUrl from "./assets/logo.png";
import { getUserInitials, type AuthUser } from "./utils/authUser";
import "./game.css";
import SiteFooter from "./components/SiteFooter";

// Define the structure of a game item based on expected API response fields
type GameItem = {
  id: number;
  igdb_id?: number;
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
  platform_names?: string[];
};

// Define the structure of game media items based on expected API response fields
type GameMedia = {
  igdb_id?: number;
  media_type?: string;
  url?: string;
  sort_order?: number;
};

// Define the props for the Game component
type GameProps = {
  authUser: AuthUser | null;
};

// Determine the default base URL for the API from environment variables
const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);
const API_ROOT = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

// Normalize cover image URLs to ensure they are absolute and use HTTPS
const normalizeCoverUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
};

// Parse release date strings into Date objects, returning null for invalid or missing dates
const parseReleaseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

// Format release dates into a human-readable string format, returning 'n/a' for invalid or missing dates
const formatReleaseDate = (value?: string) => {
  const parsed = parseReleaseDate(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

// Utility function to collapse multiple whitespace characters into a single space and trim the result
const collapseWhitespace = (value?: string) => {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
};

// Utility function to truncate text to a specified maximum length, adding an ellipsis if truncation occurs
const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
};

// Format comma-separated text fields (like genre or publishers) for display, handling edge cases and providing a fallback
const formatCommaSeparatedText = (value?: string) => {
  if (!value) return "n/a";
  const parts = value
    .split(",")
    .map((part) => collapseWhitespace(part))
    .filter(Boolean);
  const normalized = parts.length
    ? parts.join(", ")
    : collapseWhitespace(value);
  if (!normalized) return "n/a";
  return normalized;
};

// Main Game component handling individual game detail view
function Game({ authUser }: GameProps) {
  // Sets a navigation hook and state variables
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [baseUrl] = useState<string>(API_ROOT);
  const [game, setGame] = useState<GameItem | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const [gameLoading, setGameLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState<string>("");
  const avatarText = useMemo(() => getUserInitials(authUser), [authUser]);
  const authToken = authUser?.token?.trim() ?? "";
  const toastTimeoutRef = useRef<number | null>(null);
  const screenshotsSectionRef = useRef<HTMLElement | null>(null);
  const trailerSectionRef = useRef<HTMLElement | null>(null);

  // Validate and parse the game ID from URL parameters
  const numericId = gameId ? Number(gameId) : null;
  const isValidId = numericId !== null && !Number.isNaN(numericId);

  // Construct the game detail API URL using the base URL and memoization
  const gameUrl = useMemo(() => {
    if (!isValidId || numericId === null) return null;
    const trimmedBase = baseUrl.replace(/\/+$/, "");
    const root = trimmedBase.endsWith("/api")
      ? trimmedBase.slice(0, -4)
      : trimmedBase;
    return `${root}/api/games/${numericId}`;
  }, [baseUrl, isValidId, numericId]);

  // Function to load the game details from the API
  const loadGame = useCallback(
    async (signal?: AbortSignal) => {
      if (!gameUrl) {
        setGame(null);
        setGameError(gameId ? "Invalid game id." : "Missing game id.");
        return;
      }
      setGameLoading(true);
      setGameError(null);
      try {
        const responseValue = await fetch(
          gameUrl,
          {
            ...(signal ? { signal } : {}),
            ...(authToken
              ? { headers: { Authorization: `Bearer ${authToken}` } }
              : {}),
          },
        );
        if (!responseValue.ok) {
          setGameError(`Failed to load game: ${responseValue.status}`);
          return;
        }
        const data = (await responseValue.json()) as GameItem;
        setGame(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setGameError(`${err}`);
      } finally {
        if (!signal?.aborted) {
          setGameLoading(false);
        }
      }
    },
    [authToken, gameUrl, gameId],
  );

  // Load game details when the component mounts or when gameUrl/gameId changes
  useEffect(() => {
    const controller = new AbortController();
    loadGame(controller.signal);
    return () => controller.abort();
  }, [loadGame]);

  const showToast = useCallback((message: string, duration = 3200) => {
    setToastMessage(message);
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    if (!gameError) return;
    showToast(gameError, 4500);
  }, [gameError, showToast]);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    },
    [],
  );

  const closeGameDetail = () => {
    navigate("/discover");
  };

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const query = collapseWhitespace(searchInput);
    if (!query) {
      navigate("/discover");
      return;
    }
    const params = new URLSearchParams({ q: query });
    navigate(`/discover?${params.toString()}`);
  }, [navigate, searchInput]);

  // Function to smoothly scroll to a specific section of the page, with feedback if the section is unavailable
  const scrollToSection = useCallback(
    (section: HTMLElement | null, sectionLabel: string) => {
      if (!section) {
        showToast(`${sectionLabel} are not available yet.`, 2800);
        return;
      }
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [showToast],
  );

  // Function to copy the current page URL to the clipboard with user feedback
  const copyPageLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Game link copied to clipboard.");
    } catch {
      showToast("Could not copy link in this browser.");
    }
  }, [showToast]);

  // Prepare media items for display
  const mediaItems = Array.isArray(game?.media) ? game?.media : [];
  const mediaShots = mediaItems
    .filter(
      (item) =>
        item.media_type === "screenshot" || item.media_type === "artwork",
    )
    .map((item) => normalizeCoverUrl(item.url))
    .filter(Boolean) as string[];
  const trailerFromMedia = mediaItems
    .filter((item) => item.media_type === "trailer")
    .map((item) => item.url?.trim())
    .filter((value): value is string => Boolean(value));

  const detailCover = normalizeCoverUrl(game?.cover_image ?? undefined);
  const trailerUrls = Array.from(
    new Set(
      [game?.trailer_url, ...(game?.trailers ?? []), ...trailerFromMedia]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const screenshots = game?.screenshots
    ?.map(normalizeCoverUrl)
    .filter(Boolean) as string[] | undefined;
  const mediaGallery =
    screenshots && screenshots.length
      ? screenshots
      : mediaShots.length
        ? mediaShots
        : detailCover
          ? [detailCover]
          : [];
  const detailTitle = collapseWhitespace(game?.name) || "Untitled game";
  const detailDescriptionSource = collapseWhitespace(
    game?.description || game?.story,
  );
  const detailDescription = detailDescriptionSource
    ? truncateText(detailDescriptionSource, 1000)
    : "No description available yet.";
  const genreText = formatCommaSeparatedText(game?.genre);
  const publisherText = formatCommaSeparatedText(game?.publishers);
  const platformsTextFull = (game?.platform_names ?? [])
    .map((name) => collapseWhitespace(name))
    .filter(Boolean)
    .join(", ");
  const platformsText = platformsTextFull || "n/a";

  return (
    <div className="game-page">
      <div className="game-shell">
        <header className="game-header">
          <button
            type="button"
            className="game-brand"
            onClick={() => navigate("/")}
          >
            <img src={logoUrl} alt="NextPlay Logo" />
            <span className="game-brand__text">
              <span className="game-brand__title">NextPlay</span>
              <span className="game-brand__subtitle">Game Detail</span>
            </span>
          </button>
          <nav className="game-nav" aria-label="Primary">
            <Navbar />
          </nav>
          <div className="game-actions">
            <Searchbar
              value={searchInput}
              onValueChange={setSearchInput}
              onSubmit={handleSearchSubmit}
            />
            <button
              type="button"
              className="game-avatar"
              aria-label="Account menu"
              onClick={() => navigate("/user")}
            >
              {avatarText}
            </button>
          </div>
        </header>

        <main className="game-content">
          {gameLoading && (
            <div className="game-panel game-panel--loading">
              Loading game details...
            </div>
          )}

          {gameError && <div className="game-alert">{gameError}</div>}

          {game && !gameLoading && (
            <div className="game-grid">
              {detailCover ? (
                <div className="game-cover">
                  <img
                    src={detailCover}
                    alt={game.name || "Game cover"}
                    className="game-cover__image"
                    loading="eager"
                  />
                </div>
              ) : (
                <div className="game-cover">
                  <div className="game-cover__placeholder">
                    No cover available
                  </div>
                </div>
              )}
              <div className="game-info">
                <div className="game-info__header">
                  <p className="game-info__eyebrow">Selected game</p>
                  <h1 className="game-info__title" title={detailTitle}>
                    {detailTitle}
                  </h1>
                </div>
                <p
                  className="game-info__description"
                  title={detailDescriptionSource || undefined}
                >
                  {detailDescription}
                </p>
                <div className="game-info__stats">
                  <div className="game-stat">
                    <span className="game-stat__label">Genre</span>
                    <span
                      className="game-stat__value game-stat__value--wrap"
                      title={genreText !== "n/a" ? genreText : undefined}
                    >
                      {genreText}
                    </span>
                  </div>
                  <div className="game-stat">
                    <span className="game-stat__label">Publisher</span>
                    <span
                      className="game-stat__value game-stat__value--wrap"
                      title={
                        publisherText !== "n/a" ? publisherText : undefined
                      }
                    >
                      {publisherText}
                    </span>
                  </div>
                  <div className="game-stat">
                    <span className="game-stat__label">Release</span>
                    <span className="game-stat__value">
                      {formatReleaseDate(game.release_date) ?? "n/a"}
                    </span>
                  </div>
                  <div className="game-stat">
                    <span className="game-stat__label">Platforms</span>
                    <span
                      className="game-stat__value game-stat__value--wrap"
                      title={platformsTextFull || undefined}
                    >
                      {platformsText}
                    </span>
                  </div>
                </div>
                <div
                  className="game-quick-actions"
                  aria-label="Game quick actions"
                >
                  <button
                    type="button"
                    className="game-quick-actions__button"
                    onClick={() =>
                      scrollToSection(
                        screenshotsSectionRef.current,
                        "Screenshots",
                      )
                    }
                  >
                    Jump to screenshots
                  </button>
                  <button
                    type="button"
                    className="game-quick-actions__button"
                    onClick={() =>
                      scrollToSection(trailerSectionRef.current, "Trailers")
                    }
                  >
                    Jump to trailers
                  </button>
                  <button
                    type="button"
                    className="game-quick-actions__button"
                    onClick={() => void copyPageLink()}
                  >
                    Copy page link
                  </button>
                </div>
                <section className="game-panel" ref={screenshotsSectionRef}>
                  <div className="game-panel__header">
                    <h2 className="game-panel__title">Screenshots</h2>
                    <span className="game-panel__meta">
                      {mediaGallery.length
                        ? `${mediaGallery.length} shots`
                        : "No shots"}
                    </span>
                  </div>
                  {mediaGallery.length ? (
                    <ScreenshotGallery
                      screenshots={mediaGallery}
                      gameName={game.name}
                      onOpen={setLightboxIndex}
                    />
                  ) : (
                    <div className="game-gallery__empty">
                      No screenshots available yet.
                    </div>
                  )}
                </section>
                <section className="game-panel" ref={trailerSectionRef}>
                  <div className="game-panel__header">
                    <h2 className="game-panel__title">Trailers</h2>
                    <span className="game-panel__meta">
                      {trailerUrls.length
                        ? `${trailerUrls.length} available`
                        : "No trailers"}
                    </span>
                  </div>
                  {trailerUrls.length ? (
                    <TrailerGallery
                      trailers={trailerUrls}
                      gameName={game.name}
                    />
                  ) : (
                    <div className="game-gallery__empty">
                      Trailer links are not available yet.
                    </div>
                  )}
                </section>
                <div className="game-info__actions">
                  <Button
                    label="Back to Discover"
                    showIcon={false}
                    onClick={closeGameDetail}
                  />
                  <Button
                    label="Back to Games"
                    showIcon={false}
                    onClick={() => navigate("/games")}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
        <SiteFooter />
      </div>

      {toastMessage && <div className="game-toast">{toastMessage}</div>}
      <Lightbox
        images={mediaGallery}
        activeIndex={lightboxIndex}
        onChangeIndex={setLightboxIndex}
        onClose={closeLightbox}
        altContext={game?.name ?? "game"}
      />
    </div>
  );
}

export default Game;
