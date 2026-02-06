import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Discover', path: '/games' },
  { label: 'My List', path: '/user' },
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activePath = location.pathname.startsWith('/games')
    ? '/games'
    : location.pathname.startsWith('/user')
      ? '/user'
      : '/';

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
                onClick={() => navigate(item.path)}
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
    width: min(520px, 100%);
    height: auto;
    border-radius: 999px;
    box-sizing: border-box;
    flex: 1 1 320px;
  }

  .container {
    position: relative;
    width: 100%;
    min-height: 56px;
    background: rgba(10, 30, 48, 0.7);
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 8px;
    row-gap: 6px;
    flex-wrap: wrap;
    padding: 0.4em 0.6em;
    border-radius: 999px;
    border: 1px solid var(--games-border, rgba(140, 243, 122, 0.3));
    box-shadow: 0 16px 28px rgba(0, 0, 0, 0.25);
    box-sizing: border-box;
  }

  .btn {
    padding: 0.45em 1.2em;
    color: var(--games-text, #e2f2ff);
    cursor: pointer;
    transition: 0.2s ease;
    font-size: 0.9rem;
    border-radius: 999px;
    white-space: nowrap;
    background: transparent;
    border: none;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-weight: 600;
    letter-spacing: 0.02em;
    appearance: none;
    flex: 0 0 auto;
  }

  .btn:hover {
    background: rgba(140, 243, 122, 0.18);
    color: var(--games-text, #e2f2ff);
  }

  .btn.is-active {
    background: linear-gradient(135deg, var(--games-accent, #8cf37a), var(--games-accent-strong, #c7f000));
    color: #0b141a;
    box-shadow: 0 8px 18px rgba(140, 243, 122, 0.35);
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
  }

  @media (max-width: 640px) {
    .nav {
      width: 100%;
    }

    .btn {
      padding: 0.4em 0.9em;
      font-size: 0.8rem;
      flex: 1 1 120px;
    }

    .container {
      min-height: 52px;
      border-radius: 18px;
    }
  }

  @media (max-width: 420px) {
    .btn {
      padding: 0.35em 0.75em;
      font-size: 0.75rem;
    }
  }`;

export default Navbar;
