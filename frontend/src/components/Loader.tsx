import styled from 'styled-components';

const Loader = () => {
  return (
    <StyledWrapper>
      <div className="loader-wrapper">
        <div className="packman" />
        <div className="dots">
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .loader-wrapper {
    position: relative;
    width: 104px;
    height: 48px;
    margin: 10px auto;
    border-radius: 999px;
    background: linear-gradient(140deg, rgba(8, 26, 40, 0.9), rgba(7, 18, 30, 0.9));
    border: 1px solid rgba(140, 243, 122, 0.28);
    box-shadow:
      0 14px 24px rgba(0, 0, 0, 0.32),
      inset 0 0 0 1px rgba(140, 243, 122, 0.08);
  }

  .loader-wrapper .packman::before {
    content: '';
    position: absolute;
    width: 50px;
    height: 25px;
    background-color: #c7f000;
    border-radius: 100px 100px 0 0;
    transform: translate(-50%, -50%);
    animation: pac-top 0.5s linear infinite;
    transform-origin: center bottom;
  }

  .loader-wrapper .packman::after {
    content: '';
    position: absolute;
    width: 50px;
    height: 25px;
    background-color: #c7f000;
    border-radius: 0 0 100px 100px;
    transform: translate(-50%, 50%);
    animation: pac-bot 0.5s linear infinite;
    transform-origin: center top;
  }

  .loader-wrapper .packman {
    position: absolute;
    left: 38px;
    top: 24px;
  }

  @keyframes pac-top {
    0% {
      transform: translate(-50%, -50%) rotate(0)
    }

    50% {
      transform: translate(-50%, -50%) rotate(-30deg)
    }

    100% {
      transform: translate(-50%, -50%) rotate(0)
    }
  }

  @keyframes pac-bot {
    0% {
      transform: translate(-50%, 50%) rotate(0)
    }

    50% {
      transform: translate(-50%, 50%) rotate(30deg)
    }

    100% {
      transform: translate(-50%, 50%) rotate(0)
    }
  }

  .dots .dot {
    position: absolute;
    z-index: -1;
    top: 19px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(226, 242, 255, 0.95);
  }

  .dots .dot:nth-child(1) {
    left: 90px;
    animation: dot-stage1 0.5s infinite;
  }

  .dots .dot:nth-child(2) {
    left: 60px;
    animation: dot-stage1 0.5s infinite;
  }

  .dots .dot:nth-child(3) {
    left: 30px;
    animation: dot-stage1 0.5s infinite;
  }

  .dots .dot:nth-child(4) {
    left: 10px;
    animation: dot-stage2 0.5s infinite;
  }

  @keyframes dot-stage1 {
    0% {
      transform: translate(0, 0);
    }

    100% {
      transform: translate(-24px, 0);
    }
  }

  @keyframes dot-stage2 {
    0% {
      transform: scale(1);
    }

    5%, 100% {
      transform: scale(0);
    }
  }`;

export default Loader;
