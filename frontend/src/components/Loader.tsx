import styled from 'styled-components';
import { type ThemeMode } from '../utils/theme';

type LoaderProps = {
  fullScreen?: boolean;
  title?: string;
  subtitle?: string;
  theme?: ThemeMode;
};

const Loader = ({
  fullScreen = false,
  title = 'Loading your next session',
  subtitle = 'Syncing recommendations and game signals...',
  theme = 'dark',
}: LoaderProps) => {
  return (
    <StyledWrapper
      $fullScreen={fullScreen}
      $theme={theme}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
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

const StyledWrapper = styled.div<{ $fullScreen: boolean; $theme: ThemeMode }>`
  ${({ $theme }) =>
    $theme === 'light'
      ? `
    --loader-text: #18354a;
    --loader-muted: rgba(24, 53, 74, 0.88);
    --loader-border: rgba(59, 143, 62, 0.24);
    --loader-track: rgba(24, 53, 74, 0.1);
    --loader-shell-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(235, 245, 252, 0.94));
    --loader-shell-shadow: inset 0 0 0 1px rgba(59, 143, 62, 0.06), 0 10px 18px rgba(31, 67, 92, 0.08);
    --loader-ink: #18354a;
    --loader-pellet: rgba(228, 239, 248, 0.98);
    --loader-pellet-glow: rgba(121, 199, 230, 0.18);
    --loader-drop-shadow: drop-shadow(0 12px 18px rgba(31, 67, 92, 0.12));
    --loader-overlay:
      radial-gradient(1200px 500px at 15% 15%, rgba(133, 197, 103, 0.14), transparent 62%),
      radial-gradient(900px 420px at 85% 80%, rgba(121, 199, 230, 0.12), transparent 60%),
      rgba(245, 251, 255, 0.96);
  `
      : `
    --loader-text: #e2f2ff;
    --loader-muted: rgba(198, 224, 245, 0.78);
    --loader-border: rgba(140, 243, 122, 0.28);
    --loader-track: rgba(226, 242, 255, 0.12);
    --loader-shell-bg: linear-gradient(140deg, rgba(8, 26, 40, 0.92), rgba(7, 18, 30, 0.9));
    --loader-shell-shadow: inset 0 0 0 1px rgba(140, 243, 122, 0.08);
    --loader-ink: #18354a;
    --loader-pellet: rgba(226, 242, 255, 0.95);
    --loader-pellet-glow: rgba(226, 242, 255, 0.22);
    --loader-drop-shadow: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.32));
    --loader-overlay:
      radial-gradient(1200px 500px at 15% 15%, rgba(140, 243, 122, 0.12), transparent 62%),
      radial-gradient(900px 420px at 85% 80%, rgba(67, 197, 248, 0.08), transparent 60%),
      rgba(5, 15, 24, 0.96);
  `}

  display: grid;
  place-items: center;
  ${({ $fullScreen }) =>
    $fullScreen
      ? `
    position: fixed;
    inset: 0;
    z-index: 9999;
    backdrop-filter: blur(14px) saturate(112%);
    background: var(--loader-overlay);
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
    color: var(--loader-text);
    letter-spacing: 0.01em;
  }

  .loader-subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: var(--loader-muted);
    text-align: center;
  }

  .loader-progress {
    width: min(80vw, 260px);
    height: 5px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--loader-track);
    border: 1px solid var(--loader-border);
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
    filter: var(--loader-drop-shadow);
  }

  .loader-icon rect {
    fill: transparent;
    stroke: var(--loader-border);
  }

  .loader-wrapper::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--loader-shell-bg);
    border: 1px solid var(--loader-border);
    box-shadow: var(--loader-shell-shadow);
    pointer-events: none;
    z-index: 0;
  }

  .loader-icon .pacman-body {
    fill: #c7f000;
  }

  .loader-icon .pacman-eye {
    fill: var(--loader-ink);
  }

  .loader-icon .pacman-mouth {
    fill: var(--loader-ink);
    transform-origin: 30px 24px;
    animation: pac-mouth 0.5s ease-in-out infinite;
  }

  .loader-icon .pellet-dot {
    fill: var(--loader-pellet);
    filter: drop-shadow(0 0 6px var(--loader-pellet-glow));
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

  @media (max-width: 520px) {
    .loader-shell {
      width: min(100%, calc(100vw - 24px));
      gap: 8px;
    }

    .loader-title {
      font-size: 1rem;
      text-align: center;
    }

    .loader-subtitle {
      font-size: 0.82rem;
      line-height: 1.45;
    }

    .loader-progress {
      width: 100%;
    }

    .loader-wrapper {
      width: 88px;
      height: 42px;
      margin: 8px auto;
    }

    .loader-icon {
      width: 88px;
      height: 42px;
    }
  }

  @media (max-width: 420px) {
    .loader-shell {
      width: min(100%, calc(100vw - 16px));
    }

    .loader-title {
      font-size: 0.94rem;
    }

    .loader-subtitle {
      font-size: 0.78rem;
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
