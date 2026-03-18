import styled from "styled-components";
import BrandLogo from "./BrandLogo";
import Loader from "./Loader";
import { type ThemeMode } from "../utils/theme";

type LoadingScreenProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  hints?: string[];
  fullScreen?: boolean;
  theme?: ThemeMode;
};

const DEFAULT_HINTS = [
  "Syncing live catalog data",
  "Staging artwork and screenshots",
  "Lining up your next picks",
];

const LoadingScreen = ({
  eyebrow = "NextPlay is getting things ready",
  title,
  subtitle,
  hints = DEFAULT_HINTS,
  fullScreen = true,
  theme = "dark",
}: LoadingScreenProps) => {
  const visibleHints = hints.filter(Boolean).slice(0, 3);

  return (
    <StyledWrapper
      $fullScreen={fullScreen}
      $theme={theme}
      role="status"
      aria-live="polite"
    >
      <div className="loading-screen__panel">
        <BrandLogo
          className="loading-screen__brand"
          width={72}
          height={72}
          label="NextPlay"
        />
        <p className="loading-screen__eyebrow">{eyebrow}</p>
        <Loader title={title} subtitle={subtitle} theme={theme} />
        {visibleHints.length ? (
          <ul className="loading-screen__status-list" aria-label="Loading progress details">
            {visibleHints.map((hint, index) => (
              <li key={`${hint}-${index}`} className="loading-screen__status-item">
                {hint}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div<{ $fullScreen: boolean; $theme: ThemeMode }>`
  ${({ $theme }) =>
    $theme === "light"
      ? `
    --loading-screen-text: #18354a;
    --loading-screen-muted: rgba(24, 53, 74, 0.88);
    --loading-screen-accent: #5fa93b;
    --loading-screen-border: rgba(59, 143, 62, 0.18);
    --loading-screen-panel: linear-gradient(160deg, rgba(255, 255, 255, 0.96), rgba(236, 246, 255, 0.92));
    --loading-screen-surface: rgba(255, 255, 255, 0.94);
    --loading-screen-glow: rgba(133, 197, 103, 0.1);
  `
      : `
    --loading-screen-text: #e2f2ff;
    --loading-screen-muted: rgba(198, 224, 245, 0.82);
    --loading-screen-accent: #8cf37a;
    --loading-screen-border: rgba(140, 243, 122, 0.2);
    --loading-screen-panel: linear-gradient(160deg, rgba(7, 21, 34, 0.96), rgba(6, 17, 27, 0.92));
    --loading-screen-surface: rgba(10, 28, 42, 0.64);
    --loading-screen-glow: rgba(140, 243, 122, 0.1);
  `}

  ${({ $fullScreen, $theme }) =>
    $fullScreen
      ? `
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    place-items: center;
    padding: clamp(18px, 4vw, 32px);
    background:
      ${
        $theme === "light"
          ? "radial-gradient(1200px 520px at 16% 14%, rgba(133, 197, 103, 0.16), transparent 60%), radial-gradient(1000px 480px at 84% 78%, rgba(121, 199, 230, 0.16), transparent 58%), linear-gradient(180deg, rgba(245, 251, 255, 0.96), rgba(228, 240, 248, 0.98))"
          : "radial-gradient(1200px 520px at 16% 14%, rgba(140, 243, 122, 0.16), transparent 60%), radial-gradient(1000px 480px at 84% 78%, rgba(67, 197, 248, 0.12), transparent 58%), linear-gradient(180deg, rgba(4, 12, 20, 0.96), rgba(7, 20, 31, 0.98))"
      };
    backdrop-filter: blur(18px) saturate(118%);
  `
      : `
    width: 100%;
    display: grid;
    place-items: center;
    padding: 18px 0;
  `}

  .loading-screen__panel {
    position: relative;
    width: min(92vw, 560px);
    padding: clamp(24px, 4vw, 34px);
    border-radius: 28px;
    border: 1px solid var(--loading-screen-border);
    background:
      var(--loading-screen-panel),
      radial-gradient(circle at top right, var(--loading-screen-glow), transparent 40%);
    box-shadow:
      0 30px 70px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    overflow: hidden;
  }

  .loading-screen__panel::before {
    content: "";
    position: absolute;
    inset: auto -10% -48% 12%;
    height: 180px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(140, 243, 122, 0.18), transparent 68%);
    filter: blur(24px);
    pointer-events: none;
  }

  .loading-screen__brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    width: fit-content;
    margin: 0 auto 14px;
    color: var(--loading-screen-accent);
    font-size: clamp(1.3rem, 2.1vw, 1.65rem);
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.04em;
  }

  .loading-screen__brand img {
    display: block;
    filter: drop-shadow(0 12px 26px rgba(0, 0, 0, 0.28));
  }

  .loading-screen__brand span {
    display: block;
    transform: translateY(1px);
  }

  .loading-screen__eyebrow {
    margin: 0 0 14px;
    text-align: center;
    color: var(--loading-screen-muted);
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .loading-screen__panel .loader-shell {
    width: 100%;
    gap: 12px;
  }

  .loading-screen__panel .loader-title {
    font-size: clamp(1.16rem, 1.8vw, 1.45rem);
  }

  .loading-screen__panel .loader-subtitle {
    max-width: 40ch;
  }

  .loading-screen__panel .loader-progress {
    width: min(82vw, 320px);
  }

  .loading-screen__status-list {
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }

  .loading-screen__status-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 46px;
    padding: 0 14px 0 40px;
    border-radius: 16px;
    border: 1px solid var(--loading-screen-border);
    background: var(--loading-screen-surface);
    color: var(--loading-screen-text);
    font-size: 0.95rem;
    line-height: 1.35;
    animation: status-glow 2.4s ease-in-out infinite;
  }

  .loading-screen__status-item::before {
    content: "";
    position: absolute;
    left: 14px;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: linear-gradient(135deg, #8cf37a, #d4ff52);
    box-shadow: 0 0 0 0 rgba(140, 243, 122, 0.35);
    animation: pulse-dot 1.8s ease-out infinite;
  }

  .loading-screen__status-item:nth-child(2) {
    animation-delay: 0.22s;
  }

  .loading-screen__status-item:nth-child(2)::before {
    animation-delay: 0.22s;
  }

  .loading-screen__status-item:nth-child(3) {
    animation-delay: 0.44s;
  }

  .loading-screen__status-item:nth-child(3)::before {
    animation-delay: 0.44s;
  }

  @keyframes pulse-dot {
    0% {
      box-shadow: 0 0 0 0 rgba(140, 243, 122, 0.34);
      opacity: 0.88;
      transform: scale(0.92);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(140, 243, 122, 0);
      opacity: 1;
      transform: scale(1);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(140, 243, 122, 0);
      opacity: 0.9;
      transform: scale(0.95);
    }
  }

  @keyframes status-glow {
    0%,
    100% {
      border-color: rgba(140, 243, 122, 0.14);
      transform: translateY(0);
    }
    50% {
      border-color: rgba(140, 243, 122, 0.3);
      transform: translateY(-1px);
    }
  }

  @media (max-width: 640px) {
    .loading-screen__panel {
      border-radius: 22px;
      padding: 22px 18px;
    }

    .loading-screen__brand {
      gap: 10px;
      font-size: 1.18rem;
    }

    .loading-screen__status-item {
      min-height: 44px;
      padding-inline: 14px;
      padding-left: 38px;
      font-size: 0.9rem;
    }
  }

  @media (max-width: 520px) {
    .loading-screen__panel {
      width: min(100%, calc(100vw - 20px));
      padding: 18px 14px;
      border-radius: 18px;
    }

    .loading-screen__brand {
      gap: 8px;
      margin-bottom: 10px;
      font-size: 1.02rem;
    }

    .loading-screen__brand img {
      width: 56px;
      height: 56px;
    }

    .loading-screen__eyebrow {
      margin-bottom: 10px;
      font-size: 0.7rem;
      letter-spacing: 0.12em;
    }

    .loading-screen__panel .loader-progress {
      width: 100%;
    }

    .loading-screen__status-list {
      margin-top: 14px;
      gap: 8px;
    }

    .loading-screen__status-item {
      min-height: 40px;
      padding: 10px 12px 10px 34px;
      border-radius: 14px;
      font-size: 0.84rem;
      line-height: 1.3;
    }

    .loading-screen__status-item::before {
      left: 12px;
      width: 10px;
      height: 10px;
    }
  }

  @media (max-width: 420px) {
    .loading-screen__panel {
      width: min(100%, calc(100vw - 16px));
      padding: 16px 12px;
      border-radius: 16px;
    }

    .loading-screen__panel::before {
      inset: auto -16% -54% 8%;
      height: 140px;
    }

    .loading-screen__brand span {
      letter-spacing: 0.03em;
    }

    .loading-screen__status-item {
      font-size: 0.8rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-screen__status-item,
    .loading-screen__status-item::before {
      animation: none;
    }
  }
`;

export default LoadingScreen;
