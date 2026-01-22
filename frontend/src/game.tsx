import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from './components/Button'
import Card from './components/card'

type GameItem = {
  id: number
  name: string
  description?: string
  release_date?: string
  genre?: string
  publishers?: string
  cover_image?: string
}

type ResponseState = {
  status: number
  statusText: string
  durationMs: number
  body: string
  headers: string
}

const DEFAULT_HEADERS = 'Content-Type: application/json'
const DEFAULT_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8084').replace(/\/+$/, '')

const normalizeCoverUrl = (url?: string) => {
  if (!url) return null
  if (url.startsWith('//')) return `https:${url}`
  return url
}

const parseReleaseDate = (value?: string) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function parseHeaders(raw: string): Record<string, string> {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const index = line.indexOf(':')
      if (index === -1) return acc
      const key = line.slice(0, index).trim()
      const value = line.slice(index + 1).trim()
      if (key) acc[key] = value
      return acc
    }, {})
}

function toHeaderText(headers: Headers): string {
  const lines: string[] = []
  headers.forEach((value, key) => {
    lines.push(`${key}: ${value}`)
  })
  return lines.join('\n')
}

function Game() {
  const navigate = useNavigate()
  const { gameId } = useParams()
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE_URL)
  const [path, setPath] = useState<string>('/')
  const [method, setMethod] = useState<string>('GET')
  const [headers, setHeaders] = useState<string>(DEFAULT_HEADERS)
  const [body, setBody] = useState<string>('{"ping":"pong"}')
  const [response, setResponse] = useState<ResponseState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [games, setGames] = useState<GameItem[]>([])
  const [gamesError, setGamesError] = useState<string | null>(null)
  const [gamesLoading, setGamesLoading] = useState<boolean>(false)
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null)
  const [selectedGameError, setSelectedGameError] = useState<string | null>(null)
  const [selectedGameLoading, setSelectedGameLoading] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const parsedGameId = gameId ? Number(gameId) : null
  const hasGameId = parsedGameId !== null && !Number.isNaN(parsedGameId)

  const gamesUrl = useMemo(() => {
    const trimmedBase = baseUrl.replace(/\/+$/, '')
    return `${trimmedBase}/api/games`
  }, [baseUrl])

  const fullUrl = useMemo(() => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    const trimmedBase = baseUrl.replace(/\/+$/, '')
    const trimmedPath = path.startsWith('/') ? path : `/${path}`
    if (!trimmedBase) return trimmedPath
    return `${trimmedBase}${trimmedPath}`
  }, [baseUrl, path])

  const loadGames = async () => {
    setGamesLoading(true)
    setGamesError(null)
    try {
      const responseValue = await fetch(gamesUrl)
      if (!responseValue.ok) {
        setGamesError(`Failed to load games: ${responseValue.status}`)
        setGames([])
        return
      }
      const data = (await responseValue.json()) as GameItem[]
      if (!Array.isArray(data)) {
        setGamesError('Unexpected response for /api/games')
        setGames([])
        return
      }
      setGames(data)
    } catch (err) {
      setGamesError(`${err}`)
      setGames([])
    } finally {
      setGamesLoading(false)
    }
  }

  useEffect(() => {
    loadGames()
  }, [gamesUrl])

  useEffect(() => {
    if (!gameId) {
      setSelectedGame(null)
      setSelectedGameError(null)
      setSelectedGameLoading(false)
      return
    }
    const numericId = Number(gameId)
    if (Number.isNaN(numericId)) {
      setSelectedGame(null)
      setSelectedGameError('Invalid game id.')
      setSelectedGameLoading(false)
      return
    }
    let isActive = true
    const fetchDetail = async () => {
      setSelectedGameLoading(true)
      setSelectedGameError(null)
      try {
        const trimmedBase = baseUrl.replace(/\/+$/, '')
        const responseValue = await fetch(`${trimmedBase}/api/games/${numericId}`)
        if (!responseValue.ok) {
          if (isActive) {
            setSelectedGameError(`Failed to load game: ${responseValue.status}`)
          }
          return
        }
        const data = (await responseValue.json()) as GameItem
        if (isActive) {
          setSelectedGame(data)
        }
      } catch (err) {
        if (isActive) {
          setSelectedGameError(`${err}`)
        }
      } finally {
        if (isActive) {
          setSelectedGameLoading(false)
        }
      }
    }
    fetchDetail()
    return () => {
      isActive = false
    }
  }, [gameId, baseUrl])

  useEffect(() => {
    const message = gamesError || error || selectedGameError
    if (!message) return
    setToastMessage(message)
    const timeout = window.setTimeout(() => {
      setToastMessage(null)
    }, 4500)
    return () => window.clearTimeout(timeout)
  }, [gamesError, error, selectedGameError])

  const sendRequest = async () => {
    setIsLoading(true)
    setError(null)
    setResponse(null)

    const start = performance.now()
    try {
      const headerObject = parseHeaders(headers)
      const shouldSendBody = method !== 'GET' && method !== 'HEAD'
      const responseValue = await fetch(fullUrl, {
        method,
        headers: headerObject,
        body: shouldSendBody ? body : undefined,
      })
      const responseText = await responseValue.text()
      const durationMs = Math.round(performance.now() - start)

      setResponse({
        status: responseValue.status,
        statusText: responseValue.statusText,
        durationMs,
        body: responseText,
        headers: toHeaderText(responseValue.headers),
      })
    } catch (err) {
      const durationMs = Math.round(performance.now() - start)
      setError(`${err}`)
      setResponse({
        status: 0,
        statusText: 'Request failed',
        durationMs,
        body: '',
        headers: '',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const clearResponse = () => {
    setResponse(null)
    setError(null)
  }

  const openGameDetail = (targetId: number) => {
    navigate(`/games/${targetId}`)
  }

  const closeGameDetail = () => {
    navigate('/games')
  }

  const featuredGame = selectedGame ?? games[0] ?? null
  const featuredCover = normalizeCoverUrl(featuredGame?.cover_image ?? undefined)
  const upcomingGames = games
    .filter(game => {
      const date = parseReleaseDate(game.release_date)
      return date ? date >= new Date() : false
    })
    .slice(0, 10)
  const topTenGames = games.slice(0, 10)
  const discoveryGames = games.slice(10, 20)

  return (
    <div className="min-h-screen bg-[#0b141a] text-slate-100">
      <header className="relative overflow-hidden border-b border-[#132029]">
        {featuredCover && (
          <div className="absolute inset-0">
            <img
              src={featuredCover}
              alt={featuredGame?.name || 'Featured game'}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b141a] via-[#0b141a]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b141a] via-[#0b141a]/60 to-transparent" />
          </div>
        )}
        <div className="relative z-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="text-xs uppercase tracking-[0.35em] text-slate-400">NextPlay</div>
              <span className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Library</span>
            </div>
            <Button label="Back to services" showIcon={false} onClick={() => navigate('/')} />
          </div>
          <div className="mx-auto max-w-6xl px-6 pb-16 pt-6">
            {featuredGame ? (
              <div className="max-w-xl space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
                  Featured today
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-white">
                  {featuredGame.name}
                </h1>
                <p className="text-sm text-slate-300">
                  {featuredGame.description || 'A fresh pick from your library.'}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <span>{featuredGame.genre ?? 'Genre: n/a'}</span>
                  <span>•</span>
                  <span>{featuredGame.publishers ?? 'Publisher: n/a'}</span>
                  <span>•</span>
                  <span>
                    {featuredGame.release_date
                      ? `Release: ${featuredGame.release_date}`
                      : 'Release: n/a'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    label={selectedGameLoading ? 'Loading...' : 'View details'}
                    showIcon={false}
                    disabled={!featuredGame.id}
                    onClick={() => {
                      if (featuredGame?.id) openGameDetail(featuredGame.id)
                    }}
                  />
                  <Button
                    label={gamesLoading ? 'Refreshing...' : 'Refresh list'}
                    showIcon={false}
                    onClick={loadGames}
                    disabled={gamesLoading}
                  />
                </div>
                {hasGameId && (
                  <button
                    type="button"
                    onClick={closeGameDetail}
                    className="text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-slate-200"
                  >
                    Back to list
                  </button>
                )}
              </div>
            ) : (
              <div className="max-w-xl space-y-3 text-slate-300">
                <h1 className="text-3xl font-semibold text-white">Loading games...</h1>
                <p>We will surface a featured title as soon as your API responds.</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        {gamesError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {gamesError}
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Upcoming Games</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Preview</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {(upcomingGames.length ? upcomingGames : games.slice(0, 10)).map(game => {
              const coverSrc = normalizeCoverUrl(game.cover_image)
              return (
                <Card
                  key={`upcoming-${game.id}`}
                  title={
                    <button
                      type="button"
                      className="card__link"
                      onClick={() => openGameDetail(game.id)}
                    >
                      {game.name || 'Untitled'}
                    </button>
                  }
                  description={game.release_date ? `Release: ${game.release_date}` : 'Release: n/a'}
                  icon={
                    coverSrc ? (
                      <img
                        src={coverSrc}
                        alt={game.name || 'Game cover'}
                        className="card__image"
                        loading="lazy"
                      />
                    ) : undefined
                  }
                />
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Top 10 of all time</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Ranked</span>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {topTenGames.map((game, index) => {
              const coverSrc = normalizeCoverUrl(game.cover_image)
              return (
                <div key={`top-${game.id}`} className="relative flex items-end">
                  <span className="absolute -left-4 bottom-3 text-5xl font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <Card
                    title={
                      <button
                        type="button"
                        className="card__link"
                        onClick={() => openGameDetail(game.id)}
                      >
                        {game.name || 'Untitled'}
                      </button>
                    }
                    description={game.genre ? `Genre: ${game.genre}` : 'Genre: n/a'}
                    icon={
                      coverSrc ? (
                        <img
                          src={coverSrc}
                          alt={game.name || 'Game cover'}
                          className="card__image"
                          loading="lazy"
                        />
                      ) : undefined
                    }
                  />
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Explore more</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Discover</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {(discoveryGames.length ? discoveryGames : games.slice(0, 10)).map(game => {
              const descriptionLines = [
                game.release_date ? `Release: ${game.release_date}` : null,
                game.genre ? `Genre: ${game.genre}` : null,
              ].filter(Boolean)
              const coverSrc = normalizeCoverUrl(game.cover_image)

              return (
                <Card
                  key={`discover-${game.id}`}
                  title={
                    <button
                      type="button"
                      className="card__link"
                      onClick={() => openGameDetail(game.id)}
                    >
                      {game.name || 'Untitled'}
                    </button>
                  }
                  description={descriptionLines.join('\n')}
                  icon={
                    coverSrc ? (
                      <img
                        src={coverSrc}
                        alt={game.name || 'Game cover'}
                        className="card__image"
                        loading="lazy"
                      />
                    ) : undefined
                  }
                />
              )
            })}
          </div>
        </section>

        <details className="rounded-2xl border border-[#162530] bg-[#0f1c22] p-5">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Developer console
          </summary>
          <div className="mt-4 space-y-6">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBaseUrl(DEFAULT_BASE_URL)}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-700"
                >
                  Gateway
                </button>
                <button
                  type="button"
                  onClick={() => setPath('/api/games')}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-700"
                >
                  /api/games
                </button>
                <button
                  type="button"
                  onClick={() => setPath('/api/recommend')}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-700"
                >
                  /api/recommend
                </button>
                <button
                  type="button"
                  onClick={() => setPath('/api/users')}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-700"
                >
                  /api/users
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                <label className="text-sm text-slate-300">Base URL</label>
                <input
                  value={baseUrl}
                  onChange={event => setBaseUrl(event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder={DEFAULT_BASE_URL}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                <label className="text-sm text-slate-300">Path</label>
                <input
                  value={path}
                  onChange={event => setPath(event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder="/health"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                <label className="text-sm text-slate-300">Method</label>
                <div className="flex flex-wrap gap-2">
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMethod(item)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                        method === item
                          ? 'bg-sky-500 text-slate-900'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                <label className="text-sm text-slate-300">Headers</label>
                <textarea
                  value={headers}
                  onChange={event => setHeaders(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder="Content-Type: application/json"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                <label className="text-sm text-slate-300">Body</label>
                <textarea
                  value={body}
                  onChange={event => setBody(event.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder='{"ping":"pong"}'
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={sendRequest}
                  disabled={isLoading}
                  className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? 'Sending...' : 'Send Request'}
                </button>
                <button
                  type="button"
                  onClick={clearResponse}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
                >
                  Clear
                </button>
                <div className="text-sm text-slate-400">
                  Target: <span className="text-slate-200">{fullUrl}</span>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Response</h2>
                {response && (
                  <div className="text-xs text-slate-400">
                    {response.status || 'ERR'} {response.statusText} • {response.durationMs}ms
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Headers</div>
                  <textarea
                    readOnly
                    value={response?.headers ?? ''}
                    rows={8}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Body</div>
                  <textarea
                    readOnly
                    value={response?.body ?? ''}
                    rows={8}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>
            </section>
          </div>
        </details>
      </main>

      {toastMessage && (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

export default Game
