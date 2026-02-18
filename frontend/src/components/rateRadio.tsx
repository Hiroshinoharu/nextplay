import styled from "styled-components";

type RateRadioProps = {
  value: number | null;
  onChange: (value: number) => void;
  onClear?: () => void;
  disabled?: boolean;
};

const STAR_ICON_PATH =
  "M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z";

const RateRadio = ({
  value,
  onChange,
  onClear,
  disabled = false,
}: RateRadioProps) => {
  return (
    <StyledWrapper>
      <fieldset className="rate-radio" disabled={disabled}>
        <legend className="sr-only">Rate this game</legend>
        <div className="rate-radio__stars" role="radiogroup" aria-label="Rate this game">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`rate-radio__star ${value !== null && value >= star ? "is-active" : ""}`}
              onClick={() => onChange(star)}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              aria-pressed={value === star}
              disabled={disabled}
            >
              <svg viewBox="0 0 576 512" aria-hidden="true">
                <path d={STAR_ICON_PATH} />
              </svg>
            </button>
          ))}
          {onClear ? (
            <button
              type="button"
              className="rate-radio__clear"
              onClick={onClear}
              disabled={disabled || value === null}
            >
              Clear
            </button>
          ) : null}
        </div>
      </fieldset>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .rate-radio {
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
  }

  .rate-radio__stars {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .rate-radio__star {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid rgba(140, 243, 122, 0.34);
    background: rgba(10, 30, 48, 0.62);
    color: rgba(226, 242, 255, 0.42);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }

  .rate-radio__star svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  .rate-radio__star:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(199, 240, 0, 0.64);
    color: rgba(199, 240, 0, 0.88);
  }

  .rate-radio__star.is-active {
    border-color: rgba(199, 240, 0, 0.72);
    color: rgba(220, 255, 116, 0.96);
    background: rgba(140, 243, 122, 0.18);
    box-shadow: inset 0 0 0 1px rgba(199, 240, 0, 0.24);
  }

  .rate-radio__clear {
    border: 1px solid rgba(140, 243, 122, 0.3);
    border-radius: 999px;
    background: rgba(10, 30, 48, 0.62);
    color: rgba(226, 242, 255, 0.82);
    padding: 6px 11px;
    font-size: 11px;
    cursor: pointer;
  }

  .rate-radio__clear:disabled,
  .rate-radio__star:disabled {
    opacity: 0.58;
    cursor: wait;
  }
`;

export default RateRadio;
