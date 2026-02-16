import type { ReactNode } from 'react';
import styled from 'styled-components';

// Props for Card Component
type CardProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  variant?: 'poster' | 'info';
  onClick?: () => void;
  ariaLabel?: string;
};

const DEFAULT_TITLE = 'Loreum Ipsum';
const DEFAULT_DESCRIPTION =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

// Card Component
const Card = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  icon,
  variant = 'poster',
  onClick,
  ariaLabel,
}: CardProps) => {
  const Component = onClick ? 'button' : 'div';
  const clickableClass = onClick ? 'card--clickable' : '';
  return (
    <StyledWrapper>
      <Component
        className={`card card--${variant} ${clickableClass}`}
        onClick={onClick}
        type={onClick ? 'button' : undefined}
        aria-label={ariaLabel}
      >
        {icon ?? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M20 5H4V19L13.2923 9.70649C13.6828 9.31595 14.3159 9.31591 14.7065 9.70641L20 15.0104V5ZM2 3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z" />
          </svg>
        )}
        <div className="card__content">
          <p className="card__title">{title}</p>
          {description && <div className="card__description">{description}</div>}
        </div>
      </Component>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .card {
    position: relative;
    border-radius: 14px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: none;
    padding: 0;
    text-align: left;
    background: none;
    cursor: default;
    isolation: isolate;
    transform: translateZ(0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .card--clickable {
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    translate: none;
    scale: 1;
    filter: none;
  }

  .card--clickable:hover,
  .card--clickable:active {
    translate: none;
    scale: 1;
    filter: none;
  }

  .card--poster {
    width: 180px;
    height: 260px;
    background:
      radial-gradient(circle at top, rgba(140, 243, 122, 0.06), transparent 55%),
      linear-gradient(145deg, rgba(8, 22, 34, 0.94), rgba(6, 14, 22, 0.96));
    box-shadow: 0 14px 30px rgba(7, 12, 16, 0.52);
    transform: translateZ(0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    clip-path: inset(0 round 14px);
    -webkit-mask-image: -webkit-radial-gradient(white, black);
  }

  .card--poster:hover {
    transform: translateY(-5px) scale(1.03);
    box-shadow: 0 20px 40px rgba(7, 12, 16, 0.66);
  }

  .card--clickable:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 3px;
  }

  .card--clickable:focus {
    outline: none;
  }

  .card--poster svg {
    width: 48px;
    fill: #cbd5f5;
    opacity: 0.65;
    transition: opacity 0.3s ease;
  }

  .card--poster:hover svg {
    opacity: 0;
  }

  .card__content {
    width: 100%;
    padding: 14px 15px;
    box-sizing: border-box;
    background: linear-gradient(180deg, rgba(4, 9, 12, 0.05) 0%, rgba(4, 9, 12, 0.65) 55%, rgba(4, 9, 12, 0.9) 100%);
    transition: transform 0.3s ease;
  }

  .card--poster .card__content {
    position: absolute;
    bottom: 0;
    transform: translateY(38%);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .card--poster:hover .card__content {
    transform: translateY(0%);
  }

  .card__title {
    margin: 0;
    font-size: 15px;
    color: #f8fafc;
    font-weight: 700;
    letter-spacing: 0.015em;
  }

  .card__description {
    margin: 8px 0 0;
    font-size: 12px;
    color: #d2ddf7;
    line-height: 1.4;
    white-space: pre-line;
  }

  .card__image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 14px;
    transition: transform 0.35s ease;
    transform: translateZ(0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    clip-path: inset(0 round 14px);
  }

  .card--poster:hover .card__image {
    transform: scale(1.05);
  }

  .card--info {
    width: 280px;
    min-height: 220px;
    background:
      radial-gradient(circle at top, rgba(140, 243, 122, 0.06), transparent 60%),
      linear-gradient(150deg, rgba(8, 28, 44, 0.92), rgba(7, 19, 31, 0.9));
    box-shadow:
      0 16px 30px rgba(0, 0, 0, 0.28),
      inset 0 0 0 1px rgba(140, 243, 122, 0.12);
    align-items: flex-start;
    border: 1px solid rgba(140, 243, 122, 0.24);
  }

  .card--info .card__content {
    position: relative;
    background: none;
    color: #e2f2ff;
  }

  .card--info .card__title {
    color: #e2f2ff;
    font-size: 18px;
  }

  .card--info .card__description {
    color: rgba(226, 242, 255, 0.76);
    font-size: 13px;
  }

  .card__link {
    color: inherit;
    text-decoration: none;
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
  }

  .card__link:hover {
    text-decoration: underline;
  }

  @media (max-width: 520px) {
    .card--poster {
      width: 100%;
      min-height: 210px;
      height: 210px;
    }

    .card__content {
      padding: 12px;
    }

    .card__title {
      font-size: 14px;
    }

    .card__description {
      font-size: 11px;
      margin-top: 6px;
    }

    .card--info {
      width: min(100%, 280px);
      min-height: 190px;
    }
  }`;

export default Card;
