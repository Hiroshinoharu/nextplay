import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from './components/Button'
import GameCarousel from './components/GameCarousel'

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

// Parse release date strings into Date objects, returning null for invalid or missing dates
const parseReleaseDate = (value?: string) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

// Main Games component handling game list view
function Games() {
  // Router and state hooks
  const navigate = useNavigate()
  const [baseUrl] = useState<string>(API_ROOT)
  const [games, setGames] = useState<GameItem[]>([])
  const [gamesError, setGamesError] = useState<string | null>(null)
  const [gamesLoading, setGamesLoading] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Construct the games API URL using the base URL and memoization
  const gamesUrl = useMemo(() => {
    const trimmedBase = baseUrl.replace(/\/+$/, '')
    const root = trimmedBase.endsWith('/api') ? trimmedBase.slice(0, -4) : trimmedBase
    return `${root}/api/games`
  }, [baseUrl])

  // Function to load the list of games from the API
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
    // Load the list of games when the gamesUrl changes
    loadGames()
  }, [gamesUrl])

  useEffect(() => {
    const message = gamesError
    if (!message) return
    setToastMessage(message)
    const timeout = window.setTimeout(() => {
      setToastMessage(null)
    }, 4500)
    return () => window.clearTimeout(timeout)
  }, [gamesError])

  const openGameDetail = (targetId: number) => {
    navigate(`/games/${targetId}`)
  }

  const featuredGame = games[0] ?? null
  const featuredCover = normalizeCoverUrl(featuredGame?.cover_image ?? undefined)
  const carouselCover = (game: GameItem) => normalizeCoverUrl(game.cover_image)
  const upcomingGames = games
    .filter(game => {
      const date = parseReleaseDate(game.release_date)
      return date ? date >= new Date() : false
    })
    .slice(0, 10)
  const topTenGames = games.slice(0, 10)
  const discoveryGames = games.slice(10, 20)
  const upcomingList = upcomingGames.length ? upcomingGames : games.slice(0, 10)
  const discoveryList = discoveryGames.length ? discoveryGames : games.slice(0, 10)

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
            <Button label="Back to services" showIcon={false} onClick={() => navigate('/games')} />
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
                    label="View details"
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

        <GameCarousel
          title="Upcoming Games"
          badge="Preview"
          games={upcomingList}
          onSelect={openGameDetail}
          getCoverUrl={carouselCover}
          getDescription={game =>
            game.release_date ? `Release: ${game.release_date}` : 'Release: n/a'
          }
        />

        <GameCarousel
          title="Top 10 of all time"
          badge="Ranked"
          games={topTenGames}
          onSelect={openGameDetail}
          getCoverUrl={carouselCover}
          showRank
          getDescription={game =>
            game.genre ? `Genre: ${game.genre}` : 'Genre: n/a'
          }
        />

        <GameCarousel
          title="Explore more"
          badge="Discover"
          games={discoveryList}
          onSelect={openGameDetail}
          getCoverUrl={carouselCover}
          getDescription={game =>
            [
              game.release_date ? `Release: ${game.release_date}` : null,
              game.genre ? `Genre: ${game.genre}` : null,
            ]
              .filter(Boolean)
              .join('\n')
          }
        />

      </main>
      
      {toastMessage && (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

export default Games
