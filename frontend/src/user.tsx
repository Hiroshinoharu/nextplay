import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Card from "./components/card";
import FilterRadio from "./components/filterRadio";
import MinecraftTorch from "./components/Minecraft_Torch";
import Navbar from "./components/Navbar";
import Searchbar from "./components/Searchbar";
import SiteFooter from "./components/SiteFooter";
import logoUrl from "./assets/logo.png";
import {
  getUserDisplayName,
  getUserInitials,
  type AuthUser,
} from "./utils/authUser";
import { type ThemeMode } from "./utils/theme";
import "./user.css";

type UserPageProps = {
  authUser: AuthUser | null;
  onSignOut: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
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

const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
const API_ROOT = RAW_BASE_URL.endsWith("/api")
  ? RAW_BASE_URL.slice(0, -4)
  : RAW_BASE_URL;
const DELETE_CONFIRMATION_TEXT = "DELETE";
const PASSWORD_POLICY_TEXT =
  "Use at least 8 characters with an upper-case letter, lower-case letter, number, and symbol.";

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

type PasswordVisibilityIconProps = {
  visible: boolean;
};

const PasswordVisibilityIcon = ({ visible }: PasswordVisibilityIconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M2.25 12s3.75-6 9.75-6 9.75 6 9.75 6-3.75 6-9.75 6-9.75-6-9.75-6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="12"
      r="3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    {visible ? null : (
      <path
        d="M4 4l16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    )}
  </svg>
);

type UserPasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
};

const UserPasswordField = ({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
  visible,
  onToggle,
}: UserPasswordFieldProps) => (
  <div className="user-field">
    <label htmlFor={id}>{label}</label>
    <div className="user-password-field">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="user-password-field__toggle"
        aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        aria-pressed={visible}
        onClick={onToggle}
      >
        <PasswordVisibilityIcon visible={visible} />
      </button>
    </div>
  </div>
);

