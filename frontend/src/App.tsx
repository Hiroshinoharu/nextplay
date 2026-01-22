import { useEffect, useState } from 'react'
import './App.css'
import Form from './components/Form'
import Game from './game'

type ServiceKey = 'game' | 'recommender' | 'user'

type AuthUser = {
  id?: number
  username?: string
  email?: string
  steam_linked?: boolean
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8084').replace(/\/+$/, '')
const AUTH_STORAGE_KEY = 'nextplay_user'

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

const linkjs = [
  {
    name: 'Game Service',
    url: `${API_BASE_URL}/api/games`,
    description: 'Browse and manage game data.',
    key: 'game' as ServiceKey,
  },
  {
    name: 'Recommender Service',
    url: `${API_BASE_URL}/api/recommend`,
    description: 'Get personalized recommendations.',
    key: 'recommender' as ServiceKey,
  },
  {
    name: 'User Service',
    url: `${API_BASE_URL}/api/users`,
    description: 'User profiles and authentication.',
    key: 'user' as ServiceKey,
  },
]

function App() {
  const [activeService, setActiveService] = useState<ServiceKey | null>(null)
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

  if (activeService === 'game') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <button
            type="button"
            onClick={() => setActiveService(null)}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
          >
            Back to services
          </button>
        </div>
        <Game />
      </div>
    )
  }

  if (activeService === 'user') {
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
                onClick={handleSignOut}
                className="rounded-lg border border-rose-500/60 px-3 py-2 text-xs font-semibold text-rose-200 hover:border-rose-400"
              >
                Sign out
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveService(null)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
            >
              Back to services
            </button>
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
            <Form apiBaseUrl={API_BASE_URL} onAuthSuccess={handleAuthSuccess} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold">NextPlay</h2>
          <span className="text-xs uppercase tracking-widest text-slate-400">Service Console</span>
        </div>
      </nav>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-slate-900">Welcome</h1>
          <p className="text-base text-slate-600">
            Quick links to your local services.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {linkjs.map(service => (
            service.key === 'game' || service.key === 'user' ? (
              <button
                key={service.name}
                type="button"
                onClick={() => setActiveService(service.key)}
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
                key={service.name}
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
            )
          ))}
        </section>
      </main>
    </div>
  )
}

export default App
