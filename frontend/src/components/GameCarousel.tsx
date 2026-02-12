import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, UIEvent } from 'react'
import Card from './card'

type GameCarouselItem = {
  id: number
  name: string
  release_date?: string
  genre?: string
  cover_image?: string
  nsfw?: boolean
  is_nsfw?: boolean
  adult?: boolean
  age_rating?: string | number
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

const NSFW_TERMS = [
  'nsfw',
  'adult',
  'erotic',
  'hentai',
  'porn',
  'porno',
  'sexual',
  'sex',
  'lust',
  'lustful',
  'lewd',
  'fetish',
  'brothel',
  'succubus',
  'ecchi',
  'uncensored',
  'r18',
  '18+',
  'xxx',
  'cumming',
  'cum',
  'nude',
  'nudity',
  'milf',
  'onlyfans',
  'artificial academy',
]

const normalizeFilterText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim()

const isNsfwGame = (game: GameCarouselItem) => {
  if (game.nsfw || game.is_nsfw || game.adult) return true
  const ageRatingText = String(game.age_rating ?? '')
  const metadataText = [game.name, game.genre, ageRatingText]
    .filter(Boolean)
    .join(' ')
  const normalizedText = normalizeFilterText(metadataText)
  return NSFW_TERMS.some((term) => normalizedText.includes(term))
}

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
  const [visibleCount, setVisibleCount] = useState(20)
  const safeGames = useMemo(
    () => games.filter((game) => !isNsfwGame(game)),
    [games],
  )
  const pageSize = 20

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [safeGames.length, setVisibleCount])

  const visibleGames = useMemo(
    () => safeGames.slice(0, Math.max(pageSize, visibleCount)),
    [pageSize, safeGames, visibleCount],
  )

  const carouselItems = useMemo(
    () =>
      visibleGames.map((game, index) => ({
        key: `${game.id ?? 'game'}-${index}`,
        game,
        index,
        coverSrc: getCoverUrl(game),
        description: getDescription(game),
      })),
    [getCoverUrl, getDescription, visibleGames],
  )

  useEffect(() => {
    if (!isLoadingMore) {
      hasTriggeredNearEndRef.current = false
    }
  }, [isLoadingMore, safeGames.length, visibleGames.length])

  const handleRowScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const row = event.currentTarget
      const remaining = row.scrollWidth - row.scrollLeft - row.clientWidth
      const isNearEnd = remaining <= loadMoreThreshold

      if (isNearEnd && visibleGames.length < safeGames.length) {
        setVisibleCount((current) => Math.min(current + pageSize, safeGames.length))
      }

      if (!onLoadMore || !canLoadMore || isLoadingMore) return

      if (!isNearEnd) {
        hasTriggeredNearEndRef.current = false
        return
      }

      if (visibleGames.length < safeGames.length) return
      if (hasTriggeredNearEndRef.current) return
      hasTriggeredNearEndRef.current = true
      void onLoadMore()
    },
    [
      canLoadMore,
      isLoadingMore,
      loadMoreThreshold,
      onLoadMore,
      pageSize,
      safeGames.length,
      setVisibleCount,
      visibleGames.length,
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
