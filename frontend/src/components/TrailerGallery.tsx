import { useMemo, useRef, useState, type TouchEvent } from 'react'
import styled from 'styled-components'
import {
  FramePanel,
  FrameWrap,
  Gallery,
  Meta,
  NavButton,
  ThumbButton,
  ThumbImage,
  ThumbLabel,
  Thumbs,
} from './mediaGalleryStyles'

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
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  if (!items.length) return null

  const safeActiveIndex = activeIndex < items.length ? activeIndex : 0
  const activeTrailer = items[safeActiveIndex]
  const canNavigate = items.length > 1

  const showPrevious = () => {
    if (!canNavigate) return
    setActiveIndex((current) => {
      const clampedIndex = current < items.length ? current : 0
      return (clampedIndex - 1 + items.length) % items.length
    })
  }

  const showNext = () => {
    if (!canNavigate) return
    setActiveIndex((current) => {
      const clampedIndex = current < items.length ? current : 0
      return (clampedIndex + 1) % items.length
    })
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
            aria-label="Show previous trailer"
          >
            Back
          </NavButton>
        ) : null}
        <FramePanel>
          <TrailerFrame
            src={activeTrailer.embedUrl}
            title={`${gameName} trailer ${safeActiveIndex + 1}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </FramePanel>
        {canNavigate ? (
          <NavButton
            type="button"
            $position="next"
            onClick={showNext}
            aria-label="Show next trailer"
          >
            Next
          </NavButton>
        ) : null}
      </FrameWrap>
      <Meta>
        <span>
          Trailer {safeActiveIndex + 1} of {items.length}
        </span>
        <MetaLink
          href={toWatchUrl(activeTrailer.sourceUrl, activeTrailer.videoId)}
          target="_blank"
          rel="noreferrer"
        >
          Open on YouTube
        </MetaLink>
      </Meta>
      {canNavigate ? (
        <Thumbs aria-label="Choose trailer">
          {items.map((item, index) => (
            <ThumbButton
              key={item.key}
              type="button"
              data-active={index === safeActiveIndex}
              onClick={() => setActiveIndex(index)}
              aria-label={`Play trailer ${index + 1}`}
            >
              {item.thumbnailUrl ? (
                <ThumbImage src={item.thumbnailUrl} alt="" loading="lazy" />
              ) : (
                <ThumbFallback aria-hidden="true">Trailer</ThumbFallback>
              )}
              <ThumbLabel>Trailer {index + 1}</ThumbLabel>
            </ThumbButton>
          ))}
        </Thumbs>
      ) : null}
    </Gallery>
  )
}

const TrailerFrame = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  display: block;
`


const MetaLink = styled.a`
  color: var(--game-accent, #8cf37a);
  text-decoration: none;
  border-bottom: 1px solid transparent;

  &:hover {
    border-color: currentColor;
  }
`


const ThumbFallback = styled.span`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(226, 242, 255, 0.85);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
`


export default TrailerGallery
