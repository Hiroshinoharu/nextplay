import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode, UIEvent } from 'react'
import Card from './card'

// Type definition for individual game items in the carousel, including optional metadata fields
type GameCarouselItem = {
  id: number
  name: string
  release_date?: string
  genre?: string
  cover_image?: string
  description?: string
  platform_names?: string[]
  nsfw?: boolean
  is_nsfw?: boolean
  adult?: boolean
  age_rating?: string | number
}

// Props for the GameCarousel component, defining the expected data and behavior
type GameCarouselProps = {
  title: string
  badge?: string
  badgeVariant?: 'neutral' | 'base' | 'addon'
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
  enableInfiniteScroll?: boolean
  isolateRendering?: boolean
  initialVisibleItems?: number
  visibleItemsStep?: number
  navStepItems?: number
  showLaneStatus?: boolean
  laneLoadingText?: string
  laneEndText?: string
  autoLoadOnNoOverflow?: boolean
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

const hashStringToSeed = (value: string): number => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createPrng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

const shuffleItems = <T,>(items: T[], seedKey: string): T[] => {
  const out = [...items]
  const nextRandom = createPrng(hashStringToSeed(seedKey))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1)) // 0 <= j <= i
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// GameCarousel component renders a horizontal scrolling list of game cards with optional ranking and infinite extension/loading.
const GameCarousel = ({
  title,
  badge,
  badgeVariant = 'neutral',
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
  enableInfiniteScroll = false,
  isolateRendering = false,
  initialVisibleItems = 24,
  visibleItemsStep = 24,
  navStepItems = 2,
  showLaneStatus = false,
  laneLoadingText = 'Loading more...',
  laneEndText = 'No more games in this lane.',
  autoLoadOnNoOverflow = false,
}: GameCarouselProps) => {
  const rowStyle: CSSProperties = { ...baseRowStyle, gap }
  const itemStyle: CSSProperties = { flex: `0 0 ${itemWidth}px` }
  const rowRef = useRef<HTMLDivElement | null>(null)
  const hasTriggeredNearEndRef = useRef(false)
  const hasExtendedNearEndRef = useRef(false)
  const hasTriggeredNoOverflowLoadRef = useRef(false)
  const nearEndActiveRef = useRef(false)
  const [navState, setNavState] = useState<{ canPrev: boolean; canNext: boolean }>({
    canPrev: false,
    canNext: false,
  })
  const [loopState, setLoopState] = useState<{ sourceKey: string; extraCycles: number }>({
    sourceKey: '',
    extraCycles: 0,
  })
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    Math.max(1, initialVisibleItems),
  )
  const safeGames = games
  const sourceKey = useMemo(
    () => safeGames.map((game) => String(game.id)).join('|'),
    [safeGames],
  )

  const displayGames = useMemo(
    () => {
      if (showRank || safeGames.length <= 1 || !enableInfiniteScroll) return safeGames
      const extraCycles = loopState.sourceKey === sourceKey ? loopState.extraCycles : 0
      if (extraCycles <= 0) return safeGames
      const cycles = Array.from({ length: 1 + extraCycles }, (_, cycleIndex) =>
        shuffleItems(safeGames, `${sourceKey}:${cycleIndex}`),
      )
      return cycles.flat()
    },
    [enableInfiniteScroll, loopState.extraCycles, loopState.sourceKey, safeGames, showRank, sourceKey],
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
  const visibleCarouselItems = useMemo(
    () => {
      if (!isolateRendering) return carouselItems
      const baseVisible = Math.max(1, initialVisibleItems)
      const clampedVisible = Math.max(
        baseVisible,
        Math.min(visibleCount, carouselItems.length),
      )
      return carouselItems.slice(0, clampedVisible)
    },
    [carouselItems, initialVisibleItems, isolateRendering, visibleCount],
  )
  const hasLocalMore = isolateRendering && visibleCarouselItems.length < carouselItems.length
  const hasAnyMore = hasLocalMore || canLoadMore
  const isLaneLoading = isLoadingMore && !hasLocalMore
  const laneStatus = useMemo(() => {
    if (!showLaneStatus) return null
    if (isLaneLoading) return laneLoadingText
    if (!hasAnyMore && carouselItems.length > 0) return laneEndText
    return null
  }, [
    showLaneStatus,
    isLaneLoading,
    hasAnyMore,
    carouselItems.length,
    laneEndText,
    laneLoadingText,
  ])

  const syncNavState = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    const maxScrollLeft = Math.max(0, row.scrollWidth - row.clientWidth)
    const canPrev = row.scrollLeft > 2
    const canNext = maxScrollLeft - row.scrollLeft > 2
    setNavState((current) => {
      if (current.canPrev === canPrev && current.canNext === canNext) return current
      return { canPrev, canNext }
    })
  }, [])

  useEffect(() => {
    if (!isLoadingMore) {
      hasTriggeredNearEndRef.current = false
    }
  }, [displayGames.length, isLoadingMore, safeGames.length])

  useEffect(() => {
    hasTriggeredNoOverflowLoadRef.current = false
  }, [canLoadMore, carouselItems.length])


  useEffect(() => {
    if (!autoLoadOnNoOverflow) return
    const row = rowRef.current
    if (!row || !onLoadMore || !canLoadMore || isLoadingMore) return
    if (hasTriggeredNoOverflowLoadRef.current) return

    const hasHorizontalOverflow = row.scrollWidth > row.clientWidth + 1
    if (hasHorizontalOverflow) return

    // Fire at most once for non-overflow rows to avoid continuous load loops.
    hasTriggeredNoOverflowLoadRef.current = true
    void onLoadMore()
  }, [autoLoadOnNoOverflow, canLoadMore, carouselItems.length, isLoadingMore, onLoadMore])

  useEffect(() => {
    syncNavState()
    const row = rowRef.current
    if (!row) return

    const handleWindowResize = () => {
      syncNavState()
    }

    window.addEventListener('resize', handleWindowResize)
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            syncNavState()
          })
        : null
    observer?.observe(row)

    return () => {
      window.removeEventListener('resize', handleWindowResize)
      observer?.disconnect()
    }
  }, [syncNavState, carouselItems.length, visibleCarouselItems.length])


  // Handler for the scroll event on the carousel row, determining when to trigger loading more items or extending the visible range based on scroll position and thresholds.
  const handleRowScroll = useCallback(
    // Calculate the remaining scrollable distance to the end of the row and determine if it's within the threshold to trigger loading more items or extending the visible range.
    (event: UIEvent<HTMLDivElement>) => {
      syncNavState()
      const row = event.currentTarget
      const remaining = row.scrollWidth - row.scrollLeft - row.clientWidth
      const enterThreshold = loadMoreThreshold
      const exitThreshold =
        loadMoreThreshold + Math.max(96, Math.round((itemWidth + gap) * 0.6))
      const isNearEnd = remaining <= enterThreshold
      const isFarFromEnd = remaining > exitThreshold

      if (isFarFromEnd) {
        nearEndActiveRef.current = false
        hasExtendedNearEndRef.current = false
        hasTriggeredNearEndRef.current = false
        return
      }
      if (!isNearEnd) return
      if (nearEndActiveRef.current) return
      nearEndActiveRef.current = true

      if (
        isolateRendering &&
        !showRank &&
        !hasExtendedNearEndRef.current &&
        visibleCount < carouselItems.length
      ) {
        hasExtendedNearEndRef.current = true
        setVisibleCount((current) =>
          Math.min(current + Math.max(1, visibleItemsStep), carouselItems.length),
        )
      }

      if (
        enableInfiniteScroll &&
        !showRank &&
        safeGames.length > 1 &&
        canLoadMore &&
        !hasExtendedNearEndRef.current
      ) {
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
      enableInfiniteScroll,
      isolateRendering,
      isLoadingMore,
      loadMoreThreshold,
      gap,
      itemWidth,
      onLoadMore,
      carouselItems.length,
      safeGames,
      showRank,
      sourceKey,
      visibleCount,
      visibleItemsStep,
      syncNavState,
    ],
  )

  // Scroll the carousel row left or right by a calculated step based on item width, gap, and responsive limits.
  const scrollRowByDirection = useCallback((direction: 1 | -1) => {
    const row = rowRef.current
    if (!row) return
    const fixedStep = (itemWidth + gap) * Math.max(1, navStepItems)
    const responsiveCap = row.clientWidth * 0.82
    const resolvedStep = Math.max(itemWidth + gap, Math.min(fixedStep, responsiveCap))
    row.scrollBy({ left: resolvedStep * direction, behavior: 'smooth' })
    window.setTimeout(syncNavState, 240)
  }, [gap, itemWidth, navStepItems, syncNavState])

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        scrollRowByDirection(-1)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        scrollRowByDirection(1)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        const row = rowRef.current
        if (!row) return
        row.scrollTo({ left: 0, behavior: 'smooth' })
        window.setTimeout(syncNavState, 240)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        const row = rowRef.current
        if (!row) return
        row.scrollTo({ left: row.scrollWidth, behavior: 'smooth' })
        window.setTimeout(syncNavState, 240)
      }
    },
    [scrollRowByDirection, syncNavState],
  )

  return (
    <section className="games-section">
      {showHeader ? (
        <header className="games-section__header">
          <h2 className="games-section__title">{title}</h2>
          {badge && (
            <span className={`games-section__badge games-section__badge--${badgeVariant}`}>
              {badge}
            </span>
          )}
        </header>
      ) : null}
      <div className="games-row-wrap">
        <button
          type="button"
          className="games-row-nav games-row-nav--prev"
          onClick={() => scrollRowByDirection(-1)}
          aria-label={`Scroll ${title} left`}
          disabled={!navState.canPrev}
          aria-disabled={!navState.canPrev}
        >
          ‹
        </button>
        <div
          ref={rowRef}
          className="games-row"
          style={rowStyle}
          onScroll={handleRowScroll}
          onKeyDown={handleRowKeyDown}
          tabIndex={0}
          aria-label={`${title} carousel`}
        >
          {visibleCarouselItems.map(({ key, game, index, coverSrc, description }) => {
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
        <button
          type="button"
          className="games-row-nav games-row-nav--next"
          onClick={() => scrollRowByDirection(1)}
          aria-label={`Scroll ${title} right`}
          disabled={!navState.canNext}
          aria-disabled={!navState.canNext}
        >
          ›
        </button>
      </div>
      {laneStatus ? (
        <div className="games-row-status">
          <span>{laneStatus}</span>
        </div>
      ) : null}
    </section>
  )
}

export default memo(GameCarousel)
