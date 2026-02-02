import type { CSSProperties, ReactNode } from 'react'
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
  itemWidth?: number
  gap?: number
}

const baseRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  overflowX: 'auto',
  paddingBottom: '0.5rem',
  paddingRight: '0.5rem',
}

const rankStyle: CSSProperties = {
  position: 'absolute',
  left: '-0.5rem',
  top: '-1.25rem',
  fontSize: '3rem',
  fontWeight: 600,
  color: '#475569',
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
}: GameCarouselProps) => {
  const rowStyle: CSSProperties = { ...baseRowStyle, gap }
  const itemStyle: CSSProperties = { flex: `0 0 ${itemWidth}px` }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {badge && (
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">{badge}</span>
        )}
      </div>
      <div className="flex flex-nowrap overflow-x-auto pb-2 pr-2" style={rowStyle}>
        {games.map((game, index) => {
          const coverSrc = getCoverUrl(game)
          const description = getDescription(game)
          return (
            <div
              key={game.id}
              className={`flex-none${showRank ? ' relative' : ''}`}
              style={itemStyle}
            >
              {showRank && (
                <span className="absolute -left-2 -top-5 text-5xl font-semibold text-slate-600" style={rankStyle}>
                  {index + 1}
                </span>
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

export default GameCarousel
