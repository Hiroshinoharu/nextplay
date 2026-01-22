import { useEffect, useMemo, useState } from 'react'
import Button from './components/Button'
import Card from './components/card'

type GameItem = {
  id: number
  name: string
  description?: string
  release_date?: string
  genre?: string
  publishers?: string
}

type ResponseState = {
  status: number
  statusText: string
  durationMs: number
  body: string
  headers: string
}

const DEFAULT_HEADERS = 'Content-Type: application/json'

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
  const [baseUrl, setBaseUrl] = useState<string>('http://localhost:8084')
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/60">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="text-2xl font-semibold tracking-tight">Backend Test Console</h1>
          <p className="mt-1 text-sm text-slate-400">
            Fire quick requests against local services and inspect responses.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Games</h2>
              <p className="text-xs text-slate-400">{gamesUrl}</p>
            </div>
            <Button
              onClick={loadGames}
              disabled={gamesLoading}
              label={gamesLoading ? 'Loading...' : 'Refresh'}
              showIcon={false}
            />
          </div>

          {gamesError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {gamesError}
            </div>
          )}

          {!gamesError && games.length === 0 && !gamesLoading && (
            <div className="text-sm text-slate-400">No games returned.</div>
          )}

          <div className="grid gap-6 md:grid-cols-2 justify-items-center">
            {games.map(game => {
              const descriptionLines = [
                game.release_date ? `Release: ${game.release_date}` : 'Release: n/a',
                game.genre ? `Genre: ${game.genre}` : null,
                game.publishers ? `Publishers: ${game.publishers}` : null,
                game.description ? `\n${game.description}` : null,
              ].filter(Boolean)

              return (
                <Card
                  key={game.id}
                  title={
                    <a
                      href={`game.html?gameId=${encodeURIComponent(String(game.id))}`}
                      className="card__link"
                    >
                      {game.name || 'Untitled'}
                    </a>
                  }
                  description={descriptionLines.join('\n')}
                />
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBaseUrl('http://localhost:8081')}
              className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-700"
            >
              Gateway 8084
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
              placeholder="http://localhost:8084"
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

        <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-5 space-y-4">
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
      </main>
    </div>
  )
}

export default Game
