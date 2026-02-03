import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from './components/Button'

// Define the structure of a game item based on expected API response fields
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
  media?: GameMedia[]
}

type GameMedia = {
  igdb_id?: number
  media_type?: string
  url?: string
  sort_order?: number
}

// Determine the default base URL for the API from environment variables
const RAW_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')
const API_ROOT = RAW_BASE_URL.endsWith('/api') ? RAW_BASE_URL.slice(0, -4) : RAW_BASE_URL

// Normalize cover image URLs to ensure they are absolute and use HTTPS
const normalizeCoverUrl = (url?: string) => {
  if (!url) return null
  if (url.startsWith('//')) return `https:${url}`
  return url
}

// Convert standard YouTube URLs into embed URLs for iframe usage
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

// Main Game component handling individual game detail view
function Game() {
  // Sets a navigation hook and state variables
  const navigate = useNavigate()
  const { gameId } = useParams()
  const [baseUrl] = useState<string>(API_ROOT)
  const [game, setGame] = useState<GameItem | null>(null)
  const [gameError, setGameError] = useState<string | null>(null)
  const [gameLoading, setGameLoading] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const numericId = gameId ? Number(gameId) : null
  const isValidId = numericId !== null && !Number.isNaN(numericId)

  // Construct the game detail API URL using the base URL and memoization
  const gameUrl = useMemo(() => {
    if (!isValidId || numericId === null) return null
    const trimmedBase = baseUrl.replace(/\/+$/, '')
    const root = trimmedBase.endsWith('/api') ? trimmedBase.slice(0, -4) : trimmedBase
    return `${root}/api/games/${numericId}`
  }, [baseUrl, isValidId, numericId])

  // Function to load the game details from the API
  const loadGame = useCallback(async (signal?: AbortSignal) => {
    if (!gameUrl) {
      setGame(null)
      setGameError(gameId ? 'Invalid game id.' : 'Missing game id.')
      return
    }
    setGameLoading(true)
    setGameError(null)
    try {
      const responseValue = await fetch(gameUrl, signal ? { signal } : undefined)
      if (!responseValue.ok) {
        setGameError(`Failed to load game: ${responseValue.status}`)
        return
      }
      const data = (await responseValue.json()) as GameItem
      setGame(data)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setGameError(`${err}`)
    } finally {
      if (!signal?.aborted) {
        setGameLoading(false)
      }
    }
  }, [gameUrl, gameId])

  // Load game details when the component mounts or when gameUrl/gameId changes
  useEffect(() => {
    const controller = new AbortController()
    loadGame(controller.signal)
    return () => controller.abort()
  }, [loadGame])

  useEffect(() => {
    if (!gameError) return
    setToastMessage(gameError)
    const timeout = window.setTimeout(() => {
      setToastMessage(null)
    }, 4500)
    return () => window.clearTimeout(timeout)
  }, [gameError])

  const closeGameDetail = () => {
    navigate('/games')
  }

  // Prepare media items for display
  const mediaItems = Array.isArray(game?.media) ? game?.media : []
  const mediaShots = mediaItems
    .filter(item => item.media_type === 'screenshot' || item.media_type === 'artwork')
    .map(item => normalizeCoverUrl(item.url))
    .filter(Boolean) as string[]
  const trailerFromMedia =
    mediaItems.find(item => item.media_type === 'trailer')?.url ?? null

  const detailCover = normalizeCoverUrl(game?.cover_image ?? undefined)
  const trailerUrl = game?.trailer_url || game?.trailers?.[0] || trailerFromMedia
  const embedUrl = trailerUrl ? toEmbedUrl(trailerUrl) : null
  const screenshots =
    game?.screenshots?.map(normalizeCoverUrl).filter(Boolean) as string[] | undefined
  const mediaGallery = screenshots && screenshots.length
    ? screenshots
    : mediaShots.length
      ? mediaShots
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
            <Button label="Back to services" showIcon={false} onClick={() => navigate('/games')} />
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
        {gameLoading && (
          <div className="rounded-2xl border border-[#e1d2bd] bg-[#fff7ee] p-8 text-[#5a4a38]">
            Loading game details...
          </div>
        )}

        {gameError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            {gameError}
          </div>
        )}

        {game && !gameLoading && (
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <div className="relative overflow-hidden rounded-2xl border border-[#e1d2bd] bg-[#fff7ee] shadow-lg">
              {detailCover ? (
                <img
                  src={detailCover}
                  alt={game.name || 'Game cover'}
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
                <h1 className="mt-2 text-3xl font-semibold text-[#1b1a17]">{game.name}</h1>
              </div>
              <p className="text-sm text-[#4a3c2b]">
                {game.description || game.story || 'No description available yet.'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#e1d2bd] bg-[#fff7ee] px-4 py-3 text-sm text-[#5a4a38]">
                  <div className="text-xs uppercase tracking-wider text-[#a28c74]">Genre</div>
                  <div className="mt-1 text-[#2a2118]">{game.genre ?? 'n/a'}</div>
                </div>
                <div className="rounded-xl border border-[#e1d2bd] bg-[#fff7ee] px-4 py-3 text-sm text-[#5a4a38]">
                  <div className="text-xs uppercase tracking-wider text-[#a28c74]">Publisher</div>
                  <div className="mt-1 text-[#2a2118]">{game.publishers ?? 'n/a'}</div>
                </div>
                <div className="rounded-xl border border-[#e1d2bd] bg-[#fff7ee] px-4 py-3 text-sm text-[#5a4a38]">
                  <div className="text-xs uppercase tracking-wider text-[#a28c74]">Release</div>
                  <div className="mt-1 text-[#2a2118]">{game.release_date ?? 'n/a'}</div>
                </div>
                <div className="rounded-xl border border-[#e1d2bd] bg-[#fff7ee] px-4 py-3 text-sm text-[#5a4a38]">
                  <div className="text-xs uppercase tracking-wider text-[#a28c74]">Game ID</div>
                  <div className="mt-1 text-[#2a2118]">{game.id}</div>
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
                        <img src={shot} alt={`${game.name} screenshot ${index + 1}`} className="h-40 w-full object-cover" />
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
                        title={`${game.name} trailer`}
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
                <Button label="Refresh details" showIcon={false} onClick={() => loadGame()} />
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

export default Game
