import { useEffect, useMemo, useState } from 'react'
import './trailer-gallery.css'

type TrailerGalleryProps = {
  trailers: string[]
  gameName?: string
}

type TrailerItem = {
  sourceUrl: string
  embedUrl: string
  videoId: string | null
  thumbnailUrl: string | null
  key: string
}

const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/

const toYouTubeVideoId = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (youtubeIdPattern.test(trimmed)) return trimmed
  if (trimmed.includes('youtu.be/')) {
    return trimmed.split('youtu.be/')[1]?.split(/[?&/]/)[0] ?? null
  }
  if (trimmed.includes('/embed/')) {
    return trimmed.split('/embed/')[1]?.split(/[?&/]/)[0] ?? null
  }
  if (trimmed.includes('youtube.com/watch')) {
    try {
      const url = new URL(trimmed)
      return url.searchParams.get('v')
    } catch {
      return null
    }
  }
  return null
}

const toEmbedUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const videoId = toYouTubeVideoId(trimmed)
  if (videoId) return `https://www.youtube.com/embed/${videoId}`
  return trimmed
}

const toWatchUrl = (sourceUrl: string, videoId: string | null) => {
  if (!videoId) return sourceUrl
  return `https://www.youtube.com/watch?v=${videoId}`
}

const TrailerGallery = ({ trailers, gameName = 'game' }: TrailerGalleryProps) => {
  const items = useMemo(() => {
    const seen = new Set<string>()
    return trailers.reduce<TrailerItem[]>((acc, trailer, index) => {
      const sourceUrl = trailer?.trim()
      if (!sourceUrl) return acc
      if (seen.has(sourceUrl)) return acc
      const embedUrl = toEmbedUrl(sourceUrl)
      if (!embedUrl) return acc
      const videoId = toYouTubeVideoId(sourceUrl) ?? toYouTubeVideoId(embedUrl)
      seen.add(sourceUrl)
      acc.push({
        sourceUrl,
        embedUrl,
        videoId,
        thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
        key: videoId ? `${videoId}-${index}` : `${sourceUrl}-${index}`,
      })
      return acc
    }, [])
  }, [trailers])

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!items.length) {
      setActiveIndex(0)
      return
    }
    setActiveIndex((current) => {
      if (current < items.length) return current
      return 0
    })
  }, [items])

  if (!items.length) return null

  const activeTrailer = items[activeIndex]
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
    <div className="trailer-gallery">
      <div className="trailer-gallery__frame-wrap">
        {canNavigate ? (
          <button
            type="button"
            className="trailer-gallery__nav trailer-gallery__nav--prev"
            onClick={showPrevious}
            aria-label="Show previous trailer"
          >
            Prev
          </button>
        ) : null}
        <div className="trailer-gallery__frame">
          <iframe
            src={activeTrailer.embedUrl}
            title={`${gameName} trailer ${activeIndex + 1}`}
            className="trailer-gallery__iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {canNavigate ? (
          <button
            type="button"
            className="trailer-gallery__nav trailer-gallery__nav--next"
            onClick={showNext}
            aria-label="Show next trailer"
          >
            Next
          </button>
        ) : null}
      </div>
      <div className="trailer-gallery__meta">
        <span>
          Trailer {activeIndex + 1} of {items.length}
        </span>
        <a
          href={toWatchUrl(activeTrailer.sourceUrl, activeTrailer.videoId)}
          target="_blank"
          rel="noreferrer"
          className="trailer-gallery__link"
        >
          Open on YouTube
        </a>
      </div>
      {canNavigate ? (
        <div className="trailer-gallery__thumbs" aria-label="Choose trailer">
          {items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              className={`trailer-gallery__thumb${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Play trailer ${index + 1}`}
            >
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="trailer-gallery__thumb-image"
                  loading="lazy"
                />
              ) : (
                <span className="trailer-gallery__thumb-fallback" aria-hidden="true">
                  Trailer
                </span>
              )}
              <span className="trailer-gallery__thumb-label">Trailer {index + 1}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default TrailerGallery
