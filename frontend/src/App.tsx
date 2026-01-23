import { useCallback, useEffect, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import Button from './components/Button'
import Card from './components/card'
import Form from './components/Form'
import Game from './game'

type ServiceKey = 'health' | 'game' | 'recommender' | 'user'

type AuthUser = {
  id?: number
  username?: string
  email?: string
  steam_linked?: boolean
}

type ServiceCard = {
  key: ServiceKey
  name: string
  description: string
  path?: string
  url?: string
}

type HealthStatus = 'idle' | 'loading' | 'ok' | 'error'

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

// Base URL for API requests, trimmed of trailing slashes
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8084').replace(/\/+$/, '')
// Key for storing auth user in localStorage
const AUTH_STORAGE_KEY = 'nextplay_user'

const SERVICE_CARDS: ServiceCard[] = [
  {
    key: 'health',
    name: 'System Health',
    description: 'Check gateway + service status.',
    path: '/health',
    url: `${API_BASE_URL}/api/health`,
  },
  {
    key: 'game',
    name: 'Game Service',
    description: 'Browse and manage game data.',
    path: '/games',
    url: `${API_BASE_URL}/api/games`,
  },
  {
    key: 'user',
    name: 'User Service',
    description: 'User profiles and authentication.',
    path: '/user',
    url: `${API_BASE_URL}/api/users`,
  },
  {
    key: 'recommender',
    name: 'Recommender Service',
    description: 'Get personalized recommendations.',
    url: `${API_BASE_URL}/api/recommend`,
  },
]

const HEALTH_SERVICE_LABELS: Record<string, string> = {
  gateway: 'Gateway',
  game: 'Game Service',
  user: 'User Service',
  recommender: 'Recommender Service',
}

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
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold">NextPlay</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-widest text-slate-400">Service Console</span>
            {authUser ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Signed in as {authUser.username ?? authUser.email ?? 'User'}
                  {authUser.id !== undefined ? ` (ID: ${authUser.id})` : ''}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:border-slate-300"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/user')}
                className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:border-slate-300"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-slate-900">Welcome</h1>
          <p className="text-base text-slate-600">Quick links to your local services.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {SERVICE_CARDS.map(service =>
            service.path ? (
              <button
                key={service.key}
                type="button"
                onClick={() => navigate(service.path!)}
                className="text-left rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-slate-900">{service.name}</h3>
                  <span className="text-xs text-slate-400">Open</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{service.description}</p>
                <p className="mt-3 text-xs text-slate-400">In-app view</p>
              </button>
            ) : (
              <a
                key={service.key}
                href={service.url}
                className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-slate-900">{service.name}</h3>
                  <span className="text-xs text-slate-400">Open</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{service.description}</p>
                <p className="mt-3 text-xs text-slate-400">{service.url}</p>
              </a>
            ),
          )}
        </section>
      </main>
    </div>
  )
}

type UserAccessProps = {
  authUser: AuthUser | null
  onAuthSuccess: (payload: unknown) => void
  onSignOut: () => void
}

const UserAccess = ({ authUser, onAuthSuccess, onSignOut }: UserAccessProps) => {
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
          <Form apiBaseUrl={API_BASE_URL} onAuthSuccess={onAuthSuccess} />
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
      const response = await fetch(`${API_BASE_URL}/api/health`)
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

      const services = data.services ?? {}
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
          <span>Endpoint: {API_BASE_URL}/api/health</span>
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
