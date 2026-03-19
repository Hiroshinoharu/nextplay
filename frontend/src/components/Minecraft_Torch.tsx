import { useId } from 'react';
import styled from 'styled-components';

type MinecraftTorchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  onLabel?: string;
  offLabel?: string;
};

const MinecraftTorch = ({
  checked,
  onChange,
  disabled = false,
  id,
  label = 'Toggle theme',
  onLabel = 'Light mode',
  offLabel = 'Dark mode',
}: MinecraftTorchProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <StyledWrapper $checked={checked} $disabled={disabled}>
      <label className="container" htmlFor={inputId}>
        <div className="simple-text" aria-live="polite">
          {checked ? onLabel : offLabel}
        </div>
        <input
          id={inputId}
          name={inputId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          aria-label={label}
        />
        <div className="torch" aria-hidden="true">
          <div className="head">
            <div className="face top">
              <div />
              <div />
              <div />
              <div />
            </div>
            <div className="face left">
              <div />
              <div />
              <div />
              <div />
            </div>
            <div className="face right">
              <div />
              <div />
              <div />
              <div />
            </div>
          </div>
          <div className="stick">
            <div className="side side-left">
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
            </div>
            <div className="side side-right">
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
            </div>
          </div>
        </div>
      </label>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div<{ $checked: boolean; $disabled: boolean }>`
  --torch-head-size: clamp(26px, 3.4vw, 32px);
  --torch-stick-width: calc(var(--torch-head-size) * 0.88);
  --torch-stick-height: clamp(118px, 15vw, 150px);
  --torch-lift: ${({ $checked }) => ($checked ? '-4px' : '0px')};

  .container input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    position: relative;
    width: min(100%, 172px);
    min-height: 100%;
    padding: 6px 0 44px;
    cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
    user-select: none;
    opacity: ${({ $disabled }) => ($disabled ? 0.55 : 1)};
    transition: opacity 180ms ease, transform 180ms ease;
    touch-action: manipulation;
  }

  .container:hover {
    transform: ${({ $disabled }) => ($disabled ? 'none' : 'translateY(-2px)')};
  }

  .simple-text {
    position: absolute;
    left: 50%;
    bottom: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 118px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid ${({ $checked }) => ($checked ? 'rgba(255, 216, 0, 0.22)' : 'rgba(140, 243, 122, 0.22)')};
    background: ${({ $checked }) => ($checked ? 'rgba(58, 45, 8, 0.48)' : 'rgba(8, 22, 34, 0.76)')};
    transform: translateX(-50%);
    text-align: center;
    white-space: nowrap;
    color: ${({ $checked }) => ($checked ? '#fff3b4' : 'rgba(226, 242, 255, 0.92)')};
    text-shadow: ${({ $checked }) =>
      $checked ? '0 0 10px rgba(255, 216, 0, 0.24)' : '0 0 10px rgba(14, 165, 233, 0.1)'};
    box-shadow: 0 12px 20px rgba(0, 0, 0, 0.16);
    font-size: 13px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: 0.02em;
    line-height: 1;
  }

  .torch {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: min(100%, 128px);
    height: calc(var(--torch-stick-height) + var(--torch-head-size) + 10px);
    filter: ${({ $checked }) => ($checked ? 'saturate(1)' : 'saturate(0.88) brightness(0.96)')};
    transform: translateY(var(--torch-lift));
    transition: filter 220ms ease, transform 220ms ease;
  }

  .torch::before {
    content: '';
    position: absolute;
    inset: 8px 8px 12px;
    border-radius: 22px;
    background:
      radial-gradient(
        circle at 50% 18%,
        ${({ $checked }) => ($checked ? 'rgba(255, 222, 112, 0.38)' : 'rgba(17, 96, 128, 0.2)')} 0,
        ${({ $checked }) => ($checked ? 'rgba(255, 173, 48, 0.16)' : 'rgba(17, 96, 128, 0.08)')} 26%,
        transparent 72%
      );
    filter: blur(12px);
    pointer-events: none;
  }

  .torch::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 10px;
    width: 58px;
    height: 14px;
    background: radial-gradient(circle, rgba(0, 0, 0, 0.42) 0, rgba(0, 0, 0, 0) 74%);
    transform: translateX(-50%);
    pointer-events: none;
  }

  .head,
  .stick {
    position: absolute;
    left: 50%;
    transform-style: preserve-3d;
    transform: translateX(-50%) rotateX(-28deg) rotateY(45deg);
  }

  .head {
    top: 12px;
    width: var(--torch-head-size);
    height: var(--torch-head-size);
  }

  .stick {
    top: calc(var(--torch-head-size) + 1px);
    width: var(--torch-stick-width);
    height: var(--torch-stick-height);
  }

  .face {
    position: absolute;
    transform-style: preserve-3d;
    width: var(--torch-head-size);
    height: var(--torch-head-size);
    display: grid;
    grid-template-columns: 50% 50%;
    grid-template-rows: 50% 50%;
    background-color: #000000;
    transition: filter 220ms ease, background-color 220ms ease;
  }

  .top {
    transform: rotateX(90deg) translateZ(calc(var(--torch-head-size) / 2));
  }

  .left {
    transform: rotateY(-90deg) translateZ(calc(var(--torch-head-size) / 2));
  }

  .right {
    transform: rotateY(0deg) translateZ(calc(var(--torch-head-size) / 2));
  }

  .top div,
  .left div,
  .right div {
    width: 102%;
    height: 102%;
    transition: background-color 220ms ease;
  }

  .top div:nth-child(1),
  .left div:nth-child(3),
  .right div:nth-child(3) {
    background-color: #ffff9760;
  }

  .top div:nth-child(2),
  .left div:nth-child(1),
  .right div:nth-child(1) {
    background-color: #ffd80060;
  }

  .top div:nth-child(3),
  .left div:nth-child(4),
  .right div:nth-child(4) {
    background-color: #ffffff60;
  }

  .top div:nth-child(4),
  .left div:nth-child(2),
  .right div:nth-child(2) {
    background-color: #ff8f0060;
  }

  .side {
    position: absolute;
    width: var(--torch-stick-width);
    height: var(--torch-stick-height);
    display: grid;
    grid-template-columns: 50% 50%;
    grid-template-rows: repeat(8, 12.5%);
    translate: 0 4px;
  }

  .side-left {
    transform: rotateY(-90deg) translateZ(calc(var(--torch-stick-width) / 2)) translateY(4px);
  }

  .side-right {
    transform: rotateY(0deg) translateZ(calc(var(--torch-stick-width) / 2)) translateY(4px);
  }

  .side-left div,
  .side-right div {
    width: 103%;
    height: 103%;
    transition: background-color 220ms ease;
  }

  .side div:nth-child(1) {
    background-color: #443622;
  }

  .side div:nth-child(2),
  .side div:nth-child(2) {
    background-color: #2e2517;
  }

  .side div:nth-child(3),
  .side div:nth-child(5) {
    background-color: #4b3b23;
  }

  .side div:nth-child(4),
  .side div:nth-child(10) {
    background-color: #251e12;
  }

  .side div:nth-child(6) {
    background-color: #292115;
  }

  .side div:nth-child(7) {
    background-color: #4b3c26;
  }

  .side div:nth-child(8) {
    background-color: #292115;
  }

  .side div:nth-child(9) {
    background-color: #4b3a21;
  }

  .side div:nth-child(11),
  .side div:nth-child(15) {
    background-color: #3d311d;
  }

  .side div:nth-child(12) {
    background-color: #2c2315;
  }

  .side div:nth-child(13) {
    background-color: #493a22;
  }

  .side div:nth-child(14) {
    background-color: #2b2114;
  }

  .side div:nth-child(16) {
    background-color: #271e10;
  }

  .container input:focus-visible ~ .torch {
    outline: 2px solid rgba(140, 243, 122, 0.6);
    outline-offset: 8px;
    border-radius: 18px;
  }

  .container input:checked ~ .torch .face {
    filter: drop-shadow(0px 0px 2px rgb(255, 255, 255))
      drop-shadow(0px 0px 10px rgba(255, 237, 156, 0.7))
      drop-shadow(0px 0px 25px rgba(255, 227, 101, 0.4));
  }

  .container input:checked ~ .torch .top div:nth-child(1),
  .container input:checked ~ .torch .left div:nth-child(3),
  .container input:checked ~ .torch .right div:nth-child(3) {
    background-color: #ffff97;
  }

  .container input:checked ~ .torch .top div:nth-child(2),
  .container input:checked ~ .torch .left div:nth-child(1),
  .container input:checked ~ .torch .right div:nth-child(1) {
    background-color: #ffd800;
  }

  .container input:checked ~ .torch .top div:nth-child(3),
  .container input:checked ~ .torch .left div:nth-child(4),
  .container input:checked ~ .torch .right div:nth-child(4) {
    background-color: #ffffff;
  }

  .container input:checked ~ .torch .top div:nth-child(4),
  .container input:checked ~ .torch .left div:nth-child(2),
  .container input:checked ~ .torch .right div:nth-child(2) {
    background-color: #ff8f00;
  }

  .container input:checked ~ .torch .side div:nth-child(1) {
    background-color: #7c623e;
  }

  .container input:checked ~ .torch .side div:nth-child(2),
  .container input:checked ~ .torch .side div:nth-child(2) {
    background-color: #4c3d26;
  }

  .container input:checked ~ .torch .side div:nth-child(3),
  .container input:checked ~ .torch .side div:nth-child(5) {
    background-color: #937344;
  }

  .container input:checked ~ .torch .side div:nth-child(4),
  .container input:checked ~ .torch .side div:nth-child(10) {
    background-color: #3c2f1c;
  }

  .container input:checked ~ .torch .side div:nth-child(6) {
    background-color: #423522;
  }

  .container input:checked ~ .torch .side div:nth-child(7) {
    background-color: #9f7f50;
  }

  .container input:checked ~ .torch .side div:nth-child(8) {
    background-color: #403320;
  }

  .container input:checked ~ .torch .side div:nth-child(9) {
    background-color: #977748;
  }

  .container input:checked ~ .torch .side div:nth-child(11),
  .container input:checked ~ .torch .side div:nth-child(15) {
    background-color: #675231;
  }

  .container input:checked ~ .torch .side div:nth-child(12) {
    background-color: #3d301d;
  }

  .container input:checked ~ .torch .side div:nth-child(13) {
    background-color: #987849;
  }

  .container input:checked ~ .torch .side div:nth-child(14) {
    background-color: #3b2e1b;
  }

  .container input:checked ~ .torch .side div:nth-child(16) {
    background-color: #372a17;
  }

  @media (max-width: 640px) {
    .container {
      width: min(100%, 152px);
      padding-bottom: 38px;
    }

    .torch {
      width: min(100%, 116px);
    }
  }
`;

export default MinecraftTorch;
