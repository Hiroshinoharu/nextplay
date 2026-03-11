import { useEffect, useMemo, useState, useCallback, useRef} from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "./components/Button";
import LikeButton from "./components/Like_Button";
import Lightbox from "./components/Lightbox";
import Navbar from "./components/Navbar";
import RateRadio from "./components/rateRadio";
import GameCarousel from "./components/GameCarousel";
import ScreenshotGallery from "./components/ScreenshotGallery";
import Searchbar from "./components/Searchbar";
import TrailerGallery from "./components/TrailerGallery";
import Loader from "./components/Loader";
import logoUrl from "./assets/logo.png";
import { getUserInitials, type AuthUser } from "./utils/authUser";
import "./game.css";
import "./games.css";
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
  popularity?: number;
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

type UserInteraction = {
  user_id: number;
  game_id: number;
  rating?: number | null;
  review?: string | null;
  liked?: boolean | null;
  favorited?: boolean | null;
  timestamp?: string | null;
};

type InteractionInput = {
  game_id: number;
  rating: number | null;
  review: string | null;
  liked: boolean | null;
  favorited: boolean | null;
};

const hasMeaningfulInteractionInput = (value: InteractionInput) =>
  (typeof value.rating === "number" && Number.isFinite(value.rating)) ||
  value.liked === true ||
  value.favorited === true ||
  Boolean(value.review?.trim());

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

