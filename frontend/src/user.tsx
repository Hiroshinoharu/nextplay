import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Card from "./components/card";
import FilterRadio from "./components/filterRadio";
import Navbar from "./components/Navbar";
import Searchbar from "./components/Searchbar";
import SiteFooter from "./components/SiteFooter";
import logoUrl from "./assets/logo.png";
import { getUserDisplayName, getUserInitials, type AuthUser } from "./utils/authUser";
import "./user.css";

// Define the props for the UserPage component
type UserPageProps = {
  authUser: AuthUser | null;
  onSignOut: () => void;
};

// Define the structure of a user interaction item based on expected API response fields
type UserInteraction = {
  user_id: number;
  game_id: number;
  rating?: number | null;
  review?: string | null;
  liked?: boolean | null;
  favorited?: boolean | null;
  timestamp?: string | null;
};

type GameItem = {
  id: number;
  name: string;
  cover_image?: string;
  genre?: string;
  release_date?: string;
};

type ListFilter = "all" | "liked" | "favorited" | "rated" | "reviewed";

const hasMeaningfulInteraction = (item: UserInteraction) =>
  (typeof item.rating === "number" && Number.isFinite(item.rating)) ||
  item.liked === true ||
  item.favorited === true ||
  Boolean(item.review?.trim());

// Base URL for API requests, ensuring no trailing slash
const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
const API_ROOT = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

const normalizeCoverUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  return url;
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

  // Main component for the user account page, displaying user info and interactions
