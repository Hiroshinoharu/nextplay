import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, ReactNode, UIEvent } from 'react'
import Card from './card'

type GameCarouselItem = {
  id: number
  name: string
  release_date?: string
  genre?: string
  cover_image?: string
}

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
  const carouselItems = useMemo(
    () =>
      games.map((game, index) => ({
        key: `${game.id ?? 'game'}-${index}`,
        game,
        index,
        coverSrc: getCoverUrl(game),
        description: getDescription(game),
      })),
    [games, getCoverUrl, getDescription],
  )

  useEffect(() => {
    if (!isLoadingMore) {
      hasTriggeredNearEndRef.current = false
    }
  }, [isLoadingMore, games.length])

  const handleRowScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!onLoadMore || !canLoadMore || isLoadingMore) return
      const row = event.currentTarget
      const remaining = row.scrollWidth - row.scrollLeft - row.clientWidth
      const isNearEnd = remaining <= loadMoreThreshold

      if (!isNearEnd) {
        hasTriggeredNearEndRef.current = false
        return
      }

      if (hasTriggeredNearEndRef.current) return
      hasTriggeredNearEndRef.current = true
      void onLoadMore()
    },
    [canLoadMore, isLoadingMore, loadMoreThreshold, onLoadMore],
  )

  return (
    <section className="games-section">
      {showHeader ? (
        <header className="games-section__header">
          <h2 className="games-section__title">{title}</h2>
          {badge && <span className="games-section__badge">{badge}</span>}
        </header>
      ) : null}
      <div className="games-row" style={rowStyle} onScroll={handleRowScroll}>
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
