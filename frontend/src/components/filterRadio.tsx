import styled from "styled-components";

type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

type FilterRadioProps = {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
};

const FilterRadio = ({
  value,
  options,
  onChange,
  ariaLabel = "Filter options",
}: FilterRadioProps) => {
  return (
    <StyledWrapper>
      <div className="filter-radio" role="tablist" aria-label={ariaLabel}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`filter-radio__item ${active ? "is-active" : ""}`}
              onClick={() => onChange(option.value)}
            >
              <span>{option.label}</span>
              {typeof option.count === "number" ? (
                <span className="filter-radio__count">{option.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .filter-radio {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-radio__item {
    border: 1px solid var(--games-border, rgba(140, 243, 122, 0.3));
    border-radius: 999px;
    background: var(--games-surface, rgba(10, 30, 48, 0.62));
    color: var(--games-text, rgba(226, 242, 255, 0.92));
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 7px 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  }

  .filter-radio__item:hover {
    border-color: var(--games-border-active, rgba(199, 240, 0, 0.62));
    transform: translateY(-1px);
  }

  .filter-radio__item.is-active {
    border-color: var(--games-border-active, rgba(199, 240, 0, 0.72));
    background: var(--games-accent-surface, rgba(140, 243, 122, 0.2));
    color: var(--games-button-text, var(--games-text, rgba(24, 53, 74, 0.96)));
    box-shadow: inset 0 0 0 1px var(--games-accent-outline, rgba(199, 240, 0, 0.22));
  }

  .filter-radio__count {
    border-radius: 999px;
    border: 1px solid var(--games-border, rgba(140, 243, 122, 0.35));
    background: var(--games-chip-bg, transparent);
    padding: 1px 6px;
    font-size: 10px;
    color: var(--games-text, rgba(226, 242, 255, 0.92));
  }
`;

export default FilterRadio;
