import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import "./health.css";
import BrandLogo from "./components/BrandLogo";
import Button from "./components/Button";
import SiteFooter from "./components/SiteFooter";
import { normalizeAuthUser, type AuthUser } from "./utils/authUser";
import {
  CSRF_HEADER_NAME,
  getCSRFCookieValue,
  shouldAttachCSRFToken,
} from "./utils/csrf";
import { getInitialTheme, THEME_STORAGE_KEY, type ThemeMode } from "./utils/theme";
import { trimTrailingSlashes } from "./utils/text";
import Loader from "./components/Loader";
import LoadingScreen from "./components/LoadingScreen";

const Game = lazy(() => import("./game"));
const Games = lazy(() => import("./games"));
const SearchPage = lazy(() => import("./discover"));
const UserPage = lazy(() => import("./user"));
const Login = lazy(() => import("./login"));

// Types for health check statuses
type HealthStatus = "idle" | "loading" | "ok" | "error";

// Type for individual health check
type HealthCheck = {
  key: string;
  name: string;
  status: HealthStatus;
  httpStatus?: number;
  detail?: string;
  checkedAt?: string;
};

type HealthResponse = {
  ok?: boolean;
  checked_at?: string;
  services?: Record<
    string,
    {
      status?: string;
      http_status?: number;
      detail?: unknown;
      error?: string;
    }
  >;
};

// Types for popular games
type PopularGame = {
  id: number;
  title: string;
  image: string;
};

// Response type for popular games API
type PopularGameResponse = {
  id: number;
  name: string;
  cover_image?: string;
};

// Base URL for API requests, trimmed of trailing slashes
const RAW_API_BASE_URL = trimTrailingSlashes(import.meta.env.VITE_API_URL ?? "/api");
const API_ROOT = RAW_API_BASE_URL.endsWith("/api")
  ? RAW_API_BASE_URL.slice(0, -4)
  : RAW_API_BASE_URL;