const UserPage = ({ authUser, onSignOut }: UserPageProps) => {
  // Hook for programmatic navigation
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsError, setInteractionsError] = useState<string | null>(null);
  const [gamesById, setGamesById] = useState<Record<number, GameItem>>({});
  const [gamesLoading, setGamesLoading] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const authToken = authUser?.token?.trim() ?? "";

  const userDisplayName = getUserDisplayName(authUser);
  const avatarText = getUserInitials(authUser);

  useEffect(() => {
    if (!authUser?.id) {
      setInteractions([]);
      setInteractionsError("User id is missing for interaction lookup.");
      return;
    }

    const controller = new AbortController();

    const loadInteractions = async () => {
      setInteractionsLoading(true);
      setInteractionsError(null);
      try {
        const response = await fetch(
          `${API_ROOT}/api/users/${authUser.id}/interactions`,
          {
            signal: controller.signal,
            ...(authToken
              ? { headers: { Authorization: `Bearer ${authToken}` } }
              : {}),
          },
        );
        if (!response.ok) {
          setInteractionsError(`Failed to load interactions: ${response.status}`);
          return;
        }
        const payload = (await response.json()) as UserInteraction[];
        if (!Array.isArray(payload)) {
          setInteractionsError("Unexpected interactions response.");
          return;
        }
        const sorted = [...payload]
          .filter(hasMeaningfulInteraction)
          .sort((a, b) => {
          const left = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const right = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return right - left;
        });
        setInteractions(sorted);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setInteractionsError(`${err}`);
      } finally {
        if (!controller.signal.aborted) {
          setInteractionsLoading(false);
        }
      }
    };

    void loadInteractions();
    return () => controller.abort();
  }, [authToken, authUser?.id]);

  // Effect to load game details for all games that the user has interacted with, based on the interactions data. This ensures that we can display relevant game information alongside each interaction in the user's list.
  useEffect(() => {
    const gameIds = Array.from(
      new Set(
        interactions
          .map((item) => item.game_id)
          .filter((gameId) => Number.isFinite(gameId) && gameId > 0),
      ),
    );

    if (!gameIds.length) {
      setGamesById({});
      setGamesLoading(false);
      return;
    }

    // Using Promise.all to fetch details for all games in parallel, while also handling potential errors and ensuring that the component's state is updated appropriately based on the success or failure of these requests.
    const controller = new AbortController();
    const loadGames = async () => {
      setGamesLoading(true);
      try {
        const responses = await Promise.all(
          gameIds.map(async (gameId) => {
            const response = await fetch(`${API_ROOT}/api/games/${gameId}`, {
              signal: controller.signal,
              ...(authToken
                ? { headers: { Authorization: `Bearer ${authToken}` } }
                : {}),
            });
            if (!response.ok) return null;
            const payload = (await response.json()) as GameItem;
            if (!payload || typeof payload.id !== "number") return null;
            return payload;
          }),
        );

        const nextGamesById: Record<number, GameItem> = {};
        for (const game of responses) {
          if (!game) continue;
          nextGamesById[game.id] = game;
        }
        setGamesById(nextGamesById);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setGamesById({});
      } finally {
        if (!controller.signal.aborted) {
          setGamesLoading(false);
        }
      }
    };

    void loadGames();
    return () => controller.abort();
  }, [authToken, interactions]);

  const likedCount = useMemo(
    () => interactions.filter((item) => item.liked === true).length,
    [interactions],
  );
  const favoritedCount = useMemo(
    () => interactions.filter((item) => item.favorited === true).length,
    [interactions],
  );
  const ratedItems = useMemo(
    () =>
      interactions.filter(
        (item): item is UserInteraction & { rating: number } =>
          typeof item.rating === "number" && Number.isFinite(item.rating),
      ),
    [interactions],
  );
  const averageRating = useMemo(() => {
    if (!ratedItems.length) return null;
    const total = ratedItems.reduce((sum, item) => sum + item.rating, 0);
    return total / ratedItems.length;
  }, [ratedItems]);
  const reviewedCount = useMemo(
    () => interactions.filter((item) => Boolean(item.review?.trim())).length,
    [interactions],
  );
  const filteredInteractions = useMemo(() => {
    switch (listFilter) {
      case "liked":
        return interactions.filter((item) => item.liked === true);
      case "favorited":
        return interactions.filter((item) => item.favorited === true);
      case "rated":
        return interactions.filter(
          (item) => typeof item.rating === "number" && Number.isFinite(item.rating),
        );
      case "reviewed":
        return interactions.filter((item) => Boolean(item.review?.trim()));
      default:
        return interactions;
    }
  }, [interactions, listFilter]);
  const filterOptions = useMemo(
    () => [
      { value: "all", label: "All", count: interactions.length },
      { value: "liked", label: "Liked", count: likedCount },
      { value: "favorited", label: "Favorited", count: favoritedCount },
      { value: "rated", label: "Rated", count: ratedItems.length },
      { value: "reviewed", label: "Reviewed", count: reviewedCount },
    ],
    [favoritedCount, interactions.length, likedCount, ratedItems.length, reviewedCount],
  );

  const handleSearchSubmit = useCallback(() => {
    const query = searchInput.trim();
    if (!query) {
      navigate("/discover");
      return;
    }
    const params = new URLSearchParams({ q: query });
    navigate(`/discover?${params.toString()}`);
  }, [navigate, searchInput]);

  const handleLogout = () => {
    onSignOut();
    navigate("/", { replace: true });
  };

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <button
            type="button"
            className="user-brand"
            onClick={() => navigate("/")}
          >
            <img src={logoUrl} alt="NextPlay Logo" />
            <span className="user-brand__text">
              <span className="user-brand__title">NextPlay</span>
              <span className="user-brand__subtitle">My List</span>
            </span>
          </button>
          <nav className="user-nav" aria-label="Primary">
            <Navbar />
          </nav>
          <div className="user-actions">
            <Searchbar
              value={searchInput}
              onValueChange={setSearchInput}
              onSubmit={handleSearchSubmit}
            />
            <button
              type="button"
              className="user-avatar"
              aria-label="Account menu"
              onClick={() => navigate("/user")}
            >
              {avatarText}
            </button>
          </div>
        </header>

        <main className="user-content">
          <section className="user-hero">
            <p className="user-hero__eyebrow">Signed in as</p>
            <h1 className="user-hero__title">{userDisplayName}</h1>
            <p className="user-hero__subtitle">
              Track what you liked, favorited, rated, and reviewed. Use filters to
              focus your list quickly.
            </p>
            <div className="user-hero__actions">
              <button type="button" className="user-hero__button" onClick={() => navigate("/games")}>
                Browse Games
              </button>
              <button type="button" className="user-hero__button" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          </section>

          <section className="user-panel">
            <header className="user-panel__header">
              <h2 className="user-panel__title">My List</h2>
              <span className="user-panel__meta">{filteredInteractions.length} entries</span>
            </header>
            <div className="user-list-filters">
              <FilterRadio
                value={listFilter}
                options={filterOptions}
                onChange={(value) => setListFilter(value as ListFilter)}
                ariaLabel="Filter your game interactions"
              />
            </div>
            {interactionsLoading ? (
              <div className="user-empty-state">Loading interactions...</div>
            ) : gamesLoading ? (
              <div className="user-empty-state">Loading game cards...</div>
            ) : interactionsError ? (
              <div className="user-empty-state">{interactionsError}</div>
            ) : filteredInteractions.length === 0 ? (
              <div className="user-empty-state">
                No entries found for this filter yet.
              </div>
            ) : (
              <div className="user-interaction-list">
                {filteredInteractions.map((item) => {
                  const game = gamesById[item.game_id];
                  const gameTitle = game?.name?.trim() || `Game #${item.game_id}`;
                  const gameCover = normalizeCoverUrl(game?.cover_image);
                  const gameRelease = formatReleaseDate(game?.release_date);
                  const timestampText = item.timestamp
                    ? new Date(item.timestamp).toLocaleString()
                    : "n/a";
                  const cardDescription = [
                    gameRelease ? `Release: ${gameRelease}` : null,
                    game?.genre ? `Genre: ${game.genre}` : null,
                  ]
                    .filter(Boolean)
                    .join("\n");
                  return (
                    <article key={`${item.user_id}-${item.game_id}`} className="user-interaction-card">
                      <div className="user-interaction-card__game">
                        <Card
                          title={gameTitle}
                          description={cardDescription || "Open details"}
                          icon={
                            gameCover ? (
                              <img
                                src={gameCover}
                                alt={gameTitle}
                                className="card__image"
                                loading="lazy"
                              />
                            ) : undefined
                          }
                          onClick={() => navigate(`/games/${item.game_id}`)}
                          ariaLabel={`View details for ${gameTitle}`}
                        />
                      </div>
                      <div className="user-interaction-card__details">
                        <div className="user-interaction-card__top">
                          <h3>Your interaction</h3>
                          <span className="user-interaction-card__updated">Updated: {timestampText}</span>
                        </div>
                        <div className="user-interaction-card__meta">
                          <span className="user-chip">
                            Rating: {typeof item.rating === "number" ? item.rating.toFixed(1) : "n/a"}
                          </span>
                          <span className="user-chip">
                            Liked: {item.liked === true ? "Yes" : item.liked === false ? "No" : "n/a"}
                          </span>
                          <span className="user-chip">
                            Favorited: {item.favorited === true ? "Yes" : item.favorited === false ? "No" : "n/a"}
                          </span>
                        </div>
                        <p className="user-interaction-card__review">
                          {item.review?.trim() ? item.review : "No review text provided."}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="user-panel">
            <header className="user-panel__header">
              <h2 className="user-panel__title">Interaction Summary</h2>
              <span className="user-panel__meta">Live</span>
            </header>
            <div className="user-placeholder-grid">
              <article className="user-placeholder-card">
                <h3>Total Interactions</h3>
                <p>{interactions.length}</p>
              </article>
              <article className="user-placeholder-card">
                <h3>Liked</h3>
                <p>{likedCount}</p>
              </article>
              <article className="user-placeholder-card">
                <h3>Favorited</h3>
                <p>{favoritedCount}</p>
              </article>
              <article className="user-placeholder-card">
                <h3>Average Rating</h3>
                <p>{averageRating === null ? "n/a" : averageRating.toFixed(2)}</p>
              </article>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
};

export default UserPage;
