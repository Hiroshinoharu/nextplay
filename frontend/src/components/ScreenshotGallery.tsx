import { useMemo, useRef, useState, type TouchEvent } from 'react'
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
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  if (!items.length) return null

  const safeActiveIndex = activeIndex < items.length ? activeIndex : 0
  const activeShot = items[safeActiveIndex]
  const canNavigate = items.length > 1

  const showPrevious = () => {
    if (!canNavigate) return
    setActiveIndex((current) => (current - 1 + items.length) % items.length)
  }

  const showNext = () => {
    if (!canNavigate) return
    setActiveIndex((current) => (current + 1) % items.length)
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
      return
    }
    showNext()
  }

  return (
    <Gallery>
      <FrameWrap onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {canNavigate ? (
          <NavButton
            type="button"
            $position="prev"
            onClick={showPrevious}
            aria-label="Show previous screenshot"
          >
            Back
          </NavButton>
        ) : null}
        <FrameButton
          type="button"
          onClick={() => onOpen?.(safeActiveIndex)}
          aria-label={`Open screenshot ${safeActiveIndex + 1} of ${gameName}`}
        >
          <FrameImage src={activeShot.src} alt={`${gameName} screenshot ${safeActiveIndex + 1}`} />
        </FrameButton>
        {canNavigate ? (
          <NavButton
            type="button"
            $position="next"
            onClick={showNext}
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
              onClick={() => setActiveIndex(index)}
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
