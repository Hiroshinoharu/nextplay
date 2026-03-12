import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
  type TouchEvent,
} from 'react'
import {
  FrameButton,
  FrameImage,
  FrameWrap,
  Gallery,
  Meta,
  NavButton,
  ThumbButton,
  ThumbImage,
  ThumbLabel,
  Thumbs,
} from './mediaGalleryStyles'

type ScreenshotGalleryProps = {
  screenshots: string[]
  gameName?: string
  onOpen?: (index: number) => void
}

type ScreenshotItem = {
  src: string
  key: string
}

const ScreenshotGallery = ({ screenshots, gameName = 'game', onOpen }: ScreenshotGalleryProps) => {
  const items = useMemo(() => {
    const seen = new Set<string>()
    return screenshots.reduce<ScreenshotItem[]>((acc, screenshot, index) => {
      const src = screenshot?.trim()
      if (!src) return acc
      if (seen.has(src)) return acc
      seen.add(src)
      acc.push({
        src,
        key: `${src}-${index}`,
      })
      return acc
    }, [])
  }, [screenshots])

  const [activeIndex, setActiveIndex] = useState(0)
  const [aspectRatioBySrc, setAspectRatioBySrc] = useState<Record<string, number>>({})
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  if (!items.length) return null

  const safeActiveIndex = activeIndex < items.length ? activeIndex : 0
  const activeShot = items[safeActiveIndex]
  const canNavigate = items.length > 1
  const activeAspectRatio = aspectRatioBySrc[activeShot.src] ?? 16 / 9
  const clampedAspectRatio = Math.max(0.75, Math.min(2.2, activeAspectRatio))

  const showPrevious = () => {
    if (!canNavigate) return
    setActiveIndex((current) => (current - 1 + items.length) % items.length)
  }

  const showNext = () => {
    if (!canNavigate) return
    setActiveIndex((current) => (current + 1) % items.length)
  }

  // Use pointer-up for touch devices to avoid mobile tap/click conflicts.
  const handleFramePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onOpen?.(safeActiveIndex)
  }

  const handleFrameClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return
    onOpen?.(safeActiveIndex)
  }

  const handlePrevPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    showPrevious()
  }

  const handlePrevClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return
    showPrevious()
  }

  const handleNextPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    showNext()
  }

  const handleNextClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return
    showNext()
  }

  const handleThumbPointerUp = (
    event: PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setActiveIndex(index)
  }

  const handleThumbClick = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    if (event.detail !== 0) return
    setActiveIndex(index)
  }

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (!canNavigate) return
    const touch = event.changedTouches[0]
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
  }

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!canNavigate || touchStartX.current === null || touchStartY.current === null) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStartX.current
    const deltaY = touch.clientY - touchStartY.current

    touchStartX.current = null
    touchStartY.current = null

    const swipeThreshold = 48
    const verticalTolerance = 32
    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaY) > verticalTolerance) return

    if (deltaX > 0) {
      showPrevious()
    } else if (deltaX < 0) {
      showNext()
    }
  }

  const handleImageLoad = useCallback(
    (src: string, event: SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = event.currentTarget
      if (!naturalWidth || !naturalHeight) return
      const ratio = naturalWidth / naturalHeight
      if (!Number.isFinite(ratio) || ratio <= 0) return
      setAspectRatioBySrc((current) => {
        if (current[src] && Math.abs(current[src] - ratio) < 0.01) {
          return current
        }
        return { ...current, [src]: ratio }
      })
    },
    [],
  )

  return (
    <Gallery>
      <FrameWrap onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {canNavigate ? (
          <NavButton
            type="button"
            $position="prev"
            onPointerUp={handlePrevPointerUp}
            onClick={handlePrevClick}
            aria-label="Show previous screenshot"
          >
            Back
          </NavButton>
        ) : null}
        <FrameButton
          type="button"
          style={{ aspectRatio: `${clampedAspectRatio}` }}
          onPointerUp={handleFramePointerUp}
          onClick={handleFrameClick}
          aria-label={`Open screenshot ${safeActiveIndex + 1} of ${gameName}`}
        >
          <FrameImage
            src={activeShot.src}
            alt={`${gameName} screenshot ${safeActiveIndex + 1}`}
            onLoad={(event) => handleImageLoad(activeShot.src, event)}
          />
        </FrameButton>
        {canNavigate ? (
          <NavButton
            type="button"
            $position="next"
            onPointerUp={handleNextPointerUp}
            onClick={handleNextClick}
            aria-label="Show next screenshot"
          >
            Next
          </NavButton>
        ) : null}
      </FrameWrap>
      <Meta>
        <span>
          Screenshot {safeActiveIndex + 1} of {items.length}
        </span>
      </Meta>
      {canNavigate ? (
        <Thumbs aria-label="Choose screenshot">
          {items.map((item, index) => (
            <ThumbButton
              key={item.key}
              type="button"
              data-active={index === safeActiveIndex}
              onPointerUp={(event) => handleThumbPointerUp(event, index)}
              onClick={(event) => handleThumbClick(event, index)}
              aria-label={`Show screenshot ${index + 1}`}
            >
              <ThumbImage src={item.src} alt="" loading="lazy" />
              <ThumbLabel>Screenshot {index + 1}</ThumbLabel>
            </ThumbButton>
          ))}
        </Thumbs>
      ) : null}
    </Gallery>
  )
}

export default ScreenshotGallery