const NON_BASE_CONTENT_MATCHER =
  /\b(dlc|downloadable content|expansion(?: pack)?|add[- ]?on|bonus(?: content)?|soundtrack|artbook|season pass|character pass|battle pass|starter pack|founder'?s pack|cosmetic(?: pack)?|skin(?: pack| set)?|costume(?: pack)?|outfit(?: pack)?|upgrade pack|item pack|consumable(?: pack)?|bundle|edition upgrade|currency pack|booster pack|mission pack)\b/i;

const isNonBaseContentGame = (game: GameItem) => {
  const metadataText = [game.name, game.genre, game.description, game.story]
    .filter(Boolean)
    .join(" ");
  return NON_BASE_CONTENT_MATCHER.test(metadataText);
};

const buildAssociationTokens = (gameName: string): string[] => {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "edition",
    "ultimate",
    "complete",
    "deluxe",
    "royal",
    "game",
  ]);
  const normalized = gameName
    .toLowerCase()
    .replace(/[^a-z0-9\s:]+/g, " ")
    .split(/[\s:]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
  return Array.from(new Set(normalized)).slice(0, 6);
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
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [interactionLoading, setInteractionLoading] = useState<boolean>(false);
  const [interactionSaving, setInteractionSaving] = useState<boolean>(false);
  const [reviewDraft, setReviewDraft] = useState<string>("");
  const [relatedContent, setRelatedContent] = useState<GameItem[]>([]);
  const [relatedLoading, setRelatedLoading] = useState<boolean>(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [additionalContent, setAdditionalContent] = useState<GameItem[]>([]);
  const [additionalLoading, setAdditionalLoading] = useState<boolean>(false);
  const [additionalError, setAdditionalError] = useState<string | null>(null);
  const avatarText = useMemo(() => getUserInitials(authUser), [authUser]);
  const authToken = authUser?.token?.trim() ?? "";
  const toastTimeoutRef = useRef<number | null>(null);
  const savingGuardTimeoutRef = useRef<number | null>(null);
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
        const responseValue = await fetch(gameUrl, {
          ...(signal ? { signal } : {}),
          ...(authToken
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {}),
        });
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
      if (savingGuardTimeoutRef.current !== null) {
        window.clearTimeout(savingGuardTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!interactionSaving) {
      if (savingGuardTimeoutRef.current !== null) {
        window.clearTimeout(savingGuardTimeoutRef.current);
        savingGuardTimeoutRef.current = null;
      }
      return;
    }
    if (savingGuardTimeoutRef.current !== null) {
      window.clearTimeout(savingGuardTimeoutRef.current);
    }
    savingGuardTimeoutRef.current = window.setTimeout(() => {
      setInteractionSaving(false);
      showToast("Save is taking too long. Please try again.");
      savingGuardTimeoutRef.current = null;
    }, 15000);
  }, [interactionSaving, showToast]);

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

  // Construct the user interactions API URL using the base URL and memoization, returning null if the user is not authenticated
  const userInteractionsUrl = useMemo(() => {
    if (!authUser?.id) return null;
    const trimmedBase = baseUrl.replace(/\/+$/, "");
    const root = trimmedBase.endsWith("/api")
      ? trimmedBase.slice(0, -4)
      : trimmedBase;
    return `${root}/api/users/${authUser.id}/interactions`;
  }, [authUser?.id, baseUrl]);

  // Function to save user interactions (like rating, review, etc.) to the API, with error handling and user feedback
  // This function checks for authentication, sends a POST request to save the interaction, updates local state with the new interaction data, and provides feedback to the user through toast messages. It also handles loading state to prevent multiple simultaneous saves and ensures that the review draft is updated with the latest review text.
  const saveInteraction = useCallback(
    async (next: InteractionInput, sucessMessage: string) => {
      if (!userInteractionsUrl || !authToken) {
        showToast("You must be logged in to perform this action.");
        return false;
      }

      setInteractionSaving(true);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => {
        controller.abort();
      }, 12000);
      try {
        if (!hasMeaningfulInteractionInput(next)) {
          const deleteUrl = `${userInteractionsUrl}/${next.game_id}`;
          const deleteResponse = await fetch(deleteUrl, {
            method: "DELETE",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
          if (!deleteResponse.ok && deleteResponse.status !== 404) {
            let errorData: { message?: string } | null = null;
            try {
              errorData = (await deleteResponse.json()) as { message?: string };
            } catch {
              errorData = null;
            }
            showToast(errorData?.message || "Failed to clear interaction.");
            return false;
          }
          setInteraction(null);
          setReviewDraft("");
          showToast("Interaction cleared.");
          return true;
        }
        const response = await fetch(userInteractionsUrl, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(next),
        });
        if (!response.ok) {
          let errorData: { message?: string } | null = null;
          try {
            errorData = (await response.json()) as { message?: string };
          } catch {
            errorData = null;
          }
          const errorMessage =
            errorData?.message || "Failed to save interaction.";
          showToast(errorMessage);
          return false;
        }
        const nowIso = new Date().toISOString();
        setInteraction({
          user_id: authUser?.id ?? 0,
          game_id: next.game_id,
          rating: next.rating,
          review: next.review,
          liked: next.liked,
          favorited: next.favorited,
          timestamp: nowIso,
        });
        setReviewDraft(next.review ?? "");
        showToast(sucessMessage);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error && err.name === "AbortError"
            ? "Save timed out. Please try again."
            : err instanceof Error
              ? err.message
              : "An error occurred while saving your interaction.";
        showToast(errorMessage);
        return false;
      } finally {
        window.clearTimeout(timeout);
        setInteractionSaving(false);
      }
    },
    [authUser?.id, authToken, showToast, userInteractionsUrl],
  );

  // Load the user's existing interaction for this game when the component mounts or when relevant dependencies change, with error handling and user feedback. This effect checks if the necessary parameters are available, fetches the user's interactions from the API, finds the interaction for the current game, and updates local state accordingly. It also handles loading state and provides feedback through toast messages if there are issues with loading the interaction.
  useEffect(() => {
    if (
      !userInteractionsUrl ||
      !authToken ||
      numericId === null ||
      !isValidId
    ) {
      setInteraction(null);
      setReviewDraft("");
      return;
    }

    const controller = new AbortController();

    const loadInteraction = async () => {
      setInteractionLoading(true);
      const timeout = window.setTimeout(() => {
        controller.abort();
      }, 12000);
      try {
        const response = await fetch(userInteractionsUrl, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) {
          if (response.status !== 404) {
            showToast(`Could not load interaction (${response.status}).`, 3600);
          }
          return;
        }
        const payload = (await response.json()) as UserInteraction[];
        if (!Array.isArray(payload)) return;
        const existing =
          payload.find((item) => item.game_id === numericId) ?? null;
        setInteraction(existing);
        setReviewDraft(existing?.review ?? "");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          showToast("Loading your interaction timed out.", 3600);
          return;
        }
        const errorMessage =
          err instanceof Error
            ? err.message
            : "An error occurred while loading your interaction.";
        showToast(errorMessage, 3600);
      } finally {
        window.clearTimeout(timeout);
        setInteractionLoading(false);
      }
    };
    void loadInteraction();
    return () => controller.abort();
  }, [authToken, numericId, isValidId, showToast, userInteractionsUrl]);

  const interactionUpdatedText = interaction?.timestamp
    ? String(new Date(interaction.timestamp).getTime())
    : "Not saved yet";
  const existingReview = collapseWhitespace(interaction?.review ?? "");
  const currentReview = collapseWhitespace(reviewDraft);
  const reviewCharsRemaining = 500 - reviewDraft.length;
  const reviewChanged = currentReview !== existingReview;
  const canSaveReview = reviewChanged && !interactionSaving;
  const canClearReview = (currentReview.length > 0 || existingReview.length > 0) && !interactionSaving;
  
   const interactionInput: InteractionInput | null =
    numericId === null
      ? null
      : {
          game_id: numericId,
          rating:
            typeof interaction?.rating === "number" && Number.isFinite(interaction.rating)
              ? interaction.rating
              : null,
          review: reviewDraft.trim() || null,
          liked: typeof interaction?.liked === "boolean" ? interaction.liked : null,
          favorited:
            typeof interaction?.favorited === "boolean" ? interaction.favorited : null,
        };


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

  useEffect(() => {
    if (!game?.id) {
      setRelatedContent([]);
      setRelatedError(null);
      setRelatedLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadRelated = async () => {
      setRelatedLoading(true);
      setRelatedError(null);
      try {
        const query = new URLSearchParams({
          limit: "60",
          include_media: "1",
        });
        const response = await fetch(`${API_ROOT}/api/games/${game.id}/related-content?${query.toString()}`, {
          signal: controller.signal,
          ...(authToken
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {}),
        });
        if (!response.ok) {
          setRelatedError(`Could not load franchise games (${response.status}).`);
          setRelatedContent([]);
          return;
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) {
          setRelatedError("Unexpected franchise response shape.");
          setRelatedContent([]);
          return;
        }
        setRelatedContent(payload as GameItem[]);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setRelatedError("Could not load related franchise games.");
        setRelatedContent([]);
      } finally {
        if (!controller.signal.aborted) {
          setRelatedLoading(false);
        }
      }
    };

    void loadRelated();
    return () => controller.abort();
  }, [authToken, game?.id]);

  useEffect(() => {
    if (!game?.id || !game.name?.trim()) {
      setAdditionalContent([]);
      setAdditionalError(null);
      setAdditionalLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadAdditional = async () => {
      setAdditionalLoading(true);
      setAdditionalError(null);
      try {
        const query = new URLSearchParams({
          q: game.name,
          mode: "contains",
          limit: "120",
          offset: "0",
          include_media: "1",
        });
        const response = await fetch(`${API_ROOT}/api/games/search?${query.toString()}`, {
          signal: controller.signal,
          ...(authToken
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {}),
        });
        if (!response.ok) {
          setAdditionalError(`Could not load additional content (${response.status}).`);
          setAdditionalContent([]);
          return;
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) {
          setAdditionalError("Unexpected additional content response shape.");
          setAdditionalContent([]);
          return;
        }

        const tokens = buildAssociationTokens(game.name);
        const ranked = (payload as GameItem[])
          .filter((candidate) => candidate.id !== game.id)
          .filter((candidate) => isNonBaseContentGame(candidate))
          .map((candidate) => {
            const searchable =
              `${candidate.name ?? ""} ${candidate.description ?? ""} ${candidate.story ?? ""}`.toLowerCase();
            const tokenHits = tokens.reduce(
              (sum, token) => sum + (searchable.includes(token) ? 1 : 0),
              0,
            );
            return { candidate, tokenHits };
          })
          .filter((row) => row.tokenHits > 0)
          .sort((a, b) => {
            if (b.tokenHits !== a.tokenHits) return b.tokenHits - a.tokenHits;
            return (b.candidate.popularity ?? 0) - (a.candidate.popularity ?? 0);
          })
          .map((row) => row.candidate)
          .slice(0, 36);

        setAdditionalContent(ranked);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setAdditionalError("Could not load additional content.");
        setAdditionalContent([]);
      } finally {
        if (!controller.signal.aborted) {
          setAdditionalLoading(false);
        }
      }
    };

    void loadAdditional();
    return () => controller.abort();
  }, [authToken, game?.id, game?.name]);

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
              <Loader
                title="Loading game details"
                subtitle="Fetching media, metadata, and related content..."
              />
            </div>
          )}

          {gameError && <div className="game-alert">{gameError}</div>}

          {game && !gameLoading && (
            <div className="game-grid">
              <div className="game-side">
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
                <section className="game-panel game-panel--interactions" aria-label="Your interaction">
                  <div className="game-panel__header">
                    <h2 className="game-panel__title">Your interaction</h2>
                    <span className="game-panel__meta game-panel__meta--updated">
                      Updated: {interactionUpdatedText}
                    </span>
                  </div>

                  {!authUser?.id ? (
                    <div className="game-gallery__empty">Sign in to rate, review, like, and favorite this game.</div>
                  ) : interactionLoading ? (
                    <div className="game-gallery__empty">
                      <Loader
                        title="Loading your interaction"
                        subtitle="Checking saved ratings and notes..."
                      />
                    </div>
                  ) : (
                    <div className="game-interaction">
                      <div className="game-interaction__row">
                        <span className="game-interaction__label">Rating</span>
                        <RateRadio
                          value={
                            typeof interaction?.rating === "number" &&
                            Number.isFinite(interaction.rating)
                              ? interaction.rating
                              : null
                          }
                          disabled={interactionSaving}
                          onChange={(value) => {
                            if (!interactionInput) return;
                            void saveInteraction(
                              { ...interactionInput, rating: value },
                              `Saved ${value}-star rating.`,
                            );
                          }}
                          onClear={() => {
                            if (!interactionInput) return;
                            void saveInteraction(
                              { ...interactionInput, rating: null },
                              "Rating cleared.",
                            );
                          }}
                        />
                      </div>

                      <div className="game-interaction__row">
                        <span className="game-interaction__label">Actions</span>
                        <div className="game-interaction__buttons">
                          <LikeButton
                            label={interaction?.liked === true ? "Liked" : "Like"}
                            active={interaction?.liked === true}
                            disabled={interactionSaving}
                            onClick={() => {
                              if (!interactionInput) return;
                              const likedNext = interaction?.liked === true ? null : true;
                              void saveInteraction(
                                { ...interactionInput, liked: likedNext },
                                likedNext ? "Added to liked." : "Removed from liked.",
                              );
                            }}
                          />
                          <LikeButton
                            label={interaction?.favorited === true ? "Favorited" : "Favorite"}
                            icon="star"
                            active={interaction?.favorited === true}
                            disabled={interactionSaving}
                            onClick={() => {
                              if (!interactionInput) return;
                              const favoritedNext = interaction?.favorited === true ? null : true;
                              void saveInteraction(
                                { ...interactionInput, favorited: favoritedNext },
                                favoritedNext ? "Added to favorites." : "Removed from favorites.",
                              );
                            }}
                          />
                        </div>
                      </div>

                      <div className="game-interaction__row game-interaction__row--column">
                        <label className="game-interaction__label" htmlFor="game-review">Review</label>
                        <textarea
                          id="game-review"
                          className="game-interaction__review"
                          value={reviewDraft}
                          onChange={(event) => setReviewDraft(event.target.value)}
                          placeholder="Write your quick review..."
                          maxLength={500}
                        />
                        <div className="game-interaction__review-meta">
                          <span>{reviewCharsRemaining} characters left</span>
                          {reviewChanged ? <span>Unsaved changes</span> : null}
                        </div>
                        <div className="game-interaction__buttons">
                          <button
                            type="button"
                            className="game-interaction__chip is-active"
                            onClick={() => {
                              if (!interactionInput) return;
                              void saveInteraction(
                                { ...interactionInput, review: reviewDraft.trim() || null },
                                "Review saved.",
                              );
                            }}
                            disabled={!canSaveReview}
                          >
                            {interactionSaving ? "Saving..." : "Save review"}
                          </button>
                          <button
                            type="button"
                            className="game-interaction__chip"
                            onClick={() => {
                              if (!interactionInput) return;
                              setReviewDraft("");
                              void saveInteraction(
                                { ...interactionInput, review: null },
                                "Review cleared.",
                              );
                            }}
                            disabled={!canClearReview}
                          >
                            Clear review
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
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
              </div>
            </div>
          )}

          {game && !gameLoading ? (
            <section className="game-related">
              {relatedLoading ? (
                <div className="game-gallery__empty">
                  <Loader
                    title="Loading franchise games"
                    subtitle="Finding connected titles..."
                  />
                </div>
              ) : relatedError ? (
                <div className="game-gallery__empty">{relatedError}</div>
              ) : relatedContent.length ? (
                <GameCarousel
                  title="More from this Franchise"
                  badge="Franchise"
                  games={relatedContent}
                  onSelect={(targetId) => navigate(`/games/${targetId}`)}
                  getDescription={(item) => {
                    const release = formatReleaseDate(item.release_date);
                    return release ? `Release: ${release}` : "Release: n/a";
                  }}
                  itemWidth={190}
                />
              ) : (
                <div className="game-gallery__empty">
                  No franchise games found for this title yet.
                </div>
              )}
            </section>
          ) : null}

          {game && !gameLoading ? (
            <section className="game-related">
              {additionalLoading ? (
                <div className="game-gallery__empty">
                  <Loader
                    title="Loading additional content"
                    subtitle="Gathering expansions and packs..."
                  />
                </div>
              ) : additionalError ? (
                <div className="game-gallery__empty">{additionalError}</div>
              ) : additionalContent.length ? (
                <GameCarousel
                  title="Additional Content"
                  badge="DLC / Packs"
                  games={additionalContent}
                  onSelect={(targetId) => navigate(`/games/${targetId}`)}
                  getDescription={(item) => {
                    const release = formatReleaseDate(item.release_date);
                    return release ? `Release: ${release}` : "Release: n/a";
                  }}
                  itemWidth={190}
                />
              ) : (
                <div className="game-gallery__empty">
                  No additional content found for this title yet.
                </div>
              )}
            </section>
          ) : null}

          {game && !gameLoading ? (
            <div className="game-info__actions game-bottom-actions">
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
          ) : null}
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
