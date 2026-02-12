import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, UIEvent } from 'react'
import Card from './card'

// Type definition for individual game items in the carousel, including optional metadata fields
type GameCarouselItem = {
  id: number
  name: string
  release_date?: string
  genre?: string
  cover_image?: string
  description?: string
  nsfw?: boolean
  is_nsfw?: boolean
  adult?: boolean
  age_rating?: string | number
}

// Props for the GameCarousel component, defining the expected data and behavior
type GameCarouselProps = {
  title: string
  badge?: string
  games: GameCarouselItem[]
  onSelect: (gameId: number) => void
  getDescription?: (game: GameCarouselItem) => ReactNode
  getCoverUrl?: (game: GameCarouselItem) => string | null
  showRank?: boolean
  showHeader?: boolean
  itemWidth?: number
  gap?: number
  onLoadMore?: () => void | Promise<void>
  canLoadMore?: boolean
  isLoadingMore?: boolean
  loadMoreThreshold?: number
}

// Base styles for the carousel row, with horizontal scrolling and no wrapping
const baseRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  overflowX: 'auto',
}

const defaultCoverUrl = (game: GameCarouselItem) => {
  if (!game.cover_image) return null
  if (game.cover_image.startsWith('//')) return `https:${game.cover_image}`
  return game.cover_image
}

const defaultDescription = (game: GameCarouselItem) =>
  game.release_date ? `Release: ${game.release_date}` : 'Release: n/a'


const shuffleItems = <T,>(items: T[]): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)) // 0 <= j <= i
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// GameCarousel component renders a horizontal scrolling list of game cards with optional ranking and infinite extension/loading.
const GameCarousel = ({
  title,
  badge,
  games,
  onSelect,
  getDescription = defaultDescription,
  getCoverUrl = defaultCoverUrl,
  showRank = false,
  itemWidth = 200,
  gap = 20,
  showHeader = true,
  onLoadMore,
  canLoadMore = false,
  isLoadingMore = false,
  loadMoreThreshold = 220,
}: GameCarouselProps) => {
  const rowStyle: CSSProperties = { ...baseRowStyle, gap }
  const itemStyle: CSSProperties = { flex: `0 0 ${itemWidth}px` }
  const hasTriggeredNearEndRef = useRef(false)
  const hasExtendedNearEndRef = useRef(false)
  const [loopState, setLoopState] = useState<{ sourceKey: string; extraCycles: number }>({
    sourceKey: '',
    extraCycles: 0,
  })
  const safeGames = games
  const sourceKey = useMemo(
    () => safeGames.map((game) => String(game.id)).join('|'),
    [safeGames],
  )

  const displayGames = useMemo(
    () => {
      if (showRank || safeGames.length <= 1) return safeGames
      const extraCycles = loopState.sourceKey === sourceKey ? loopState.extraCycles : 0
      const cycles = Array.from({ length: 1 + extraCycles }, () =>
        shuffleItems(safeGames),
      )
      return cycles.flat()
    },
    [loopState.extraCycles, loopState.sourceKey, safeGames, showRank, sourceKey],
  )

  const carouselItems = useMemo(
    () =>
      displayGames.map((game, index) => ({
        key: `${game.id ?? 'game'}-${index}`,
        game,
        index,
        coverSrc: getCoverUrl(game),
        description: getDescription(game),
      })),
    [displayGames, getCoverUrl, getDescription],
  )

  useEffect(() => {
    if (!isLoadingMore) {
      hasTriggeredNearEndRef.current = false
    }
  }, [displayGames.length, isLoadingMore, safeGames.length])

  const handleRowScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const row = event.currentTarget
      const remaining = row.scrollWidth - row.scrollLeft - row.clientWidth
      const isNearEnd = remaining <= loadMoreThreshold

      if (!isNearEnd) {
        hasExtendedNearEndRef.current = false
        hasTriggeredNearEndRef.current = false
        return
      }

      if (!showRank && safeGames.length > 1 && !hasExtendedNearEndRef.current) {
        hasExtendedNearEndRef.current = true
        setLoopState((current) => {
          if (current.sourceKey !== sourceKey) {
            return { sourceKey, extraCycles: 1 }
          }
          return { sourceKey, extraCycles: current.extraCycles + 1 }
        })
      }

      if (!onLoadMore || !canLoadMore || isLoadingMore) return
      if (hasTriggeredNearEndRef.current) return
      hasTriggeredNearEndRef.current = true
      void onLoadMore()
    },
    [
      canLoadMore,
      isLoadingMore,
      loadMoreThreshold,
      onLoadMore,
      safeGames,
      showRank,
      sourceKey,
    ],
  )

  return (
    <section className="games-section">
      {showHeader ? (
        <header className="games-section__header">
          <h2 className="games-section__title">{title}</h2>
          {badge && <span className="games-section__badge">{badge}</span>}
        </header>
      ) : null}
      <div
        className="games-row"
        style={rowStyle}
        onScroll={handleRowScroll}
      >
        {carouselItems.map(({ key, game, index, coverSrc, description }) => {
          return (
            <div
              key={key}
              className={`games-item${showRank ? ' games-item--ranked' : ''}`}
              style={itemStyle}
            >
              {showRank && (
                <span className="games-rank">{index + 1}</span>
              )}
              <Card
                title={game.name || 'Untitled'}
                description={description}
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
                onClick={() => onSelect(game.id)}
                ariaLabel={`View details for ${game.name || 'game'}`}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default memo(GameCarousel)
