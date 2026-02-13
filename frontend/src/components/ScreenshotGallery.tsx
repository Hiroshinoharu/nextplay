import { useEffect, useMemo, useState } from 'react'
import './screenshot-gallery.css'

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

  useEffect(() => {
    if (!items.length) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((current) => (current < items.length ? current : 0))
  }, [items])

  if (!items.length) return null

  const activeShot = items[activeIndex]
  const canNavigate = items.length > 1

  const showPrevious = () => {
    if (!canNavigate) return
    setActiveIndex((current) => (current - 1 + items.length) % items.length)
  }

  const showNext = () => {
    if (!canNavigate) return
    setActiveIndex((current) => (current + 1) % items.length)
  }

  return (
    <div className="screenshot-gallery">
      <div className="screenshot-gallery__frame-wrap">
        {canNavigate ? (
          <button
            type="button"
            className="screenshot-gallery__nav screenshot-gallery__nav--prev"
            onClick={showPrevious}
            aria-label="Show previous screenshot"
          >
            Prev
          </button>
        ) : null}
        <button
          type="button"
          className="screenshot-gallery__frame"
          onClick={() => onOpen?.(activeIndex)}
          aria-label={`Open screenshot ${activeIndex + 1} of ${gameName}`}
        >
          <img
            src={activeShot.src}
            alt={`${gameName} screenshot ${activeIndex + 1}`}
            className="screenshot-gallery__image"
          />
        </button>
        {canNavigate ? (
          <button
            type="button"
            className="screenshot-gallery__nav screenshot-gallery__nav--next"
            onClick={showNext}
            aria-label="Show next screenshot"
          >
            Next
          </button>
        ) : null}
      </div>
      <div className="screenshot-gallery__meta">
        <span>
          Screenshot {activeIndex + 1} of {items.length}
        </span>
      </div>
      {canNavigate ? (
        <div className="screenshot-gallery__thumbs" aria-label="Choose screenshot">
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              className={`screenshot-gallery__thumb${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show screenshot ${index + 1}`}
            >
              <img
                src={item.src}
                alt=""
                className="screenshot-gallery__thumb-image"
                loading="lazy"
              />
              <span className="screenshot-gallery__thumb-label">Screenshot {index + 1}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default ScreenshotGallery
