import styled from "styled-components";

type LikeButtonProps = {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
  icon?: "heart" | "star";
};

const HEART_OUTLINE =
  "M16.5 3C19.538 3 22 5.5 22 9c0 7-7.5 11-10 12.5C9.5 20 2 16 2 9c0-3.5 2.5-6 5.5-6C9.36 3 11 4 12 5c1-1 2.64-2 4.5-2zm-3.566 15.604c.881-.556 1.676-1.109 2.42-1.701C18.335 14.533 20 11.943 20 9c0-2.36-1.537-4-3.5-4-1.076 0-2.24.57-3.086 1.414L12 7.828l-1.414-1.414C9.74 5.57 8.576 5 7.5 5 5.56 5 4 6.656 4 9c0 2.944 1.666 5.533 4.645 7.903.745.592 1.54 1.145 2.421 1.7.299.189.595.37.934.572.339-.202.635-.383.934-.571z";
const HEART_FILLED =
  "M16.5 3C19.538 3 22 5.5 22 9c0 7-7.5 11-10 12.5C9.5 20 2 16 2 9c0-3.5 2.5-6 5.5-6C9.36 3 11 4 12 5c1-1 2.64-2 4.5-2z";
const STAR_OUTLINE =
  "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

const LikeButton = ({
  active = false,
  disabled = false,
  onClick,
  label = "Like",
  icon = "heart",
}: LikeButtonProps) => {
  const iconPath = icon === "star" ? STAR_OUTLINE : active ? HEART_FILLED : HEART_OUTLINE;
  return (
    <StyledWrapper>
      <button
        type="button"
        className={active ? "is-active" : ""}
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
          <path d={iconPath} />
        </svg>
        {label}
      </button>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  button {
    --np-chip-border: var(--games-border, rgba(140, 243, 122, 0.34));
    --np-chip-bg: var(--games-surface, rgba(10, 30, 48, 0.62));
    --np-chip-text: var(--games-text, rgba(226, 242, 255, 0.9));
    --np-chip-icon: var(--games-muted, rgba(226, 242, 255, 0.72));
    --np-chip-active-border: var(--games-border-active, rgba(199, 240, 0, 0.74));
    --np-chip-active-bg: var(--games-accent-surface, rgba(140, 243, 122, 0.2));
    --np-chip-active-text: var(--games-accent-strong, rgba(220, 255, 116, 0.96));
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid var(--np-chip-border);
    background: var(--np-chip-bg);
    color: var(--np-chip-text);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  }

  button svg {
    fill: var(--np-chip-icon);
    transition: fill 0.2s ease;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: var(--np-chip-active-border);
  }

  button.is-active {
    border-color: var(--np-chip-active-border);
    background: var(--np-chip-active-bg);
    box-shadow: inset 0 0 0 1px var(--games-accent-outline, rgba(199, 240, 0, 0.22));
  }

  button.is-active svg {
    fill: var(--np-chip-active-text);
  }

  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
`;

export default LikeButton;
