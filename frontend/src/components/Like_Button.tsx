import styled from 'styled-components';

const Button = () => {
  return (
    <StyledWrapper>
      <button>
        <svg className="empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={32} height={32}>
          <path fill="none" d="M0 0H24V24H0z" />
          <path d="M16.5 3C19.538 3 22 5.5 22 9c0 7-7.5 11-10 12.5C9.5 20 2 16 2 9c0-3.5 2.5-6 5.5-6C9.36 3 11 4 12 5c1-1 2.64-2 4.5-2zm-3.566 15.604c.881-.556 1.676-1.109 2.42-1.701C18.335 14.533 20 11.943 20 9c0-2.36-1.537-4-3.5-4-1.076 0-2.24.57-3.086 1.414L12 7.828l-1.414-1.414C9.74 5.57 8.576 5 7.5 5 5.56 5 4 6.656 4 9c0 2.944 1.666 5.533 4.645 7.903.745.592 1.54 1.145 2.421 1.7.299.189.595.37.934.572.339-.202.635-.383.934-.571z" />
        </svg>
        <svg className="filled" height={32} width={32} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0H24V24H0z" fill="none" />
          <path d="M16.5 3C19.538 3 22 5.5 22 9c0 7-7.5 11-10 12.5C9.5 20 2 16 2 9c0-3.5 2.5-6 5.5-6C9.36 3 11 4 12 5c1-1 2.64-2 4.5-2z" />
        </svg>
        Like
      </button>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  button {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    box-shadow:
      0 10px 22px rgba(3, 11, 18, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    background: linear-gradient(155deg, rgba(8, 28, 44, 0.94), rgba(7, 19, 30, 0.9));
    border: 1px solid rgba(140, 243, 122, 0.36);
    border-radius: 999px;
    font-size: 15px;
    cursor: pointer;
    font-weight: 700;
    color: #e2f2ff;
    font-family: inherit;
    transition:
      transform 280ms ease,
      border-color 280ms ease,
      background-color 280ms ease,
      box-shadow 280ms ease;
  }

  @keyframes movingBorders {
    0% {
      border-color: rgba(140, 243, 122, 0.42);
    }

    50% {
      border-color: rgba(199, 240, 0, 0.62);
    }

    90% {
      border-color: rgba(140, 243, 122, 0.42);
    }
  }

  button:hover {
    background: linear-gradient(155deg, rgba(10, 34, 52, 0.94), rgba(9, 24, 38, 0.9));
    transform: translateY(-1px);
    animation: movingBorders 3s infinite;
    box-shadow:
      0 12px 24px rgba(3, 11, 18, 0.36),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }

  button svg {
    fill: rgb(255, 110, 110);
    transition: opacity 100ms ease-in-out;
  }

  .filled {
    position: absolute;
    opacity: 0;
    top: 9px;
    left: 14px;
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

  button:hover .empty {
    opacity: 0;
  }

  button:hover .filled {
    opacity: 1;
    animation: beatingHeart 1.2s infinite;
  }`;

export default Button;
