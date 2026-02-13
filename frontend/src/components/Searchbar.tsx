import { useId } from 'react';
import styled from 'styled-components';

type SearchbarProps = {
  // Props can be added here if needed in the future, such as onChange handlers or value for controlled input
  value?: string;
  onValueChange?: (newValue: string) => void;
  onSubmit?: () => void;
};

// A reusable search input component with an icon and styled container.
const Input = ({ value, onValueChange, onSubmit }: SearchbarProps) => {
  const inputId = useId();
  return (
    <StyledWrapper>
      <form
        className="search"
        role ="search"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        <div className="iconContainer" aria-hidden="true">
          <svg
            viewBox="0 0 512 512"
            height="1em"
            xmlns="http://www.w3.org/2000/svg"
            className="search_icon"
          >
            <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
          </svg>
        </div>
        <input
          id={inputId}
          name="search_query"
          className="search_input"
          placeholder="Search games"
          type="text"
          aria-label="Search games"
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit?.();
            }
          }}
        />
      </form>
    </StyledWrapper>
  );
}

// Styled component for the search input, defining styles for the search container, input field, and search icon, with responsive adjustments for smaller screens.
const StyledWrapper = styled.div`
  .search {
    position: relative;
    box-sizing: border-box;
    width: min(320px, 100%);
    max-width: 100%;
    height: 48px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border-radius: 14px;
    background: linear-gradient(145deg, rgba(8, 28, 44, 0.86), rgba(9, 23, 36, 0.74));
    border: 1px solid var(--games-border, rgba(140, 243, 122, 0.35));
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.28);
  }

  .search_input {
    box-sizing: border-box;
    height: 100%;
    width: 100%;
    background-color: transparent;
    border: none;
    outline: none;
    padding-bottom: 2px;
    font-size: 0.95em;
    color: var(--games-text, #e2f2ff);
    font-family: inherit;
    flex: 1 1 auto;
    min-width: 0;
    order: 1;
  }

  .search_input::placeholder {
    color: rgba(226, 242, 255, 0.62);
  }

  .iconContainer {
    box-sizing: border-box;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(140, 243, 122, 0.35);
    display: grid;
    place-items: center;
    background: rgba(10, 30, 48, 0.6);
    flex: 0 0 auto;
    order: 2;
  }

  .search_icon {
    box-sizing: border-box;
    fill: var(--games-accent, #8cf37a);
    font-size: 0.9em;
  }

  @media (max-width: 900px) {
    .search {
      width: 100%;
    }
  }

  @media (max-width: 640px) {
    .search {
      height: 42px;
      padding: 0 10px 0 12px;
      gap: 8px;
      border-radius: 12px;
    }

    .search_input {
      font-size: 0.9em;
    }

    .iconContainer {
      width: 24px;
      height: 24px;
    }
  }
`;

export default Input;
