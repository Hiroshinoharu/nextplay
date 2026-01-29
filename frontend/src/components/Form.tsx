import React, { useState } from 'react';
import styled from 'styled-components';

type AuthFormProps = {
  apiBaseUrl?: string;
  onAuthSuccess?: (payload: unknown, mode: 'login' | 'register') => void;
};

const Form = ({ apiBaseUrl, onAuthSuccess }: AuthFormProps) => {
  const rawBaseUrl = (apiBaseUrl ?? import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');
  const apiRoot = rawBaseUrl.endsWith('/api') ? rawBaseUrl.slice(0, -4) : rawBaseUrl;
  const apiUrl = (path: string) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${apiRoot}/api${normalizedPath}`;
  };
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setError('Enter your email/username and password.');
      return;
    }
    const payload: Record<string, string> = { password: loginPassword.trim() };
    if (loginIdentifier.includes('@')) {
      payload.email = loginIdentifier.trim();
    } else {
      payload.username = loginIdentifier.trim();
    }

    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/users/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? `Login failed: ${response.status}`);
        return;
      }
      setStatus('Logged in successfully.');
      onAuthSuccess?.(data, 'login');
    } catch (err) {
      setError(`${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setError(null);
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setError('Name, email, and password are required.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/users/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupName.trim(),
          email: signupEmail.trim(),
          password: signupPassword.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? `Registration failed: ${response.status}`);
        return;
      }
      setStatus('Account created. You can log in now.');
      onAuthSuccess?.(data, 'register');
    } catch (err) {
      setError(`${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Styled Wrapper for the Form Component
    <StyledWrapper>
      {/* Form Wrapper */}
      <div className="wrapper">
        <div className="card-switch">
          <label className="switch">
            <input type="checkbox" className="toggle" />
            <span className="slider" />
            <span className="card-side" />
            <div className="flip-card__inner">
              <div className="flip-card__front">
                <div className="title">Log in</div>
                <form className="flip-card__form" onSubmit={handleLogin}>
                  <input
                    className="flip-card__input"
                    name="identifier"
                    placeholder="Email or username"
                    type="text"
                    value={loginIdentifier}
                    onChange={event => setLoginIdentifier(event.target.value)}
                  />
                  <input
                    className="flip-card__input"
                    name="password"
                    placeholder="Password"
                    type="password"
                    value={loginPassword}
                    onChange={event => setLoginPassword(event.target.value)}
                  />
                  <button className="flip-card__btn" type="submit" disabled={isLoading}>
                    {isLoading ? 'Working...' : 'Let`s go!'}
                  </button>
                </form>
              </div>
              <div className="flip-card__back">
                <div className="title">Sign up</div>
                <form className="flip-card__form" onSubmit={handleRegister}>
                  <input
                    className="flip-card__input"
                    placeholder="Name"
                    type="text"
                    value={signupName}
                    onChange={event => setSignupName(event.target.value)}
                  />
                  <input
                    className="flip-card__input"
                    name="email"
                    placeholder="Email"
                    type="email"
                    value={signupEmail}
                    onChange={event => setSignupEmail(event.target.value)}
                  />
                  <input
                    className="flip-card__input"
                    name="password"
                    placeholder="Password"
                    type="password"
                    value={signupPassword}
                    onChange={event => setSignupPassword(event.target.value)}
                  />
                  <button className="flip-card__btn" type="submit" disabled={isLoading}>
                    {isLoading ? 'Working...' : 'Confirm!'}
                  </button>
                </form>
              </div>
            </div>
            {(error || status) && (
              <div className={`auth-message ${error ? 'error' : 'success'}`}>
                {error ?? status}
              </div>
            )}
          </label>
        </div>   
      </div>
    </StyledWrapper>
  );
}

// Styled Wrapper for the Form Component
const StyledWrapper = styled.div`
  .wrapper {
    --input-focus: #2d8cf0;
    --font-color: #323232;
    --font-color-sub: #666;
    --bg-color: #fff;
    --bg-color-alt: #666;
    --main-color: #323232;
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* switch card */
  .switch {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 30px;
    width: 50px;
    height: 20px;
  }

  .card-side::before {
    position: absolute;
    content: 'Log in';
    left: -70px;
    top: 0;
    width: 100px;
    text-decoration: underline;
    color: var(--font-color);
    font-weight: 600;
  }

  .card-side::after {
    position: absolute;
    content: 'Sign up';
    left: 70px;
    top: 0;
    width: 100px;
    text-decoration: none;
    color: var(--font-color);
    font-weight: 600;
  }

  .toggle {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    box-sizing: border-box;
    border-radius: 5px;
    border: 2px solid var(--main-color);
    box-shadow: 4px 4px var(--main-color);
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-colorcolor);
    transition: 0.3s;
  }

  .slider:before {
    box-sizing: border-box;
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    border: 2px solid var(--main-color);
    border-radius: 5px;
    left: -2px;
    bottom: 2px;
    background-color: var(--bg-color);
    box-shadow: 0 3px 0 var(--main-color);
    transition: 0.3s;
  }

  .toggle:checked + .slider {
    background-color: var(--input-focus);
  }

  .toggle:checked + .slider:before {
    transform: translateX(30px);
  }

  .toggle:checked ~ .card-side:before {
    text-decoration: none;
  }

  .toggle:checked ~ .card-side:after {
    text-decoration: underline;
  }

  /* card */ 

  .flip-card__inner {
    width: 300px;
    height: 350px;
    position: relative;
    background-color: transparent;
    perspective: 1000px;
      /* width: 100%;
      height: 100%; */
    text-align: center;
    transition: transform 0.8s;
    transform-style: preserve-3d;
  }

  .toggle:checked ~ .flip-card__inner {
    transform: rotateY(180deg);
  }

  .toggle:checked ~ .flip-card__front {
    box-shadow: none;
  }

  .flip-card__front, .flip-card__back {
    padding: 20px;
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: center;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    background: lightgrey;
    gap: 20px;
    border-radius: 5px;
    border: 2px solid var(--main-color);
    box-shadow: 4px 4px var(--main-color);
  }

  .flip-card__back {
    width: 100%;
    transform: rotateY(180deg);
  }

  .flip-card__form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .title {
    margin: 20px 0 20px 0;
    font-size: 25px;
    font-weight: 900;
    text-align: center;
    color: var(--main-color);
  }

  .flip-card__input {
    width: 250px;
    height: 40px;
    border-radius: 5px;
    border: 2px solid var(--main-color);
    background-color: var(--bg-color);
    box-shadow: 4px 4px var(--main-color);
    font-size: 15px;
    font-weight: 600;
    color: var(--font-color);
    padding: 5px 10px;
    outline: none;
  }

  .flip-card__input::placeholder {
    color: var(--font-color-sub);
    opacity: 0.8;
  }

  .flip-card__input:focus {
    border: 2px solid var(--input-focus);
  }

  .flip-card__btn:active, .button-confirm:active {
    box-shadow: 0px 0px var(--main-color);
    transform: translate(3px, 3px);
  }

  .flip-card__btn {
    margin: 20px 0 20px 0;
    width: 120px;
    height: 40px;
    border-radius: 5px;
    border: 2px solid var(--main-color);
    background-color: var(--bg-color);
    box-shadow: 4px 4px var(--main-color);
    font-size: 17px;
    font-weight: 600;
    color: var(--font-color);
    cursor: pointer;
  }

  .flip-card__btn:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .auth-message {
    margin-top: 12px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    border: 2px solid var(--main-color);
    background: var(--bg-color);
    color: var(--font-color);
    box-shadow: 2px 2px var(--main-color);
  }

  .auth-message.error {
    border-color: #b91c1c;
    color: #b91c1c;
  }

  .auth-message.success {
    border-color: #15803d;
    color: #15803d;
  }`;

export default Form;
