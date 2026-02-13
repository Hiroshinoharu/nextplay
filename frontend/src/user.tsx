import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
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

// Base URL for API requests, ensuring no trailing slash
const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
const API_ROOT = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;

  // Main component for the user account page, displaying user info and interactions
const UserPage = ({ authUser, onSignOut }: UserPageProps) => {
  // Hook for programmatic navigation
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsError, setInteractionsError] = useState<string | null>(null);
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
        const sorted = [...payload].sort((a, b) => {
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
              Placeholder account dashboard. You can replace these sections with
              real list data and actions later.
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
              <span className="user-panel__meta">{interactions.length} entries</span>
            </header>
            {interactionsLoading ? (
              <div className="user-empty-state">Loading interactions...</div>
            ) : interactionsError ? (
              <div className="user-empty-state">{interactionsError}</div>
            ) : interactions.length === 0 ? (
              <div className="user-empty-state">
                No interactions yet. Once you rate/review/like/favorite games, they will appear here.
              </div>
            ) : (
              <div className="user-interaction-list">
                {interactions.map((item) => {
                  const timestampText = item.timestamp
                    ? new Date(item.timestamp).toLocaleString()
                    : "n/a";
                  return (
                    <article key={`${item.user_id}-${item.game_id}`} className="user-interaction-card">
                      <div className="user-interaction-card__top">
                        <h3>Game #{item.game_id}</h3>
                        <span>{timestampText}</span>
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
