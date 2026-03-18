import styled from 'styled-components'

type ButtonProps = {
  label: string
  showIcon?: boolean
  pulseIcon?: boolean
  onClick?: () => void | Promise<void>
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const Button = ({
  label,
  showIcon = true,
  pulseIcon = false,
  onClick,
  disabled = false,
  type = 'button',
}: ButtonProps) => {
  return (
    <StyledWrapper>
      <button type={type} onClick={onClick} disabled={disabled}>
        <span>{label}</span>
        {showIcon &&
          (pulseIcon ? (
            <span className="button__icon-heart" aria-hidden="true">
              <svg className="button__icon-empty" viewBox="0 0 24 24">
                <path fill="none" d="M0 0H24V24H0z" />
                <path d="M16.5 3C19.538 3 22 5.5 22 9c0 7-7.5 11-10 12.5C9.5 20 2 16 2 9c0-3.5 2.5-6 5.5-6C9.36 3 11 4 12 5c1-1 2.64-2 4.5-2zm-3.566 15.604c.881-.556 1.676-1.109 2.42-1.701C18.335 14.533 20 11.943 20 9c0-2.36-1.537-4-3.5-4-1.076 0-2.24.57-3.086 1.414L12 7.828l-1.414-1.414C9.74 5.57 8.576 5 7.5 5 5.56 5 4 6.656 4 9c0 2.944 1.666 5.533 4.645 7.903.745.592 1.54 1.145 2.421 1.7.299.189.595.37.934.572.339-.202.635-.383.934-.571z" />
              </svg>
              <svg className="button__icon-filled" viewBox="0 0 24 24">
                <path d="M0 0H24V24H0z" fill="none" />
                <path d="M16.5 3C19.538 3 22 5.5 22 9c0 7-7.5 11-10 12.5C9.5 20 2 16 2 9c0-3.5 2.5-6 5.5-6C9.36 3 11 4 12 5c1-1 2.64-2 4.5-2z" />
              </svg>
            </span>
          ) : (
            <svg className="button__icon-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 74 74" height={34} width={34}>
              <circle strokeWidth={3} stroke="black" r="35.5" cy={37} cx={37} />
              <path fill="black" d="M25 35.5C24.1716 35.5 23.5 36.1716 23.5 37C23.5 37.8284 24.1716 38.5 25 38.5V35.5ZM49.0607 38.0607C49.6464 37.4749 49.6464 36.5251 49.0607 35.9393L39.5147 26.3934C38.9289 25.8076 37.9792 25.8076 37.3934 26.3934C36.8076 26.9792 36.8076 27.9289 37.3934 28.5147L45.8787 37L37.3934 45.4853C36.8076 46.0711 36.8076 47.0208 37.3934 47.6066C37.9792 48.1924 38.9289 48.1924 39.5147 47.6066L49.0607 38.0607ZM25 38.5L48 38.5V35.5L25 35.5V38.5Z" />
            </svg>
          ))}
      </button>
    </StyledWrapper>
  )
}

const StyledWrapper = styled.div`
  button {
    --np-button-bg: var(--games-button-bg, linear-gradient(135deg, #c7f000, #8cf37a));
    --np-button-bg-hover: var(--games-button-bg-hover, linear-gradient(135deg, #d2f72d, #a6f08a));
    --np-button-text: var(--games-button-text, #07131a);
    --np-button-border: var(--games-button-border, rgba(199, 240, 0, 0.55));
    --np-button-shadow: var(--games-button-shadow, 0 10px 20px rgba(7, 15, 22, 0.28));
    --np-button-shadow-hover: var(--games-button-shadow-hover, 0 14px 24px rgba(7, 15, 22, 0.34));
    --np-button-icon: var(--games-button-icon, #08161f);
    cursor: pointer;
    font-weight: 700;
    transition:
      transform 280ms var(--np-btn-ease),
      border-color 280ms ease-in-out,
      background-color 280ms ease-in-out,
      box-shadow 280ms ease-in-out;
    padding: 11px 20px;
    border-radius: 100px;
    background: var(--np-button-bg);
    color: var(--np-button-text);
    border: 1px solid var(--np-button-border);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    position: relative;
    min-height: 42px;
    justify-content: center;
    letter-spacing: 0.01em;
    text-shadow: none;
    box-shadow:
      var(--np-button-shadow),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  @keyframes movingBorders {
    0% {
      border-color: #f3fbd3;
    }

    50% {
      border-color: #d6f28a;
    }

    90% {
      border-color: #f3fbd3;
    }
  }

  button:hover {
    background: var(--np-button-bg-hover);
    transform: translateY(-1px);
    animation: movingBorders 3s infinite;
    box-shadow:
      var(--np-button-shadow-hover),
      inset 0 1px 0 rgba(255, 255, 255, 0.34);
  }

  button span {
    color: inherit;
  }

  .button__icon-arrow {
    width: 34px;
    margin-left: 2px;
    transition: transform 0.3s ease-in-out;
  }

  .button__icon-arrow circle {
    stroke: var(--np-button-icon);
  }

  .button__icon-arrow path {
    fill: var(--np-button-icon);
  }

  button:hover .button__icon-arrow {
    transform: translateX(5px);
  }

  .button__icon-heart {
    position: relative;
    width: 20px;
    height: 20px;
    margin-left: 10px;
    display: inline-flex;
  }

  .button__icon-heart svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 20px;
    height: 20px;
    fill: rgb(255, 110, 110);
    transition: opacity 100ms ease-in-out;
  }

  .button__icon-filled {
    opacity: 0;
  }

  @keyframes beatingHeart {
    0% {
      transform: scale(1);
    }

    15% {
      transform: scale(1.15);
    }

    30% {
      transform: scale(1);
    }

    45% {
      transform: scale(1.15);
    }

    60% {
      transform: scale(1);
    }
  }

  button:hover .button__icon-empty {
    opacity: 0;
  }

  button:hover .button__icon-filled {
    opacity: 1;
    animation: beatingHeart 1.2s infinite;
  }

  button:active {
    transform: translateY(0) scale(0.98);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 520px) {
    button {
      width: 100%;
      padding: 10px 14px;
      font-size: 14px;
    }

    .button__icon-arrow {
      width: 28px;
      height: 28px;
      margin-left: 8px;
    }
  }
`

export default Button
