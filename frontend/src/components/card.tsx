import type { ReactNode } from 'react';
import styled from 'styled-components';

type CardProps = {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  variant?: 'poster' | 'info';
};

const DEFAULT_TITLE = 'Clair Obscur: Expedition 33';
const DEFAULT_DESCRIPTION =
  'Lead the members of Expedition 33 on their quest to destroy the Paintress so that she can never paint death again. Explore a world of wonders inspired by Belle Époque France and battle unique enemies in this turn-based RPG with real-time mechanics.';

const Card = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  icon,
  variant = 'poster',
}: CardProps) => {
  return (
    <StyledWrapper>
      <div className={`card card--${variant}`}>
        {icon ?? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M20 5H4V19L13.2923 9.70649C13.6828 9.31595 14.3159 9.31591 14.7065 9.70641L20 15.0104V5ZM2 3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z" />
          </svg>
        )}
        <div className="card__content">
          <p className="card__title">{title}</p>
          {description && <div className="card__description">{description}</div>}
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .card {
    position: relative;
    border-radius: 12px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    overflow: hidden;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .card--poster {
    width: 180px;
    height: 260px;
    background: #0c141a;
    box-shadow: 0 10px 30px rgba(7, 12, 16, 0.55);
  }

  .card--poster:hover {
    transform: translateY(-6px) scale(1.04);
    box-shadow: 0 18px 40px rgba(7, 12, 16, 0.75);
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
    padding: 14px 16px;
    box-sizing: border-box;
    background: linear-gradient(180deg, rgba(4, 9, 12, 0.05) 0%, rgba(4, 9, 12, 0.65) 55%, rgba(4, 9, 12, 0.9) 100%);
    transition: transform 0.3s ease;
  }

  .card--poster .card__content {
    position: absolute;
    bottom: 0;
    transform: translateY(38%);
  }

  .card--poster:hover .card__content {
    transform: translateY(0%);
  }

  .card__title {
    margin: 0;
    font-size: 15px;
    color: #f8fafc;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .card__description {
    margin: 8px 0 0;
    font-size: 12px;
    color: #cbd5f5;
    line-height: 1.4;
    white-space: pre-line;
  }

  .card__image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 12px;
    transition: transform 0.35s ease;
  }

  .card--poster:hover .card__image {
    transform: scale(1.05);
  }

  .card--info {
    width: 280px;
    min-height: 220px;
    background: #f1f5f9;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
    align-items: flex-start;
  }

  .card--info .card__content {
    position: relative;
    background: none;
    color: #0f172a;
  }

  .card--info .card__title {
    color: #0f172a;
    font-size: 18px;
  }

  .card--info .card__description {
    color: #334155;
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
  }`;

export default Card;
