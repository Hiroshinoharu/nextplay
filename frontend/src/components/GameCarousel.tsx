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

// FNV-1a hash function for consistent hashing of strings, used for shuffling with a seed 
const hashText = (value: string) => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

// Shuffle an array of items using a seed string for deterministic randomness
const shuffleItemsWithSeed = <T,>(items: T[], seedText: string) => {
  const out = [...items]
  let seed = hashText(seedText)
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

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
  const hasExtendedNearEndRef = useRef(false)
  const [loopState, setLoopState] = useState<{ sourceKey: string; extraCycles: number }>({
    sourceKey: '',
    extraCycles: 0,
  })
  const safeGames = useMemo(
    () => games.filter((game) => !isNsfwGame(game)),
    [games],
  )
  const sourceKey = useMemo(
    () => safeGames.map((game) => String(game.id)).join('|'),
    [safeGames],
  )

  const displayGames = useMemo(
    () => {
      if (showRank || safeGames.length <= 1) return safeGames
      const extraCycles = loopState.sourceKey === sourceKey ? loopState.extraCycles : 0
      const cycles = Array.from({ length: 1 + extraCycles }, (_, cycleIndex) =>
        shuffleItemsWithSeed(safeGames, `${sourceKey}:${cycleIndex}`),
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
