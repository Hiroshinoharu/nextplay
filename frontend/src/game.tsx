import { useEffect, useMemo, useState, type CSSProperties } from 'react'
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
  story?: string
  screenshots?: string[]
  trailers?: string[]
  trailer_url?: string
}

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

const toEmbedUrl = (value: string) => {
  if (!value) return null
  if (value.includes('youtube.com/watch')) {
    try {
      const url = new URL(value)
      const videoId = url.searchParams.get('v')
      return videoId ? `https://www.youtube.com/embed/${videoId}` : value
    } catch {
      return value
    }
  }
  if (value.includes('youtu.be/')) {
    const id = value.split('youtu.be/')[1]?.split(/[?&]/)[0]
    return id ? `https://www.youtube.com/embed/${id}` : value
  }
  return value
}

const horizontalRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  gap: '20px',
  overflowX: 'auto',
  paddingBottom: '0.5rem',
  paddingRight: '0.5rem',
}

const cardItemStyle: CSSProperties = {
  flex: '0 0 200px',
}

const rankStyle: CSSProperties = {
  position: 'absolute',
  left: '-0.5rem',
  top: '-1.25rem',
  fontSize: '3rem',
  fontWeight: 600,
  color: '#475569',
}

function Game() {
  const navigate = useNavigate()
  const { gameId } = useParams()
  const [baseUrl] = useState<string>(DEFAULT_BASE_URL)
  const [error] = useState<string | null>(null)
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

  if (hasGameId) {
    const detailCover = normalizeCoverUrl(selectedGame?.cover_image ?? undefined)
    const trailerUrl =
      selectedGame?.trailer_url ||
      selectedGame?.trailers?.[0] ||
      null
    const embedUrl = trailerUrl ? toEmbedUrl(trailerUrl) : null
    const screenshots =
      selectedGame?.screenshots?.map(normalizeCoverUrl).filter(Boolean) as string[] | undefined
    const mediaGallery = screenshots && screenshots.length
      ? screenshots
      : detailCover
        ? [detailCover]
        : []
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f9f6f0] via-[#f5efe5] to-[#f1e7d8] text-[#1c1f24]">
        <header className="border-b border-[#e8ddcd] bg-[#f7f2ea]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="text-xs uppercase tracking-[0.35em] text-[#8a6d4e]">NextPlay</div>
              <span className="text-[11px] uppercase tracking-[0.25em] text-[#a48b6a]">Game Detail</span>
            </div>
            <div className="flex items-center gap-3">
              <Button label="Back to services" showIcon={false} onClick={() => navigate('/')} />
              <button
                type="button"
                onClick={closeGameDetail}
                className="text-xs uppercase tracking-[0.3em] text-[#7f6a51] hover:text-[#5a4a38]"
              >
                Back to list
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">
          {selectedGameLoading && (
            <div className="rounded-2xl border border-[#e1d2bd] bg-[#fff7ee] p-8 text-[#5a4a38]">
              Loading game details...
            </div>
          )}

          {selectedGameError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">
              {selectedGameError}
            </div>
          )}

          {selectedGame && !selectedGameLoading && (
            <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
              <div className="relative overflow-hidden rounded-2xl border border-[#e1d2bd] bg-[#fff7ee] shadow-lg">
                {detailCover ? (
                  <img
                    src={detailCover}
                    alt={selectedGame.name || 'Game cover'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-96 items-center justify-center text-[#a28c74]">
                    No cover available
                  </div>
                )}
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#b7833f]">Selected game</p>
                  <h1 className="mt-2 text-3xl font-semibold text-[#1b1a17]">{selectedGame.name}</h1>
                </div>
                <p className="text-sm text-[#4a3c2b]">
                  {selectedGame.description || selectedGame.story || 'No description available yet.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#e1d2bd] bg-[#fff7ee] px-4 py-3 text-sm text-[#5a4a38]">
                    <div className="text-xs uppercase tracking-wider text-[#a28c74]">Genre</div>
                    <div className="mt-1 text-[#2a2118]">{selectedGame.genre ?? 'n/a'}</div>
                  </div>
                  <div className="rounded-xl border border-[#e1d2bd] bg-[#fff7ee] px-4 py-3 text-sm text-[#5a4a38]">
                    <div className="text-xs uppercase tracking-wider text-[#a28c74]">Publisher</div>
                    <div className="mt-1 text-[#2a2118]">{selectedGame.publishers ?? 'n/a'}</div>
                  </div>
                  <div className="rounded-xl border border-[#e1d2bd] bg-[#fff7ee] px-4 py-3 text-sm text-[#5a4a38]">
                    <div className="text-xs uppercase tracking-wider text-[#a28c74]">Release</div>
                    <div className="mt-1 text-[#2a2118]">{selectedGame.release_date ?? 'n/a'}</div>
                  </div>
                  <div className="rounded-xl border border-[#e1d2bd] bg-[#fff7ee] px-4 py-3 text-sm text-[#5a4a38]">
                    <div className="text-xs uppercase tracking-wider text-[#a28c74]">Game ID</div>
                    <div className="mt-1 text-[#2a2118]">{selectedGame.id}</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#e1d2bd] bg-[#fffaf4] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b7833f]">
                      Screenshots
                    </h2>
                    <span className="text-xs text-[#a28c74]">
                      {mediaGallery.length ? `${mediaGallery.length} shots` : 'No shots'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {mediaGallery.length ? (
                      mediaGallery.slice(0, 4).map((shot, index) => (
                        <div key={`${shot}-${index}`} className="overflow-hidden rounded-xl border border-[#eadcc8] bg-white">
                          <img src={shot} alt={`${selectedGame.name} screenshot ${index + 1}`} className="h-40 w-full object-cover" />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-xl border border-dashed border-[#e1d2bd] bg-white/60 p-6 text-sm text-[#a28c74]">
                        No screenshots available yet.
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#e1d2bd] bg-[#fffaf4] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b7833f]">
                      Trailer
                    </h2>
                    <span className="text-xs text-[#a28c74]">
                      {embedUrl ? 'Now playing' : 'No trailer'}
                    </span>
                  </div>
                  <div className="mt-4">
                    {embedUrl ? (
                      <div className="aspect-video overflow-hidden rounded-xl border border-[#eadcc8] bg-white">
                        <iframe
                          src={embedUrl}
                          title={`${selectedGame.name} trailer`}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#e1d2bd] bg-white/60 p-6 text-sm text-[#a28c74]">
                        Trailer link not available yet.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button label="Refresh details" showIcon={false} onClick={loadGames} />
                  <Button label="Back to list" showIcon={false} onClick={closeGameDetail} />
                </div>
              </div>
            </div>
          )}
        </main>

        {toastMessage && (
          <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-lg">
            {toastMessage}
          </div>
        )}
      </div>
    )
  }

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
          <div className="flex flex-nowrap gap-5 overflow-x-auto pb-2 pr-2" style={horizontalRowStyle}>
            {(upcomingGames.length ? upcomingGames : games.slice(0, 10)).map(game => {
              const coverSrc = normalizeCoverUrl(game.cover_image)
              return (
                <div key={`upcoming-${game.id}`} className="flex-none w-[200px]" style={cardItemStyle}>
                  <Card
                    title={game.name || 'Untitled'}
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
                    onClick={() => openGameDetail(game.id)}
                    ariaLabel={`View details for ${game.name || 'game'}`}
                  />
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Top 10 of all time</h2>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Ranked</span>
          </div>
          <div className="flex flex-nowrap gap-6 overflow-x-auto pb-2 pr-2" style={horizontalRowStyle}>
            {topTenGames.map((game, index) => {
              const coverSrc = normalizeCoverUrl(game.cover_image)
              return (
                <div key={`top-${game.id}`} className="relative flex-none w-[200px]" style={{ ...cardItemStyle, position: 'relative' }}>
                  <span className="absolute -left-2 -top-5 text-5xl font-semibold text-slate-600" style={rankStyle}>
                    {index + 1}
                  </span>
                  <Card
                    title={game.name || 'Untitled'}
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
                    onClick={() => openGameDetail(game.id)}
                    ariaLabel={`View details for ${game.name || 'game'}`}
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
          <div className="flex flex-nowrap gap-5 overflow-x-auto pb-2 pr-2" style={horizontalRowStyle}>
            {(discoveryGames.length ? discoveryGames : games.slice(0, 10)).map(game => {
              const descriptionLines = [
                game.release_date ? `Release: ${game.release_date}` : null,
                game.genre ? `Genre: ${game.genre}` : null,
              ].filter(Boolean)
              const coverSrc = normalizeCoverUrl(game.cover_image)

              return (
                <div key={`discover-${game.id}`} className="flex-none w-[200px]" style={cardItemStyle}>
                  <Card
                    title={game.name || 'Untitled'}
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
                    onClick={() => openGameDetail(game.id)}
                    ariaLabel={`View details for ${game.name || 'game'}`}
                  />
                </div>
              )
            })}
          </div>
        </section>

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