const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_ROOT}/api${normalizedPath}`;
};

// Key for storing auth user in localStorage
const AUTH_STORAGE_KEY = "nextplay_user";
const SWIPE_SCROLL_STEP_RATIO = 0.82;
const SWIPE_TRIGGER_PX = 64;
const SWIPE_MAX_DURATION_MS = 700;
const SWIPE_VERTICAL_DOMINANCE = 1.25;
const SWIPE_IGNORE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a",
  "[role='button']",
  "[contenteditable='true']",
  ".games-row",
  ".popular__cards",
  ".games-hero__screenshots-row",
].join(",");

const HEALTH_SERVICE_LABELS: Record<string, string> = {
  gateway: "Gateway",
  game: "Game Service",
  user: "User Service",
  recommender: "Recommender Service",
};

const shouldIgnoreVerticalSwipe = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(SWIPE_IGNORE_SELECTOR));
};

type RouteTransitionLoaderProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  hints?: string[];
  theme: ThemeMode;
};

const RouteTransitionLoader = ({
  eyebrow,
  title,
  subtitle,
  hints,
  theme,
}: RouteTransitionLoaderProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeoutMs = prefersReducedMotion ? 140 : 460;
    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  if (!visible) return null;

  return (
    <LoadingScreen
      fullScreen
      theme={theme}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      hints={hints}
    />
  );
};

const installSecureFetchDefaults = () => {
  if (typeof window === "undefined") return;

  const currentFetch = window.fetch as typeof window.fetch & {
    __nextplayCredentialsPatched?: boolean;
  };
  if (currentFetch.__nextplayCredentialsPatched) return;

  const originalFetch = window.fetch.bind(window);
  const csrfBootstrapUrl = apiUrl("/users/csrf");
  const csrfProtectedOrigins = Array.from(
    new Set([
      window.location.origin,
      new URL(API_ROOT || "/", window.location.origin).origin,
    ]),
  );
  let csrfBootstrapPromise: Promise<string> | null = null;

  const ensureCSRFToken = async () => {
    const existingToken = getCSRFCookieValue();
    if (existingToken) {
      return existingToken;
    }

    if (!csrfBootstrapPromise) {
      csrfBootstrapPromise = (async () => {
        try {
          const response = await originalFetch(csrfBootstrapUrl, {
            credentials: "include",
          });
          if (!response.ok) {
            return "";
          }

          const payload = (await response.json().catch(() => null)) as
            | { csrf_token?: unknown }
            | null;
          if (typeof payload?.csrf_token === "string" && payload.csrf_token.trim()) {
            return payload.csrf_token.trim();
          }
          return getCSRFCookieValue();
        } catch {
          return "";
        } finally {
          csrfBootstrapPromise = null;
        }
      })();
    }

    return csrfBootstrapPromise;
  };

  const patchedFetch = (async (
    ...args: Parameters<typeof fetch>
  ): Promise<Response> => {
    const [input, init] = args;
    const requestMethod = init?.method ?? (input instanceof Request ? input.method : "GET");
    const requestUrl =
      input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);
    const requestInit: RequestInit = {
      ...init,
      credentials:
        init?.credentials ??
        (input instanceof Request ? input.credentials : undefined) ??
        "include",
    };
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      const initHeaders = new Headers(init.headers);
      initHeaders.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    if (shouldAttachCSRFToken(requestUrl, requestMethod, csrfProtectedOrigins)) {
      let csrfToken = getCSRFCookieValue();
      if (!csrfToken) {
        csrfToken = await ensureCSRFToken();
      }
      if (csrfToken && !headers.has(CSRF_HEADER_NAME)) {
        headers.set(CSRF_HEADER_NAME, csrfToken);
      }
    }

    return originalFetch(input, {
      ...requestInit,
      headers,
    });
  }) as typeof window.fetch & { __nextplayCredentialsPatched?: boolean };

  patchedFetch.__nextplayCredentialsPatched = true;
  window.fetch = patchedFetch;
};

installSecureFetchDefaults();

type HomeProps = {
  authUser: AuthUser | null;
  onSignOut: () => void;
  theme: ThemeMode;
};

const Home = ({ authUser, onSignOut, theme }: HomeProps) => {
  // Define service cards for the home page
  const navigate = useNavigate();
  const [heroEmail, setHeroEmail] = useState("");
  const pageCountTarget = 4;
  const totalLimit = pageCountTarget * 4;
  const preferredPopularYear = 2026;
  const [popularGames, setPopularGames] = useState<PopularGame[]>([]);
  const [popularTitle, setPopularTitle] = useState(
    `Most Popular Games: ${preferredPopularYear}`,
  );
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularError, setPopularError] = useState<string | null>(null);

  // Load a lightweight featured set for the landing page.
  useEffect(() => {
    const controller = new AbortController();

    const loadPopularGames = async () => {
      setPopularLoading(true);
      setPopularError(null);
      setPopularTitle(`Most Popular Games: ${preferredPopularYear}`);

      try {
        const cacheBust = String(Date.now());
        const fetchGames = async (
          path: string,
          params: URLSearchParams,
        ): Promise<PopularGameResponse[]> => {
          params.set("limit", String(totalLimit));
          params.set("offset", "0");
          params.set("t", cacheBust);
          params.set("include_media", "0");

          const response = await fetch(`${apiUrl(path)}?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Failed to load featured games (${response.status}) ${errorText}`.trim(),
            );
          }

          const data = (await response.json()) as PopularGameResponse[];
          if (!Array.isArray(data)) {
            throw new Error("Unexpected response shape for featured games");
          }
          return data;
        };

        let data = await fetchGames(
          "/games/popular",
          new URLSearchParams({
            year: String(preferredPopularYear),
            min_rating_count: "1",
          }),
        );

        if (data.length === 0) {
          setPopularTitle("Popular Picks");
          data = await fetchGames(
            "/games",
            new URLSearchParams({
              exclude_non_base: "1",
            }),
          );
        }

        const normalized = data.map((game) => {
          const rawImage = game.cover_image ?? "";
          const image = rawImage.startsWith("//")
            ? `https:${rawImage}`
            : rawImage || "/landing-bg.webp";
          return {
            id: game.id,
            title: game.name,
            image,
          };
        });

        setPopularGames(normalized.slice(0, totalLimit));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setPopularGames([]);
          setPopularError(
            `Games for ${preferredPopularYear} are temporarily unavailable. Try refreshing in a moment.`,
          );
        }
      } finally {
        setPopularLoading(false);
      }
    };

    loadPopularGames();
    return () => controller.abort();
  }, [preferredPopularYear, totalLimit]);

  return (
    <div className="landing" data-theme={theme}>
      <div className="landing__container">
        <nav className="landing__nav">
          <BrandLogo onClick={() => navigate("/")} width={128} height={128} />
          <div>
            <div className="landing__nav-actions">
              {authUser ? (
                <button type="button" onClick={onSignOut}>
                  Sign Out
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => navigate("/login?mode=signup")}>
                    Sign Up
                  </button>
                  <button type="button" onClick={() => navigate("/login")}>
                    Log In
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>

        <section className="hero">
          <div>
            <h1 className="hero__title">Welcome Games Find You</h1>
            <h2 className="hero__subtitle">Discover. Play. Repeat.</h2>
          </div>
          <p className="hero__description">
            Enter your email to find what to play
          </p>
          <form 
          className="hero__form" 
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedEmail = heroEmail.trim();
            if (!trimmedEmail) return;
            const params =  new URLSearchParams({ email: trimmedEmail });
            navigate(`/login?${params.toString()}`);
          }
          }>
            <input
              id="hero-email"
              name="email"
              className="hero__input"
              type="email"
              placeholder="Enter your email"
              value={heroEmail}
              onChange={(event) => setHeroEmail(event.target.value)}
              required
            />
            <button className="hero__button" type="submit">
              Continue<span>&#8594;</span>
            </button>
          </form>
        </section>

        <section className="popular">
          <h3 className="popular__title">{popularTitle}</h3>
          {popularError ? (
            <p className="popular__status">{popularError}</p>
          ) : popularLoading ? (
            <Loader
              title="Loading popular games"
              subtitle="Curating what players are into right now..."
              theme={theme}
            />
          ) : popularGames.length === 0 ? (
            <p className="popular__status">No popular games found yet.</p>
          ) : (
            <div className="popular__carousel">
              <div className="popular__cards" tabIndex={0}>
                {popularGames.map((game) => (
                  <div key={game.id} className="popular__card">
                    <img
                      src={game.image}
                      alt={game.title}
                      className="popular__card-image"
                      loading="lazy"
                      onError={(event) => {
                        const target = event.currentTarget;
                        target.onerror = null;
                        target.src = "/landing-bg.webp";
                      }}
                    />
                    <p className="popular__card-title">{game.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        <SiteFooter />
      </div>
    </div>
  );
};


const HealthPage = ({ theme }: { theme: ThemeMode }) => {
  // State and handlers for health checks
  const navigate = useNavigate();
  const location = useLocation();
  const statusAllowed =
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_STATUS === "true" &&
    new URLSearchParams(location.search).get("status") === "1";
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [healthUpdatedAt, setHealthUpdatedAt] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [overallOk, setOverallOk] = useState<boolean | null>(null);

  const formatDetail = (detail: unknown): string | undefined => {
    if (detail === null || detail === undefined) return undefined;
    if (typeof detail === "string") return detail;
    if (typeof detail === "object") {
      return Object.entries(detail as Record<string, unknown>)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join("\n");
    }
    return String(detail);
  };

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await fetch(apiUrl("/health"));
      const text = await response.text();
      let data: HealthResponse | null = null;
      try {
        data = JSON.parse(text) as HealthResponse;
      } catch {
        data = null;
      }

      if (!data || typeof data !== "object") {
        setHealthError("Unexpected response from /api/health");
        setHealthChecks([]);
        setOverallOk(null);
        return;
      }

      const services = data.services ?? {};
      const checkedAt = data.checked_at
        ? new Date(data.checked_at).toLocaleTimeString()
        : new Date().toLocaleTimeString();

      const checks: HealthCheck[] = Object.keys(HEALTH_SERVICE_LABELS).map(
        (key) => {
          const service = services[key];
          const status: HealthStatus =
            service?.status === "ok" ? "ok" : "error";
          const detail = formatDetail(service?.detail ?? service?.error);
          return {
            key,
            name: HEALTH_SERVICE_LABELS[key] ?? key,
            status: service ? status : "error",
            httpStatus: service?.http_status,
            detail: detail ?? (service ? undefined : "No data returned"),
            checkedAt,
          };
        },
      );

      setHealthChecks(checks);
      setHealthUpdatedAt(checkedAt);
      setOverallOk(typeof data.ok === "boolean" ? data.ok : null);
    } catch (err) {
      setHealthError(String(err));
      setHealthChecks([]);
      setOverallOk(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!statusAllowed) return;
    loadHealth();
  }, [loadHealth, statusAllowed]);

  if (!statusAllowed) {
    return <Navigate to="/games" replace />;
  }

  const okCount = healthChecks.filter((check) => check.status === "ok").length;
  const totalCount = healthChecks.length;
  const score = totalCount ? Math.round((okCount / totalCount) * 100) : 0;

  return (
    <div className="health-page" data-theme={theme}>
      <div className="health-shell">
        <header className="health-header">
          <div className="health-brand">
            <span className="health-brand__title">NextPlay</span>
            <span className="health-brand__subtitle">System Status</span>
          </div>
          <div className="health-actions">
            <Button
              onClick={loadHealth}
              disabled={healthLoading}
              label={healthLoading ? "Checking..." : "Refresh"}
              showIcon={false}
            />
            <Button
              label="Back to services"
              showIcon={false}
              onClick={() => navigate("/games")}
            />
          </div>
        </header>

        <section className="health-summary">
          <div className="health-score">
            <span className="health-score__label">Health points</span>
            <div className="health-score__value">{score}</div>
            <span className="health-score__max">/ 100</span>
            <p className="health-score__meta">
              {totalCount ? `${okCount} of ${totalCount} services OK` : "Awaiting checks"}
            </p>
          </div>
          <div className="health-meta">
            <div className="health-meta__item">
              <span className="health-meta__label">Aggregate</span>
              <span className="health-meta__value">
                {overallOk === null
                  ? "unknown"
                  : overallOk
                    ? "healthy"
                    : "issues detected"}
              </span>
            </div>
            <div className="health-meta__item">
              <span className="health-meta__label">Endpoint</span>
              <span className="health-meta__value">{apiUrl("/health")}</span>
            </div>
            <div className="health-meta__item">
              <span className="health-meta__label">Last checked</span>
              <span className="health-meta__value">
                {healthUpdatedAt ?? "not yet"}
              </span>
            </div>
          </div>
        </section>

        {healthError && (
          <div className="health-alert">
            {healthError}
          </div>
        )}

        <section className="health-grid">
          {healthChecks.map((check) => {
            const descriptionLines = [
              check.status === "loading"
                ? "Status: checking..."
                : `Status: ${check.status}`,
              check.httpStatus ? `HTTP: ${check.httpStatus}` : null,
              check.detail ? `Details: ${check.detail}` : null,
              check.checkedAt ? `Checked: ${check.checkedAt}` : null,
            ].filter(Boolean);

            return (
              <div key={check.key} className={`health-card is-${check.status}`}>
                <div className="health-card__header">
                  <h3>{check.name}</h3>
                  <span className="health-card__status">
                    {check.status === "loading" ? "checking" : check.status}
                  </span>
                </div>
                <pre className="health-card__details">
                  {descriptionLines.join("\n")}
                </pre>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const unauthorizedRedirectingRef = useRef(false);
  const [showBootLoadingScreen, setShowBootLoadingScreen] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return null;
      const user = normalizeAuthUser(JSON.parse(stored));
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      return user;
    } catch {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      return null;
    }
  });

  const handleAuthSuccess = (payload: unknown) => {
    const user = normalizeAuthUser(payload);
    if (!user) return;
    setAuthUser(user);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore storage errors (e.g., private mode)
    }
  };

  const clearClientSession = useCallback(() => {
    setTheme("dark");
    setAuthUser(null);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = "dark";
      document.body.dataset.theme = "dark";
    }
  }, []);

  const handleSignOut = useCallback(() => {
    void fetch(apiUrl("/users/logout"), {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    clearClientSession();
  }, [clearClientSession]);

  const sessionUser = authUser;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let ready = typeof document !== "undefined" && document.readyState === "complete";
    let minimumElapsed = false;

    const finishIfReady = () => {
      if (ready && minimumElapsed) {
        setShowBootLoadingScreen(false);
      }
    };

    const handleReady = () => {
      ready = true;
      finishIfReady();
    };

    const minimumTimer = window.setTimeout(() => {
      minimumElapsed = true;
      finishIfReady();
    }, 850);

    const fallbackTimer = window.setTimeout(() => {
      ready = true;
      finishIfReady();
    }, 1800);

    if (!ready) {
      window.addEventListener("load", handleReady, { once: true });
    } else {
      handleReady();
    }

    return () => {
      window.clearTimeout(minimumTimer);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("load", handleReady);
    };
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = (async (
      ...args: Parameters<typeof fetch>
    ): Promise<Response> => {
      const response = await originalFetch(...args);
      const authError = response.headers.get("x-nextplay-auth-error");
      if (
        ((response.status === 401 && authError === "session-invalid") ||
          (response.status === 403 && authError === "session-user-mismatch")) &&
        authUser &&
        !unauthorizedRedirectingRef.current
      ) {
        unauthorizedRedirectingRef.current = true;
        clearClientSession();
        navigate("/", { replace: true });
      }
      return response;
    }) as typeof window.fetch;

    return () => {
      window.fetch = originalFetch;
      unauthorizedRedirectingRef.current = false;
    };
  }, [authUser, clearClientSession, navigate]);

  const shouldShowRouteLoader =
    !showBootLoadingScreen && location.key !== "default";

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let touchStartTs = 0;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (shouldIgnoreVerticalSwipe(event.target)) {
        touchStartTs = 0;
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      touchStartTs = Date.now();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchStartTs <= 0 || event.changedTouches.length !== 1) return;
      const elapsedMs = Date.now() - touchStartTs;
      touchStartTs = 0;
      if (elapsedMs > SWIPE_MAX_DURATION_MS) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absY < SWIPE_TRIGGER_PX) return;
      if (absY < absX * SWIPE_VERTICAL_DOMINANCE) return;

      const viewportStep = Math.round(window.innerHeight * SWIPE_SCROLL_STEP_RATIO);
      const scrollDirection = deltaY < 0 ? 1 : -1;
      window.scrollBy({
        top: viewportStep * scrollDirection,
        behavior: "smooth",
      });
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const routeLoaderConfig = useMemo(() => {
    if (location.pathname === "/") {
      return {
        eyebrow: "Landing page",
        title: "Setting up the landing view",
        subtitle: "Curating a clean handoff into your next session.",
        hints: [
          "Checking live service status",
          "Staging the featured 2026 shelf",
          "Polishing the landing carousel",
        ],
      };
    }

    if (location.pathname === "/discover") {
      return {
        eyebrow: "Discover",
        title: "Scanning game worlds",
        subtitle: "Mixing profile signals, live lanes, and recommendation context.",
        hints: [
          "Loading your discover lanes",
          "Warming recommendation context",
          "Saving your questionnaire state",
        ],
      };
    }

    if (location.pathname === "/games") {
      return {
        eyebrow: "Library",
        title: "Loading your library",
        subtitle: "Pulling recent releases, top-rated games, and hero media into place.",
        hints: [
          "Fetching the main catalog",
          "Ranking top-rated standouts",
          "Preparing screenshots and cover art",
        ],
      };
    }

    if (location.pathname === "/login") {
      return {
        eyebrow: "Sign in",
        title: "Preparing secure sign-in",
        subtitle: "Verifying the session shell before you step in.",
        hints: [
          "Restoring saved session state",
          "Locking protected routes",
          "Preparing account actions",
        ],
      };
    }

    return {
      eyebrow: "NextPlay",
      title: "Loading your next screen",
      subtitle: "Polishing data, visuals, and recommendations.",
      hints: [
        "Syncing live data",
        "Staging page visuals",
        "Getting interactions ready",
      ],
    };
  }, [location.pathname]);

  return (
    <>
      <Suspense fallback={null}>
        <Routes>
          <Route
            path="/"
            element={
              sessionUser ? (
                <Navigate to="/games" replace />
              ) : (
                <Home authUser={sessionUser} onSignOut={handleSignOut} theme={theme} />
              )
            }
          />
          <Route
            path="/games"
            element={
              sessionUser ? (
                <Games authUser={sessionUser} theme={theme} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/discover"
            element={
              sessionUser ? (
                <SearchPage authUser={sessionUser} theme={theme} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/games/:gameId"
            element={
              sessionUser ? (
                <Game authUser={sessionUser} theme={theme} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/login"
            element={
              <Login
                apiBaseUrl={API_ROOT}
                authUser={sessionUser}
                onAuthSuccess={handleAuthSuccess}
                theme={theme}
              />
            }
          />
          <Route
            path="/user"
            element={
              <UserPage authUser={sessionUser} onSignOut={handleSignOut} theme={theme} onThemeChange={setTheme} />
            }
          />
          <Route path="/health" element={<HealthPage theme={theme} />} />
          <Route
            path="*"
            element={
              sessionUser ? (
                <Navigate to="/games" replace />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
      </Suspense>
      {showBootLoadingScreen ? (
        <LoadingScreen
          fullScreen
          theme={theme}
          eyebrow="Launching NextPlay"
          title="Booting your play space"
          subtitle="Loading routes, session state, and the first view."
          hints={[
            "Checking your saved session",
            "Connecting to live services",
            "Warming up the game feed",
          ]}
        />
      ) : null}
      {shouldShowRouteLoader ? (
        <RouteTransitionLoader
          key={location.key}
          theme={theme}
          eyebrow={routeLoaderConfig.eyebrow}
          title={routeLoaderConfig.title}
          subtitle={routeLoaderConfig.subtitle}
          hints={routeLoaderConfig.hints}
        />
      ) : null}
    </>
  );
}

export default App;
