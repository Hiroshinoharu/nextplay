import { useCallback, useEffect } from 'react'
import './lightbox.css'

type LightboxProps = {
  images: string[]
  activeIndex: number | null
  onChangeIndex: (nextIndex: number) => void
  onClose: () => void
  altContext?: string
}

const Lightbox = ({
  images,
  activeIndex,
  onChangeIndex,
  onClose,
  altContext = 'image',
}: LightboxProps) => {
  const isOpen = activeIndex !== null && images.length > 0

  const showPrev = useCallback(() => {
    if (!images.length || activeIndex === null) return
    onChangeIndex((activeIndex - 1 + images.length) % images.length)
  }, [activeIndex, images.length, onChangeIndex])

  const showNext = useCallback(() => {
    if (!images.length || activeIndex === null) return
    onChangeIndex((activeIndex + 1) % images.length)
  }, [activeIndex, images.length, onChangeIndex])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showPrev()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        showNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose, showNext, showPrev])

  if (!isOpen || activeIndex === null) return null

  return (
    <div className="media-lightbox" onClick={onClose}>
      <div
        className="media-lightbox__dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="media-lightbox__close"
          onClick={onClose}
          aria-label="Close lightbox"
        >
          Close
        </button>
        <button
          type="button"
          className="media-lightbox__nav media-lightbox__nav--prev"
          onClick={showPrev}
          aria-label="Previous image"
        >
          Prev
        </button>
        <figure className="media-lightbox__figure">
          <img
            src={images[activeIndex]}
            alt={`Screenshot ${activeIndex + 1} of ${altContext}`}
            className="media-lightbox__image"
          />
        </figure>
        <button
          type="button"
          className="media-lightbox__nav media-lightbox__nav--next"
          onClick={showNext}
          aria-label="Next image"
        >
          Next
        </button>
        <div className="media-lightbox__caption">
          Screenshot {activeIndex + 1} of {images.length}
        </div>
        {images.length > 1 ? (
          <div className="media-lightbox__thumbs" aria-label="Choose screenshot">
            {images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                className={`media-lightbox__thumb${index === activeIndex ? ' is-active' : ''}`}
                onClick={() => onChangeIndex(index)}
                aria-label={`Open screenshot ${index + 1}`}
              >
                <img src={image} alt="" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Lightbox
