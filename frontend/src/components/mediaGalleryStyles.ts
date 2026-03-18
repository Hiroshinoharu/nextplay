import styled, { css } from 'styled-components'

export const Gallery = styled.div`
  margin-top: 14px;
  display: grid;
  gap: 12px;
`

export const FrameWrap = styled.div`
  position: relative;
  touch-action: pan-y;
`

const sharedFrameShell = css`
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--game-border, rgba(226, 242, 255, 0.16));
  background:
    radial-gradient(circle at top, var(--games-card-poster-glow, rgba(140, 243, 122, 0.06)), transparent 52%),
    var(--games-card-poster-bg, linear-gradient(155deg, rgba(8, 22, 34, 0.94), rgba(4, 12, 20, 0.95)));
  box-shadow:
    var(--games-card-poster-shadow, 0 20px 40px rgba(0, 0, 0, 0.34)),
    inset 0 0 0 1px var(--games-card-info-inset, rgba(140, 243, 122, 0.1));
`

export const FramePanel = styled.div`
  ${sharedFrameShell}
`

export const FrameButton = styled.button`
  ${sharedFrameShell}
  padding: 0;
  cursor: pointer;
  max-height: min(72vh, 560px);

  &:focus-visible {
    outline: 2px solid var(--game-accent, #8cf37a);
    outline-offset: 2px;
  }
`

export const FrameImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
`

export const NavButton = styled.button<{ $position: 'prev' | 'next' }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  border: 1px solid var(--game-border, rgba(140, 243, 122, 0.36));
  color: var(--game-text, #e2f2ff);
  background: var(--games-surface, var(--game-panel, rgba(8, 22, 34, 0.84)));
  border-radius: 999px;
  cursor: pointer;
  padding: 8px 12px;
  min-width: 78px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  backdrop-filter: blur(3px);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  left: ${({ $position }) => ($position === 'prev' ? '12px' : 'auto')};
  right: ${({ $position }) => ($position === 'next' ? '12px' : 'auto')};

  &:hover {
    background: var(--games-accent-surface, rgba(140, 243, 122, 0.16));
    border-color: var(--games-border-active, rgba(140, 243, 122, 0.62));
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
  }

  @media (max-width: 640px) {
    top: auto;
    bottom: 10px;
    transform: none;
    min-width: 68px;
    font-size: 11px;
    padding: 6px 10px;
    left: ${({ $position }) => ($position === 'prev' ? '10px' : 'auto')};
    right: ${({ $position }) => ($position === 'next' ? '10px' : 'auto')};
  }
`

export const Meta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--game-muted, rgba(226, 242, 255, 0.75));
  font-size: 12px;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
`

export const Thumbs = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(140, 243, 122, 0.45) transparent;
`

export const ThumbButton = styled.button`
  flex: 0 0 auto;
  position: relative;
  width: 118px;
  height: 68px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--game-border, rgba(226, 242, 255, 0.2));
  border-radius: 9px;
  color: var(--game-text, #e2f2ff);
  background: var(--game-card, #040b12);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &[data-active='true'] {
    border-color: var(--game-accent, #8cf37a);
    box-shadow:
      0 0 0 1px rgba(140, 243, 122, 0.24),
      0 10px 18px rgba(0, 0, 0, 0.26);
  }

  &:hover {
    border-color: var(--game-accent, #8cf37a);
  }

  &:hover img {
    transform: scale(1.04);
    opacity: 1;
  }

  @media (max-width: 520px) {
    width: 104px;
    height: 62px;
  }
`

export const ThumbImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  opacity: 0.92;
  transition: transform 0.2s ease, opacity 0.2s ease;
`

export const ThumbLabel = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 4px 6px;
  background: linear-gradient(180deg, transparent 0%, rgba(4, 10, 16, 0.88) 100%);
  color: var(--game-text, #e2f2ff);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;

  @media (max-width: 520px) {
    font-size: 9px;
    letter-spacing: 0.05em;
  }
`
