import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from './components/Button'
import './game.css'

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
  platform_names?: string[]
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

// Parse release date strings into Date objects, returning null for invalid or missing dates
const parseReleaseDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatReleaseDate = (value?: string) => {
  const parsed = parseReleaseDate(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

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
  const loadGame = useCallback(
    async (signal?: AbortSignal) => {
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
    },
    [gameUrl, gameId],
  )

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
    .filter((item) => item.media_type === 'screenshot' || item.media_type === 'artwork')
    .map((item) => normalizeCoverUrl(item.url))
    .filter(Boolean) as string[]
  const trailerFromMedia =
    mediaItems.find((item) => item.media_type === 'trailer')?.url ?? null

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
    <div className="game-page">
      <div className="game-shell">
        <header className="game-header">
          <div className="game-brand">
            <span className="game-brand__title">NextPlay</span>
            <span className="game-brand__subtitle">Game Detail</span>
          </div>
          <div className="game-header__actions">
            <Button label="Back to games" showIcon={false} onClick={() => navigate('/games')} />
          </div>
        </header>

        <main className="game-content">
          {gameLoading && (
            <div className="game-panel game-panel--loading">
              Loading game details...
            </div>
          )}

          {gameError && (
            <div className="game-alert">
              {gameError}
            </div>
          )}

          {game && !gameLoading && (
            <div className="game-grid">
              <div className="game-cover">
                {detailCover ? (
                  <img
                    src={detailCover}
                    alt={game.name || 'Game cover'}
                    className="game-cover__image"
                  />
                ) : (
                  <div className="game-cover__placeholder">
                    No cover available
                  </div>
                )}
              </div>
              <div className="game-info">
                <div className="game-info__header">
                  <p className="game-info__eyebrow">Selected game</p>
                  <h1 className="game-info__title">{game.name}</h1>
                </div>
                <p className="game-info__description">
                  {game.description || game.story || 'No description available yet.'}
                </p>
                <div className="game-info__stats">
                  <div className="game-stat">
                    <span className="game-stat__label">Genre</span>
                    <span className="game-stat__value">{game.genre ?? 'n/a'}</span>
                  </div>
                  <div className="game-stat">
                    <span className="game-stat__label">Publisher</span>
                    <span className="game-stat__value">{game.publishers ?? 'n/a'}</span>
                  </div>
                  <div className="game-stat">
                    <span className="game-stat__label">Release</span>
                    <span className="game-stat__value">{formatReleaseDate(game.release_date) ?? 'n/a'}</span>
                  </div>
                  <div className="game-stat">
                    <span className="game-stat__label">Platforms</span>
                    <span className="game-stat__value">{game.platform_names?.join(', ') ?? 'n/a'}</span>
                  </div>
                </div>
                <section className="game-panel">
                  <div className="game-panel__header">
                    <h2 className="game-panel__title">Screenshots</h2>
                    <span className="game-panel__meta">
                      {mediaGallery.length ? `${mediaGallery.length} shots` : 'No shots'}
                    </span>
                  </div>
                  <div className="game-gallery">
                    {mediaGallery.length ? (
                      mediaGallery.slice(0, 4).map((shot, index) => (
                        <div key={`${shot}-${index}`} className="game-gallery__item">
                          <img
                            src={shot}
                            alt={`${game.name} screenshot ${index + 1}`}
                            className="game-gallery__image"
                          />
                        </div>
                      ))
                    ) : (
                      <div className="game-gallery__empty">
                        No screenshots available yet.
                      </div>
                    )}
                  </div>
                </section>
                <section className="game-panel">
                  <div className="game-panel__header">
                    <h2 className="game-panel__title">Trailer</h2>
                    <span className="game-panel__meta">
                      {embedUrl ? 'Now playing' : 'No trailer'}
                    </span>
                  </div>
                  <div className="game-trailer">
                    {embedUrl ? (
                      <div className="game-trailer__frame">
                        <iframe
                          src={embedUrl}
                          title={`${game.name} trailer`}
                          className="game-trailer__iframe"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="game-gallery__empty">
                        Trailer link not available yet.
                      </div>
                    )}
                  </div>
                </section>
                <div className="game-info__actions">
                  <Button label="Back to list" showIcon={false} onClick={closeGameDetail} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <div className="game-toast">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

export default Game
