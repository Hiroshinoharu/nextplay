import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const NAV_ITEMS = [
  { label: 'Home', path: '/games' },
  { label: 'Discover', path: '/discover' },
  { label: 'My List', path: '/user' },
  ...(import.meta.env.DEV && import.meta.env.VITE_ENABLE_STATUS === 'true'
    ? [{ label: 'Status', path: '/health', to: '/health?status=1' }]
    : []),
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activePath = location.pathname.startsWith('/games')
    ? '/games'
    : location.pathname.startsWith('/discover')
      ? '/discover'
    : location.pathname.startsWith('/user')
      ? '/user'
      : location.pathname.startsWith('/health')
        ? '/health'
        : '/games';

  return (
    <StyledWrapper>
      <div className="nav">
        <div className="container">
          {NAV_ITEMS.map((item) => {
            const isActive = activePath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                className={`btn${isActive ? ' is-active' : ''}`}
                onClick={() => navigate(item.to ?? item.path)}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .nav {
    width: 100%;
    height: auto;
    border-radius: 999px;
    box-sizing: border-box;
    min-width: 0;
  }

  .container {
    position: relative;
    width: 100%;
    min-height: 56px;
    background:
      radial-gradient(circle at top, rgba(140, 243, 122, 0.06), transparent 58%),
      linear-gradient(145deg, rgba(8, 28, 44, 0.86), rgba(8, 22, 35, 0.74));
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    row-gap: 6px;
    flex-wrap: nowrap;
    padding: 0.4em 0.6em;
    border-radius: 999px;
    border: 1px solid var(--games-border, rgba(140, 243, 122, 0.3));
    box-shadow:
      0 16px 26px rgba(0, 0, 0, 0.28),
      inset 0 0 0 1px rgba(140, 243, 122, 0.08);
    box-sizing: border-box;
    max-width: 100%;
  }

  .btn {
    padding: 0.45em 0.8em;
    color: var(--games-text, #e2f2ff);
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease,
      box-shadow 0.22s ease,
      filter 0.22s ease,
      translate 0.22s ease,
      scale 0.14s ease;
    font-size: 0.88rem;
    border-radius: 999px;
    white-space: nowrap;
    background: transparent;
    border: none;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-weight: 700;
    letter-spacing: 0.02em;
    appearance: none;
    flex: 1 1 0;
    min-width: 74px;
  }

  .btn:hover {
    background: rgba(140, 243, 122, 0.16);
    color: var(--games-text, #e2f2ff);
    box-shadow:
      0 8px 16px rgba(0, 0, 0, 0.22),
      inset 0 0 0 1px rgba(140, 243, 122, 0.15);
  }

  .btn.is-active {
    background: linear-gradient(135deg, var(--games-accent, #8cf37a), var(--games-accent-strong, #c7f000));
    color: #0b141a;
    box-shadow: 0 6px 14px rgba(140, 243, 122, 0.38);
  }

  .btn:focus {
    outline: none;
  }

  .btn:focus-visible {
    outline: 2px solid var(--games-accent, #8cf37a);
    outline-offset: 2px;
  }

  @media (max-width: 900px) {
    .nav {
      width: 100%;
    }

    .container {
      min-height: 50px;
      padding: 0.3em 0.38em;
      border-radius: 14px;
      justify-content: flex-start;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
    }

    .container::-webkit-scrollbar {
      display: none;
    }

    .btn {
      flex: 0 0 auto;
      scroll-snap-align: start;
      padding: 0.4em 0.78em;
      font-size: 0.8rem;
      border: 1px solid transparent;
    }
  }

  @media (max-width: 640px) {
    .nav {
      width: 100%;
    }

    .container {
      min-height: 46px;
      padding: 0.28em 0.32em;
      border-radius: 14px;
      justify-content: flex-start;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }

    .container::-webkit-scrollbar {
      display: none;
    }

    .btn {
      padding: 0.34em 0.64em;
      font-size: 0.74rem;
      border: 1px solid transparent;
      flex: 0 0 auto;
    }

    .btn.is-active {
      border-color: rgba(11, 20, 26, 0.2);
    }
  }

  @media (max-width: 420px) {
    .container {
      gap: 5px;
    }

    .btn {
      padding: 0.3em 0.56em;
      font-size: 0.7rem;
    }
  }`;

export default Navbar;