const UserPage = ({ authUser, onSignOut, theme, onThemeChange }: UserPageProps) => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsError, setInteractionsError] = useState<string | null>(null);
  const [gamesById, setGamesById] = useState<Record<number, GameItem>>({});
  const [gamesLoading, setGamesLoading] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const authToken = authUser?.token?.trim() ?? "";
  const userId = authUser?.id;

  const userDisplayName = getUserDisplayName(authUser);
  const avatarText = getUserInitials(authUser);
  const settingsBusy = passwordSaving || deletePending;

  const resetSettingsState = useCallback(() => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordStatus(null);
    setPasswordError(null);
    setDeleteConfirmation("");
    setDeleteError(null);
  }, []);

  const openSettingsModal = useCallback(() => {
    resetSettingsState();
    setSettingsOpen(true);
  }, [resetSettingsState]);

  const closeSettingsModal = useCallback(() => {
    if (settingsBusy) return;
    setSettingsOpen(false);
    resetSettingsState();
  }, [resetSettingsState, settingsBusy]);

  useEffect(() => {
    if (!settingsOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSettingsModal();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeSettingsModal, settingsOpen]);

  useEffect(() => {
    if (!authUser?.id) {
      setInteractions([]);
      setInteractionsLoading(false);
      setInteractionsError(authUser ? "User id is missing for interaction lookup." : null);
      return;
    }

    const controller = new AbortController();

    const loadInteractions = async () => {
      setInteractionsLoading(true);
      setInteractionsError(null);
      try {
        const response = await fetch(`${API_ROOT}/api/users/${authUser.id}/interactions`, {
          signal: controller.signal,
          ...(authToken
            ? { headers: { Authorization: `Bearer ${authToken}` } }
            : {}),
        });
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
  }, [authToken, authUser, authUser?.id]);

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

  const deleteConfirmationMatches =
    deleteConfirmation.trim().toUpperCase() === DELETE_CONFIRMATION_TEXT;
  const themeSummary =
    theme === "dark"
      ? "Dark mode stays on with the low-glare background and higher contrast accents."
      : "Light mode brightens the page while keeping the same layout and controls.";

  const handleSearchSubmit = useCallback(() => {
    const query = searchInput.trim();
    if (!query) {
      navigate("/discover");
      return;
    }
    const params = new URLSearchParams({ q: query });
    navigate(`/discover?${params.toString()}`);
  }, [navigate, searchInput]);

  const handleLogout = useCallback(() => {
    onSignOut();
    navigate("/", { replace: true });
  }, [navigate, onSignOut]);

  const handleThemeToggle = useCallback((checked: boolean) => {
    onThemeChange(checked ? "light" : "dark");
  }, [onThemeChange]);

  const handlePasswordChange = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPasswordStatus(null);
      setPasswordError(null);

      if (!userId) {
        setPasswordError("You need an active session before changing your password.");
        return;
      }

      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError("Fill in your current password, new password, and confirmation.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("New password and confirmation do not match.");
        return;
      }

      setPasswordSaving(true);
      try {
        const response = await fetch(`${API_ROOT}/api/users/${userId}/password`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        if (!response.ok) {
          setPasswordError(payload?.error ?? `Password change failed: ${response.status}`);
          return;
        }

        setPasswordStatus(payload?.message ?? "Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (err) {
        setPasswordError(`${err}`);
      } finally {
        setPasswordSaving(false);
      }
    },
    [authToken, confirmPassword, currentPassword, newPassword, userId],
  );

  const handleDeleteAccount = useCallback(async () => {
    setDeleteError(null);

    if (!userId) {
      setDeleteError("You need an active session before deleting your account.");
      return;
    }
    if (!deleteConfirmationMatches) {
      setDeleteError(`Type ${DELETE_CONFIRMATION_TEXT} to confirm account deletion.`);
      return;
    }

    setDeletePending(true);
    try {
      const response = await fetch(`${API_ROOT}/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setDeleteError(payload?.error ?? `Account deletion failed: ${response.status}`);
        return;
      }

      onSignOut();
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(`${err}`);
    } finally {
      setDeletePending(false);
    }
  }, [authToken, deleteConfirmationMatches, navigate, onSignOut, userId]);

  const handleModalBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        closeSettingsModal();
      }
    },
    [closeSettingsModal],
  );

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="user-page" data-theme={theme}>
      <div className="user-shell">
        <header className="user-header">
          <button type="button" className="user-brand" onClick={() => navigate("/")}>
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
              aria-label="Open settings"
              onClick={openSettingsModal}
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
              Track what you liked, favorited, rated, and reviewed. Open settings to
              update your password, switch the page theme, or delete the account.
            </p>
            <div className="user-hero__actions">
              <button
                type="button"
                className="user-hero__button"
                onClick={() => navigate("/games")}
              >
                Browse Games
              </button>
              <button
                type="button"
                className="user-hero__button"
                onClick={openSettingsModal}
              >
                Settings
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
              <div className="user-empty-state">No entries found for this filter yet.</div>
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
                          <span className="user-interaction-card__updated">
                            Updated: {timestampText}
                          </span>
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

      {settingsOpen ? (
        <div className="user-modal-backdrop" onClick={handleModalBackdropClick}>
          <section
            className="user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-settings-title"
          >
            <header className="user-modal__header">
              <div>
                <p className="user-modal__eyebrow">Account controls</p>
                <h2 id="user-settings-title" className="user-modal__title">
                  Settings
                </h2>
                <p className="user-modal__subtitle">
                  Manage your password, account safety, and page theme from one place.
                </p>
              </div>
              <button
                type="button"
                className="user-modal__close"
                onClick={closeSettingsModal}
                disabled={settingsBusy}
              >
                Close
              </button>
            </header>

            <div className="user-modal__body">
              <article className="user-settings-card user-settings-card--appearance">
                <div className="user-settings-card__header">
                  <div>
                    <h3>Appearance</h3>
                    <p>Use the torch to preview this page in dark or light mode.</p>
                  </div>
                  <span className="user-settings-badge">{theme === "dark" ? "Dark" : "Light"}</span>
                </div>
                <div className="user-theme-panel">
                  <div className="user-theme-panel__toggle">
                    <MinecraftTorch
                      checked={theme === "light"}
                      onChange={handleThemeToggle}
                      label="Toggle page theme"
                      onLabel="Light mode"
                      offLabel="Dark mode"
                    />
                  </div>
                  <div className="user-theme-panel__copy">
                    <p className="user-inline-note">{themeSummary}</p>
                    <div className="user-theme-preview">
                      <span className="user-theme-preview__swatch" aria-hidden="true" />
                      <div>
                        <strong>{theme === "dark" ? "Dark mode" : "Light mode"}</strong>
                        <p>
                          The choice is stored locally, so this page keeps the same look the next
                          time you open it.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article className="user-settings-card">
                <div className="user-settings-card__header">
                  <div>
                    <h3>Change password</h3>
                    <p>Verify your current password before setting a new one.</p>
                  </div>
                </div>
                <form className="user-settings-form" onSubmit={handlePasswordChange}>
                  <UserPasswordField
                    id="user-current-password"
                    name="current_password"
                    label="Current password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    visible={showCurrentPassword}
                    onToggle={() => setShowCurrentPassword((current) => !current)}
                  />
                  <div className="user-form-row">
                    <UserPasswordField
                      id="user-new-password"
                      name="new_password"
                      label="New password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={setNewPassword}
                      visible={showNewPassword}
                      onToggle={() => setShowNewPassword((current) => !current)}
                    />
                    <UserPasswordField
                      id="user-confirm-password"
                      name="confirm_password"
                      label="Confirm new password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      visible={showConfirmPassword}
                      onToggle={() => setShowConfirmPassword((current) => !current)}
                    />
                  </div>
                  <p className="user-inline-note">{PASSWORD_POLICY_TEXT}</p>
                  {passwordError ? (
                    <div className="user-status user-status--error">{passwordError}</div>
                  ) : null}
                  {passwordStatus ? (
                    <div className="user-status user-status--success">{passwordStatus}</div>
                  ) : null}
                  <button
                    type="submit"
                    className="user-settings-button"
                    disabled={passwordSaving}
                  >
                    {passwordSaving ? "Updating..." : "Update password"}
                  </button>
                </form>
              </article>

              <article className="user-settings-card user-settings-card--danger">
                <div className="user-settings-card__header">
                  <div>
                    <h3>Danger zone</h3>
                    <p>Permanently delete your account, interactions, and recommendation history.</p>
                  </div>
                </div>
                <p className="user-danger-copy">
                  This action is irreversible. Type {DELETE_CONFIRMATION_TEXT} to enable deletion.
                </p>
                <div className="user-delete-row">
                  <div className="user-field">
                    <label htmlFor="user-delete-confirmation">Confirmation text</label>
                    <input
                      id="user-delete-confirmation"
                      name="delete_confirmation"
                      type="text"
                      placeholder={DELETE_CONFIRMATION_TEXT}
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="user-settings-button user-settings-button--danger"
                    onClick={handleDeleteAccount}
                    disabled={!deleteConfirmationMatches || deletePending}
                  >
                    {deletePending ? "Deleting..." : "Delete account"}
                  </button>
                </div>
                {deleteError ? (
                  <div className="user-status user-status--error">{deleteError}</div>
                ) : null}
              </article>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default UserPage;




