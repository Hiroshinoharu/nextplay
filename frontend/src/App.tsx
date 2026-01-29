import { useCallback, useEffect, useRef, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import Button from './components/Button'
import Card from './components/card'
import Form from './components/Form'
import Game from './game'
import logoUrl from './assets/logo.png'

// Types for authenticated user
type AuthUser = {
  id?: number
  username?: string
  email?: string
  steam_linked?: boolean
}

// Types for health check statuses
type HealthStatus = 'idle' | 'loading' | 'ok' | 'error'

// Type for individual health check
type HealthCheck = {
  key: string
  name: string
  status: HealthStatus
  httpStatus?: number
  detail?: string
  checkedAt?: string
}

type HealthResponse = {
  ok?: boolean
  checked_at?: string
  services?: Record<
    string,
    {
      status?: string
      http_status?: number
      detail?: unknown
      error?: string
    }
  >
}

type PopularGame = {
  id: number
  title: string
  image: string
}

type PopularGameResponse = {
  id: number
  name: string
  cover_image?: string
}

// Base URL for API requests, trimmed of trailing slashes
const RAW_API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')
const API_ROOT = RAW_API_BASE_URL.endsWith('/api') ? RAW_API_BASE_URL.slice(0, -4) : RAW_API_BASE_URL
const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_ROOT}/api${normalizedPath}`
}

// Key for storing auth user in localStorage
const AUTH_STORAGE_KEY = 'nextplay_user'


const HEALTH_SERVICE_LABELS: Record<string, string> = {
  gateway: 'Gateway',
  game: 'Game Service',
  user: 'User Service',
  recommender: 'Recommender Service',
}

// Coerce unknown payload into AuthUser or null
const coerceAuthUser = (payload: unknown): AuthUser | null => {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const idValue = data.id ?? data.user_id ?? data.userId
  let id: number | undefined
  if (typeof idValue === 'number') {
    id = idValue
  } else if (typeof idValue === 'string' && idValue.trim()) {
    const parsed = Number(idValue)
    if (!Number.isNaN(parsed)) id = parsed
  }
  const username = typeof data.username === 'string' ? data.username : undefined
  const email = typeof data.email === 'string' ? data.email : undefined
  const steamLinked =
    typeof data.steam_linked === 'boolean'
      ? data.steam_linked
      : typeof data.steamLinked === 'boolean'
        ? data.steamLinked
        : undefined

  if (!id && !username && !email) return null

  return {
    id,
    username,
    email,
    steam_linked: steamLinked,
  }
}

type HomeProps = {
  authUser: AuthUser | null
  onSignOut: () => void
}

const Home = ({ authUser, onSignOut }: HomeProps) => {
  // Define service cards for the home page
  const navigate = useNavigate()
  const cardsRef = useRef<HTMLDivElement | null>(null)
  const [activeDot, setActiveDot] = useState(0)
  const pageSize = 4
  const pageCountTarget = 4
  const totalLimit = pageCountTarget * 4
  const touchStartXRef = useRef<number | null>(null)
  const touchLastXRef = useRef<number | null>(null)
  const swipeHandledRef = useRef(false)
  const [popularGames, setPopularGames] = useState<PopularGame[]>([])
  const [popularLoading, setPopularLoading] = useState(false)
  const [popularError, setPopularError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const loadPopularGames = async () => {
      setPopularLoading(true)
      setPopularError(null)
      try {
        const cacheBust = Date.now()
        const response = await fetch(
          `${apiUrl('/games/popular')}?year=2025&limit=${totalLimit}&t=${cacheBust}`,
          {
            signal: controller.signal,
          }
        )
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to load popular games (${response.status}) ${errorText}`)
        }
        const data = (await response.json()) as PopularGameResponse[]
        if (!Array.isArray(data)) {
          throw new Error('Unexpected response shape for popular games')
        }
        const normalized = data.map(game => {
          const rawImage = game.cover_image ?? ''
          const image = rawImage.startsWith('//') ? `https:${rawImage}` : rawImage || '/landing-bg.webp'
          return {
            id: game.id,
            title: game.name,
            image,
          }
        })
        setPopularGames(normalized.slice(0, totalLimit))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setPopularError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        setPopularLoading(false)
      }
    }

    loadPopularGames()
    return () => controller.abort()
  }, [totalLimit])


  const getCardMetrics = () => {
    const container = cardsRef.current
    if (!container) return null
    const firstCard = container.querySelector<HTMLElement>('.popular__card')
    if (!firstCard) return null
    const styles = window.getComputedStyle(container)
    const gapValue = styles.columnGap || styles.gap || '0'
    const gap = Number.parseFloat(gapValue) || 0
    const cardWidth = firstCard.getBoundingClientRect().width
    const containerWidth = container.getBoundingClientRect().width
    return { container, cardWidth, gap, containerWidth }
  }

  const updateActiveDot = useCallback(() => {
    if (popularGames.length === 0) return
    const metrics = getCardMetrics()
    if (!metrics) return
    const { container, cardWidth, gap, containerWidth } = metrics
    const step = cardWidth + gap
    if (step === 0) return
    const pageStep = Math.max(containerWidth, step * pageSize)
    const index = Math.round(container.scrollLeft / pageStep)
    const pageCount = Math.max(1, Math.ceil(popularGames.length / pageSize))
    const clamped = Math.max(0, Math.min(pageCount - 1, index))
    setActiveDot(clamped)
  }, [popularGames.length, pageSize])

  const scrollToPage = useCallback((index: number) => {
    const metrics = getCardMetrics()
    if (!metrics) return
    const { container, cardWidth, gap, containerWidth } = metrics
    const step = cardWidth + gap
    if (step === 0) return
    const pageStep = Math.max(containerWidth, step * pageSize)
    container.scrollTo({
      left: index * pageStep,
      behavior: 'smooth',
    })
  }, [pageSize])

  useEffect(() => {
    if (popularGames.length === 0) return
    setActiveDot(0)
    scrollToPage(0)
  }, [popularGames.length, scrollToPage])

  const shiftPage = useCallback((direction: -1 | 1) => {
    const pageCount = Math.max(1, Math.ceil(popularGames.length / pageSize))
    if (pageCount <= 1) return
    let nextIndex = activeDot + direction
    if (nextIndex < 0) {
      nextIndex = pageCount - 1
    } else if (nextIndex >= pageCount) {
      nextIndex = 0
    }
    setActiveDot(nextIndex)
    scrollToPage(nextIndex)
  }, [activeDot, pageSize, popularGames.length, scrollToPage])

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStartXRef.current = touch.clientX
    touchLastXRef.current = touch.clientX
    swipeHandledRef.current = false
  }

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchLastXRef.current = touch.clientX
  }

  const handleTouchEnd = () => {
    const startX = touchStartXRef.current
    const lastX = touchLastXRef.current
    touchStartXRef.current = null
    touchLastXRef.current = null
    if (swipeHandledRef.current) return
    if (startX === null || lastX === null) return
    const delta = lastX - startX
    const threshold = 40
    if (Math.abs(delta) < threshold) return
    swipeHandledRef.current = true
    shiftPage(delta < 0 ? 1 : -1)
  }

  useEffect(() => {
    const container = cardsRef.current
    if (!container) return
    let rafId = 0
    const onScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        updateActiveDot()
      })
    }
    updateActiveDot()
    container.addEventListener('scroll', onScroll, { passive: true })
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', updateActiveDot)
    return () => {
      container.removeEventListener('scroll', onScroll)
      container.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', updateActiveDot)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [updateActiveDot])

  return (
    <div className="landing">
      <div className="landing__container">
        <nav className="landing__nav">
          <div className="landing__logo" onClick={() => navigate('/')}>
            <img src={logoUrl} alt="NextPlay Logo" width={128} height={128} />
          </div>
          <div>
            <div className="landing__nav-actions">
              {authUser ? (
                <button type="button" onClick={onSignOut}>
                  Sign Out
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => navigate('/user')}>
                    Sign Up
                  </button>
                  <button type="button" onClick={() => navigate('/user')}>
                    Log In
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>
        
        <section className = "hero">
          <div>
            <h1 className="hero__title">Welcome Games Find You</h1>
            <h2 className="hero__subtitle">Discover. Play. Repeat.</h2>
          </div>
          <p className="hero__description">Enter your email to find what to play</p>
          <form className="hero__form" action="">
              <input className="hero__input" type="email" placeholder="Enter your email" required />
              <button className="hero__button" type="button">
                Continue<span>&#8594;</span>
              </button>
          </form>
        </section>
        
        <section className="popular">
          <h3 className="popular__title">Most Popular Games: 2025</h3>
          {popularError ? (
            <p className="popular__status">Unable to load popular games: {popularError}</p>
          ) : popularLoading ? (
            <p className="popular__status">Loading popular games...</p>
          ) : popularGames.length === 0 ? (
            <p className="popular__status">No popular games found yet.</p>
          ) : (
            <>
              <div className="popular__carousel">
                <button
                  className="popular__arrow"
                  type="button"
                  aria-label="Previous games"
                  onClick={() => shiftPage(-1)}
                >
                  &#8592;
                </button>
                <div
                  className="popular__cards"
                  ref={cardsRef}
                  tabIndex={0}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault()
                      shiftPage(-1)
                    }
                    if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      shiftPage(1)
                    }
                  }}
                >
                  {popularGames.map((game) => (
                    <div key={game.id} className="popular__card">
                      <img
                        src={game.image}
                        alt={game.title}
                        className="popular__card-image"
                        loading="lazy"
                        onError={(event) => {
                          const target = event.currentTarget
                          target.onerror = null
                          target.src = '/landing-bg.webp'
                        }}
                      />
                      <p className="popular__card-title">{game.title}</p>
                    </div>
                  ))}
                </div>
                <button
                  className="popular__arrow"
                  type="button"
                  aria-label="Next games"
                  onClick={() => shiftPage(1)}
                >
                  &#8594;
                </button>
              </div>
              {popularGames.length > 1 && (
                <div className="popular__dots">
                  {Array.from({ length: Math.ceil(popularGames.length / pageSize) }).map((_, index) => (
                    <button
                      type="button"
                      key={`popular-page-${index + 1}`}
                      className={`popular__dot${index === activeDot ? ' active' : ''}`}
                      aria-label={`Go to page ${index + 1}`}
                      onClick={() => {
                        setActiveDot(index)
                        scrollToPage(index)
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
        <footer className="landing__footer">
          <div className="landing__footer-grid">
            <div className="landing__footer-brand">
              <div className="landing__logo">
                <img src={logoUrl} alt="NextPlay Logo" width={56} height={56} />
                <span>NextPlay</span>
              </div>
              <p>
                Find your next obsession with curated picks, social play, and smart
                recommendations.
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
                <input type="email" placeholder="you@email.com" aria-label="Email address" />
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
    </div>
  )
}

      type UserAccessProps = {
        authUser: AuthUser | null
  onAuthSuccess: (payload: unknown) => void
  onSignOut: () => void
}

      const UserAccess = ({authUser, onAuthSuccess, onSignOut}: UserAccessProps) => {
  const navigate = useNavigate()

      return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">User Access</h1>
            <p className="text-xs text-slate-400">Login or create an account</p>
          </div>
          <div className="flex items-center gap-2">
            {authUser && (
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg border border-rose-500/60 px-3 py-2 text-xs font-semibold text-rose-200 hover:border-rose-400"
              >
                Sign out
              </button>
            )}
            <Button label="Back to services" showIcon={false} onClick={() => navigate('/')} />
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl justify-center px-4 py-10">
          <div className="space-y-6">
            {authUser && (
              <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                <div className="font-semibold">Signed in</div>
                <div className="mt-1 text-xs text-emerald-100/80">
                  {authUser.username ?? authUser.email ?? 'User'}{' '}
                  {authUser.id !== undefined ? `(ID: ${authUser.id})` : '(ID unavailable)'}
                </div>
              </div>
            )}
            <Form apiBaseUrl={API_ROOT} onAuthSuccess={onAuthSuccess} />
          </div>
        </div>
      </div>
      )
}

const HealthPage = () => {
  const navigate = useNavigate()
      const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([])
      const [healthUpdatedAt, setHealthUpdatedAt] = useState<string | null>(null)
      const [healthLoading, setHealthLoading] = useState<boolean>(false)
        const [healthError, setHealthError] = useState<string | null>(null)
        const [overallOk, setOverallOk] = useState<boolean | null>(null)

  const formatDetail = (detail: unknown): string | undefined => {
    if (detail === null || detail === undefined) return undefined
        if (typeof detail === 'string') return detail
        if (typeof detail === 'object') {
      return Object.entries(detail as Record<string, unknown>)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join('\n')
    }
        return String(detail)
  }

  const loadHealth = useCallback(async () => {
          setHealthLoading(true)
    setHealthError(null)
        try {
      const response = await fetch(apiUrl('/health'))
        const text = await response.text()
        let data: HealthResponse | null = null
        try {
          data = JSON.parse(text) as HealthResponse
        } catch {
          data = null
        }

        if (!data || typeof data !== 'object') {
          setHealthError('Unexpected response from /api/health')
        setHealthChecks([])
        setOverallOk(null)
        return
      }

        const services = data.services ?? { }
        const checkedAt = data.checked_at
        ? new Date(data.checked_at).toLocaleTimeString()
        : new Date().toLocaleTimeString()

      const checks: HealthCheck[] = Object.keys(HEALTH_SERVICE_LABELS).map(key => {
        const service = services[key]
        const status: HealthStatus = service?.status === 'ok' ? 'ok' : 'error'
        const detail = formatDetail(service?.detail ?? service?.error)
        return {
          key,
          name: HEALTH_SERVICE_LABELS[key] ?? key,
        status: service ? status : 'error',
        httpStatus: service?.http_status,
        detail: detail ?? (service ? undefined : 'No data returned'),
        checkedAt,
        }
      })

        setHealthChecks(checks)
        setHealthUpdatedAt(checkedAt)
        setOverallOk(typeof data.ok === 'boolean' ? data.ok : null)
    } catch (err) {
          setHealthError(String(err))
      setHealthChecks([])
        setOverallOk(null)
    } finally {
          setHealthLoading(false)
        }
  }, [])

  useEffect(() => {
          loadHealth()
        }, [loadHealth])

        return (
        <div className="min-h-screen bg-slate-900 text-slate-100">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-xl font-semibold">System Health</h1>
              <p className="text-xs text-slate-400">
                {healthUpdatedAt ? `Last checked ${healthUpdatedAt}` : 'Run a check to see status.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={loadHealth}
                disabled={healthLoading}
                label={healthLoading ? 'Checking...' : 'Refresh'}
                showIcon={false}
              />
              <Button label="Back to services" showIcon={false} onClick={() => navigate('/')} />
            </div>
          </div>
          <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>Aggregate: {overallOk === null ? 'unknown' : overallOk ? 'healthy' : 'issues detected'}</span>
              <span>Endpoint: {apiUrl('/health')}</span>
            </div>

            {healthError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {healthError}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 justify-items-center">
              {healthChecks.map(check => {
                const descriptionLines = [
                  check.status === 'loading' ? 'Status: checking...' : `Status: ${check.status}`,
                  check.httpStatus ? `HTTP: ${check.httpStatus}` : null,
                  check.detail ? `Details: ${check.detail}` : null,
                  check.checkedAt ? `Checked: ${check.checkedAt}` : null,
                ].filter(Boolean)

                return (
                  <Card
                    key={check.key}
                    title={check.name}
                    description={descriptionLines.join('\n')}
                    variant="info"
                  />
                )
              })}
            </div>
          </main>
        </div>
        )
}

        function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
        if (stored) {
        const parsed = JSON.parse(stored) as AuthUser
        setAuthUser(parsed)
      }
    } catch {
          setAuthUser(null)
        }
  }, [])

  const handleAuthSuccess = (payload: unknown) => {
    const user = coerceAuthUser(payload)
        if (!user) return
        setAuthUser(user)
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
        } catch {
          // Ignore storage errors (e.g., private mode)
        }
  }

  const handleSignOut = () => {
          setAuthUser(null)
    try {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        } catch {
          // Ignore storage errors
        }
  }

        return (
        <Routes>
          <Route path="/" element={<Home authUser={authUser} onSignOut={handleSignOut} />} />
          <Route path="/games" element={<Game />} />
          <Route path="/games/:gameId" element={<Game />} />
          <Route
            path="/user"
            element={
              <UserAccess authUser={authUser} onAuthSuccess={handleAuthSuccess} onSignOut={handleSignOut} />
            }
          />
          <Route path="/health" element={<HealthPage />} />
          <Route path="*" element={<Home authUser={authUser} onSignOut={handleSignOut} />} />
        </Routes>
        )
}

        export default App
