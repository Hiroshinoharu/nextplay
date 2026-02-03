import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import GameCarousel from './components/GameCarousel'
import logoUrl from './assets/logo.png'
import './games.css'

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
  const location = useLocation()
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
  const loadGames = useCallback(async () => {
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
  }, [gamesUrl])

  useEffect(() => {
    // Load the list of games when the gamesUrl changes
    loadGames()
  }, [loadGames])

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

  const activeTab = location.pathname.startsWith('/games')
    ? 'discover'
    : location.pathname === '/'
      ? 'home'
      : location.pathname.startsWith('/user')
        ? 'list'
        : 'home'

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
    <div className="games-page">
      <div className="games-shell">
        <header className="games-header">
          <button type="button" className="games-brand" onClick={() => navigate('/')}>
            <img src={logoUrl} alt="NextPlay Logo" />
            <span className="games-brand__text">
              <span className="games-brand__title">NextPlay</span>
              <span className="games-brand__subtitle">Home Page</span>
            </span>
          </button>
          <nav className="games-nav" aria-label="Primary">
            <button
              type="button"
              className={`games-nav__item${activeTab === 'home' ? ' is-active' : ''}`}
              onClick={() => navigate('/')}
            >
              Home
            </button>
            <button
              type="button"
              className={`games-nav__item${activeTab === 'discover' ? ' is-active' : ''}`}
              onClick={() => navigate('/games')}
            >
              Discover
            </button>
            <button
              type="button"
              className={`games-nav__item${activeTab === 'list' ? ' is-active' : ''}`}
              onClick={() => navigate('/user')}
            >
              My List
            </button>
          </nav>
          <div className="games-actions">
            <button type="button" className="games-icon-button" aria-label="Search games">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15.5 14h-.79l-.28-.27a6 6 0 1 0-.71.71l.27.28v.79l5 5 1.5-1.5-5-5zm-5.5 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button type="button" className="games-avatar" aria-label="Account menu">
              NP
            </button>
          </div>
        </header>

        <section className="games-hero">
          <div className="games-hero__media">
            {featuredCover ? (
              <img src={featuredCover} alt={featuredGame?.name || 'Featured game'} />
            ) : null}
            <div className="games-hero__shade" />
          </div>
          <div className="games-hero__content">
            {featuredGame ? (
              <>
                <p className="games-hero__eyebrow">Featured today</p>
                <h1 className="games-hero__title">{featuredGame.name}</h1>
                <p className="games-hero__desc">
                  {featuredGame.description || 'A fresh pick from your library.'}
                </p>
                <div className="games-hero__meta">
                  <span>{featuredGame.genre ?? 'Genre: n/a'}</span>
                  <span>{featuredGame.publishers ?? 'Publisher: n/a'}</span>
                  <span>
                    {featuredGame.release_date
                      ? `Release: ${featuredGame.release_date}`
                      : 'Release: n/a'}
                  </span>
                </div>
                <div className="games-hero__actions">
                  <button
                    type="button"
                    className="games-hero__button games-hero__button--primary"
                    onClick={() => {
                      if (featuredGame?.id) openGameDetail(featuredGame.id)
                    }}
                    disabled={!featuredGame.id}
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    className="games-hero__button games-hero__button--ghost"
                    onClick={loadGames}
                    disabled={gamesLoading}
                  >
                    {gamesLoading ? 'Refreshing...' : 'Refresh list'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="games-hero__eyebrow">Library loading</p>
                <h1 className="games-hero__title">Loading games...</h1>
                <p className="games-hero__desc">
                  We will surface a featured title as soon as your API responds.
                </p>
                <div className="games-hero__actions">
                  <button
                    type="button"
                    className="games-hero__button games-hero__button--ghost"
                    onClick={loadGames}
                    disabled={gamesLoading}
                  >
                    {gamesLoading ? 'Refreshing...' : 'Refresh list'}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <main className="games-content">
          {gamesError && <div className="games-alert">{gamesError}</div>}

          <GameCarousel
            title="Upcoming Games"
            badge="Preview"
            games={upcomingList}
            onSelect={openGameDetail}
            getCoverUrl={carouselCover}
            itemWidth={170}
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
            itemWidth={180}
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
            itemWidth={170}
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
      </div>

      {toastMessage && <div className="games-toast">{toastMessage}</div>}
    </div>
  )
}

export default Games
