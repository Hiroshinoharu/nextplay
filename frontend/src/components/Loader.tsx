import styled from 'styled-components';

type LoaderProps = {
  fullScreen?: boolean;
  title?: string;
  subtitle?: string;
};

const Loader = ({
  fullScreen = false,
  title = 'Loading your next session',
  subtitle = 'Syncing recommendations and game signals...',
}: LoaderProps) => {
  return (
    <StyledWrapper $fullScreen={fullScreen} role="status" aria-live="polite" aria-label="Loading">
      <div className="loader-shell">
        <div className="loader-wrapper">
          <svg
            className="loader-icon"
            viewBox="0 0 104 48"
            role="presentation"
            aria-hidden="true"
          >
            <rect x="0.5" y="0.5" width="103" height="47" rx="23.5" ry="23.5" />
            <circle className="pacman-body" cx="30" cy="24" r="15" />
            <circle className="pacman-eye" cx="32.4" cy="15.8" r="2.5" />
            <polygon className="pacman-mouth" points="30,24 45,17 45,31" />
            <g className="pellet pellet--1">
              <circle className="pellet-dot" cx="74" cy="24" r="4" />
            </g>
            <g className="pellet pellet--2">
              <circle className="pellet-dot" cx="74" cy="24" r="4" />
            </g>
            <g className="pellet pellet--3">
              <circle className="pellet-dot" cx="74" cy="24" r="4" />
            </g>
            <g className="pellet pellet--4">
              <circle className="pellet-dot" cx="74" cy="24" r="4" />
            </g>
          </svg>
        </div>
        <p className="loader-title">{title}</p>
        <p className="loader-subtitle">{subtitle}</p>
        <div className="loader-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div<{ $fullScreen: boolean }>`
  display: grid;
  place-items: center;
  ${({ $fullScreen }) =>
    $fullScreen
      ? `
    position: fixed;
    inset: 0;
    z-index: 9999;
    backdrop-filter: blur(14px) saturate(112%);
    background:
      radial-gradient(1200px 500px at 15% 15%, rgba(140, 243, 122, 0.12), transparent 62%),
      radial-gradient(900px 420px at 85% 80%, rgba(67, 197, 248, 0.08), transparent 60%),
      rgba(5, 15, 24, 0.96);
  `
      : `
    width: 100%;
    padding: 14px 0;
  `}

  .loader-shell {
    display: grid;
    justify-items: center;
    gap: 10px;
    width: min(90vw, 420px);
    animation: intro 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .loader-title {
    margin: 0;
    font-size: clamp(1.02rem, 1.2vw, 1.24rem);
    font-weight: 700;
    color: rgba(226, 242, 255, 0.96);
    letter-spacing: 0.01em;
  }

  .loader-subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(199, 225, 246, 0.76);
    text-align: center;
  }

  .loader-progress {
    width: min(80vw, 260px);
    height: 5px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(226, 242, 255, 0.12);
    border: 1px solid rgba(140, 243, 122, 0.22);
  }

  .loader-progress span {
    display: block;
    width: 45%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #8cf37a, #c7f000 42%, #d7fcae);
    animation: progress-slide 1.3s ease-in-out infinite;
  }

  .loader-wrapper {
    position: relative;
    width: 104px;
    height: 48px;
    margin: 10px auto;
    overflow: hidden;
  }

  .loader-icon {
    width: 104px;
    height: 48px;
    display: block;
    filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.32));
  }

  .loader-icon rect {
    fill: transparent;
    stroke: rgba(140, 243, 122, 0.3);
  }

  .loader-wrapper::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: linear-gradient(140deg, rgba(8, 26, 40, 0.9), rgba(7, 18, 30, 0.9));
    border: 1px solid rgba(140, 243, 122, 0.28);
    box-shadow: inset 0 0 0 1px rgba(140, 243, 122, 0.08);
    pointer-events: none;
    z-index: 0;
  }

  .loader-icon .pacman-body {
    fill: #c7f000;
  }

  .loader-icon .pacman-eye {
    fill: rgba(6, 22, 34, 0.82);
  }

  .loader-icon .pacman-mouth {
    fill: rgba(7, 20, 32, 0.96);
    transform-origin: 30px 24px;
    animation: pac-mouth 0.5s ease-in-out infinite;
  }

  .loader-icon .pellet-dot {
    fill: rgba(226, 242, 255, 0.95);
    filter: drop-shadow(0 0 6px rgba(226, 242, 255, 0.22));
  }

  .loader-icon .pellet {
    animation: pellet-run 1.25s linear infinite;
  }

  .loader-icon .pellet--1 {
    animation-delay: 0s;
  }

  .loader-icon .pellet--2 {
    animation-delay: 0.31s;
  }

  .loader-icon .pellet--3 {
    animation-delay: 0.62s;
  }

  .loader-icon .pellet--4 {
    animation-delay: 0.93s;
  }

  @keyframes pac-mouth {
    0%, 100% {
      transform: scaleY(0.7);
    }
    50% {
      transform: scaleY(1.35);
    }
  }

  @keyframes pellet-run {
    0% {
      transform: translateX(22px) scale(1);
      opacity: 0;
    }
    10% {
      transform: translateX(16px) scale(1);
      opacity: 0.96;
    }
    76% {
      transform: translateX(-30px) scale(1);
      opacity: 0.96;
    }
    100% {
      transform: translateX(-41px) scale(0.52);
      opacity: 0;
    }
  }

  @keyframes progress-slide {
    0% {
      transform: translateX(-130%);
    }
    55% {
      transform: translateX(125%);
    }
    100% {
      transform: translateX(125%);
    }
  }

  @keyframes intro {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loader-shell {
      animation: none;
    }
    .loader-progress span {
      animation: none;
      transform: none;
      width: 100%;
    }
    .loader-icon .pacman-mouth,
    .loader-icon .pellet {
      animation: none;
    }
  }
`;

export default Loader;
