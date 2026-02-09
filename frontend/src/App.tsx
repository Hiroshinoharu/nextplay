import { useCallback, useEffect, useState } from "react";
import { Route, Routes, useLocation ,useNavigate, Navigate } from "react-router-dom";
import "./App.css";
import "./health.css";
import BrandLogo from "./components/BrandLogo";
import Button from "./components/Button";
import Form from "./components/Form";
import SiteFooter from "./components/SiteFooter";
import Game from "./game";
import Games from "./games";
import UserPage from "./user";

// Types for authenticated user
type AuthUser = {
  id?: number;
  username?: string;
  email?: string;
  steam_linked?: boolean;
};

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
const RAW_API_BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);
const API_ROOT = RAW_API_BASE_URL.endsWith("/api")
  ? RAW_API_BASE_URL.slice(0, -4)
  : RAW_API_BASE_URL;
const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_ROOT}/api${normalizedPath}`;
};

// Key for storing auth user in localStorage
const AUTH_STORAGE_KEY = "nextplay_user";

const HEALTH_SERVICE_LABELS: Record<string, string> = {
  gateway: "Gateway",
  game: "Game Service",
  user: "User Service",
  recommender: "Recommender Service",
};

// Coerce unknown payload into AuthUser or null
const coerceAuthUser = (payload: unknown): AuthUser | null => {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const idValue = data.id ?? data.user_id ?? data.userId;
  let id: number | undefined;
  if (typeof idValue === "number") {
    id = idValue;
  } else if (typeof idValue === "string" && idValue.trim()) {
    const parsed = Number(idValue);
    if (!Number.isNaN(parsed)) id = parsed;
  }
  const username =
    typeof data.username === "string" ? data.username : undefined;
  const email = typeof data.email === "string" ? data.email : undefined;
  const steamLinked =
    typeof data.steam_linked === "boolean"
      ? data.steam_linked
      : typeof data.steamLinked === "boolean"
        ? data.steamLinked
        : undefined;

  if (!id && !username && !email) return null;

  return {
    id,
    username,
    email,
    steam_linked: steamLinked,
  };
};

type HomeProps = {
  authUser: AuthUser | null;
  onSignOut: () => void;
};

type AuthHandlers = {
  authUser: AuthUser | null;
  onAuthSuccess: (payload: unknown) => void;
};

const Home = ({ authUser, onSignOut }: HomeProps) => {
  // Define service cards for the home page
  const navigate = useNavigate();
  const [heroEmail, setHeroEmail] = useState("");
  const pageCountTarget = 4;
  const totalLimit = pageCountTarget * 4;
  const [popularGames, setPopularGames] = useState<PopularGame[]>([]);
  const popularYear = 2025;
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularError, setPopularError] = useState<string | null>(null);

  // Load popular games on component mount
  useEffect(() => {
    // Abort controller for fetch requests
    const controller = new AbortController();
    const loadPopularGames = async () => {
      setPopularLoading(true);
      setPopularError(null);
      try {
        const cacheBust = Date.now();
        const fetchPopular = async (year: number) => {
          const params = new URLSearchParams({
            limit: String(totalLimit),
            t: String(cacheBust),
            min_rating_count: "1",
          });
          if (year > 0) {
            params.set("year", String(year));
          }
          const response = await fetch(
            `${apiUrl("/games/popular")}?${params.toString()}`,
            {
              signal: controller.signal,
            },
          );
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Failed to load popular games (${response.status}) ${errorText}`,
            );
          }
          const data = (await response.json()) as PopularGameResponse[];
          if (!Array.isArray(data)) {
            throw new Error("Unexpected response shape for popular games");
          }
          return data;
        };

        const data = await fetchPopular(popularYear);

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
          setPopularError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setPopularLoading(false);
      }
    };

    loadPopularGames();
    return () => controller.abort();
  }, [popularYear, totalLimit]);

  return (
    <div className="landing">
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
          <h3 className="popular__title">
            {popularYear > 0
              ? `Most Popular Games: ${popularYear}`
              : "Most Popular Games"}
          </h3>
          {popularError ? (
            <p className="popular__status">
              Unable to load popular games: {popularError}
            </p>
          ) : popularLoading ? (
            <p className="popular__status">Loading popular games...</p>
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


const HealthPage = () => {
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
    <div className="health-page">
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
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return null;
      return coerceAuthUser(JSON.parse(stored));
    } catch {
      return null;
    }
  });

  const handleAuthSuccess = (payload: unknown) => {
    const user = coerceAuthUser(payload);
    if (!user) return;
    setAuthUser(user);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore storage errors (e.g., private mode)
    }
  };

  const handleSignOut = () => {
    setAuthUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          authUser ? (
            <Navigate to="/games" replace />
          ) : (
            <Home authUser={authUser} onSignOut={handleSignOut} />
          )
        }
      />
      <Route path="/games" element={<Games />} />
      <Route path="/games/:gameId" element={<Game />} />
      <Route
        path="/login"
        element={
          <LoginRoute authUser={authUser} onAuthSuccess={handleAuthSuccess} />
        }
      />
      <Route
        path="/user"
        element={
          <UserPage authUser={authUser} onSignOut={handleSignOut} />
        }
      />
      <Route path="/health" element={<HealthPage />} />
      <Route
        path="*"
        element={
          authUser ? (
            <Navigate to="/games" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
const LoginRoute = ({ authUser, onAuthSuccess }: AuthHandlers) => {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromQuery = new URLSearchParams(location.search).get("email") ?? undefined;
  const modeFromQuery = new URLSearchParams(location.search).get("mode") ?? undefined;
  const initialMode = modeFromQuery === "signup" || modeFromQuery === "register"
    ? "register"
    : "login";
  useEffect(() => {
    if (authUser) {
      const timeoutId = window.setTimeout(() => {
        navigate("/games", { replace: true });
      }, 1000);
      return () => window.clearTimeout(timeoutId);
    }
  }, [authUser, navigate]);

  return (
    <div className="landing landing--auth">
      <div className="landing__container landing__container--auth">
        <nav className="landing__nav">
          <BrandLogo onClick={() => navigate("/")} />
        </nav>
        <main className="auth-page">
          {authUser && (
            <div className="auth-status">
              Signed in as {authUser.username ?? authUser.email ?? "User"}
            </div>
          )}
          <Form
            apiBaseUrl={API_ROOT}
            onAuthSuccess={onAuthSuccess}
            initialEmail={emailFromQuery}
            initialMode={initialMode}
          />
        </main>
      </div>
    </div>
  );
};
