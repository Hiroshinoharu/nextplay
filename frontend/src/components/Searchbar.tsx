import styled from 'styled-components';

const Input = () => {
  return (
    <StyledWrapper>
      <div className="container">
        <input defaultChecked className="checkbox" type="checkbox" /> 
        <div className="mainbox">
          <div className="iconContainer">
            <svg viewBox="0 0 512 512" height="1em" xmlns="http://www.w3.org/2000/svg" className="search_icon"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" /></svg>
          </div>
          <input className="search_input" placeholder="search" type="text" />
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .container {
    position: relative;
    box-sizing: border-box;
    width: fit-content;
    max-width: min(280px, 80vw);
  }

  .mainbox {
    box-sizing: border-box;
    position: relative;
    width: 240px;
    height: 48px;
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background-color: rgba(10, 30, 48, 0.7);
    border: 1px solid var(--games-border, rgba(140, 243, 122, 0.35));
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.25);
    transition: all 0.3s ease;
  }

  .checkbox:focus {
    border: none;
    outline: none;
  }

  .checkbox:checked {
    right: 10px;
  }

  .checkbox:checked ~ .mainbox {
    width: 48px;
  }

  .checkbox:checked ~ .mainbox .search_input {
    width: 0;
    height: 0px;
  }

  .checkbox:checked ~ .mainbox .iconContainer {
    padding-right: 6px;
  }

  .checkbox {
    box-sizing: border-box;
    width: 30px;
    height: 30px;
    position: absolute;
    right: 16px;
    top: 9px;
    z-index: 9;
    cursor: pointer;
    appearance: none;
  }

  .search_input {
    box-sizing: border-box;
    height: 100%;
    width: 170px;
    background-color: transparent;
    border: none;
    outline: none;
    padding-bottom: 4px;
    padding-left: 10px;
    font-size: 1em;
    color: var(--games-text, #e2f2ff);
    transition: all 0.3s ease;
    font-family: inherit;
  }

  .search_input::placeholder {
    color: rgba(226, 242, 255, 0.7);
  }

  .iconContainer {
    box-sizing: border-box;
    padding-top: 5px;
    width: fit-content;
    transition: all 0.3s ease;
  }

  .search_icon {
    box-sizing: border-box;
    fill: var(--games-accent, #8cf37a);
    font-size: 1.3em;
  }

  @media (max-width: 640px) {
    .container {
      width: 100%;
      max-width: 100%;
    }

    .mainbox {
      width: 100%;
    }

    .checkbox {
      right: 12px;
    }

    .checkbox:checked ~ .mainbox {
      width: 100%;
    }

    .checkbox:checked ~ .mainbox .search_input {
      width: 100%;
      height: 100%;
    }
  }`;

export default Input;
