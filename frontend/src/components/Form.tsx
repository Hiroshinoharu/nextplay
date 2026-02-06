import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

type AuthFormProps = {
  apiBaseUrl?: string;
  onAuthSuccess?: (payload: unknown, mode: 'login' | 'register') => void;
  initialEmail?: string;
  initialMode?: 'login' | 'register';
};

const Form = ({ apiBaseUrl, onAuthSuccess, initialEmail, initialMode = 'login' }: AuthFormProps) => {
  const rawBaseUrl = (apiBaseUrl ?? import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');
  const apiRoot = rawBaseUrl.endsWith('/api') ? rawBaseUrl.slice(0, -4) : rawBaseUrl;
  const apiUrl = (path: string) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${apiRoot}/api${normalizedPath}`;
  };

  // State variables for form inputs and status messages
  const [loginIdentifier, setLoginIdentifier] = useState(initialEmail ?? '');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState(initialEmail ?? '');
  const [signupPassword, setSignupPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmedEmail = initialEmail?.trim();
    if (!trimmedEmail) return;
    setLoginIdentifier((current) => (current ? current : trimmedEmail));
    setSignupEmail((current) => (current ? current : trimmedEmail));
  }, [initialEmail]);

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
            <input type="checkbox" className="toggle" defaultChecked={initialMode === 'register'} />
            <div className="switch-row">
              <span className="card-side" />
              <span className="slider" />
            </div>
            <div className="card-stack">
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
                    {(error || status) && (
                      <div className={`auth-message ${error ? 'error' : 'success'}`}>
                        {error ?? status}
                      </div>
                    )}
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
                    {(error || status) && (
                      <div className={`auth-message ${error ? 'error' : 'success'}`}>
                        {error ?? status}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </label>
        </div>   
      </div>
    </StyledWrapper>
  );
}

// Styled Wrapper for the Form Component
const StyledWrapper = styled.div`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  .wrapper {
    --input-focus: #8cf37a;
    --font-color: #e2f2ff;
    --font-color-sub: rgba(226, 242, 255, 0.7);
    --bg-color: rgba(10, 30, 48, 0.85);
    --bg-color-alt: rgba(10, 30, 48, 0.65);
    --main-color: rgba(140, 243, 122, 0.6);
    --switch-color: #8cf37a;
    min-height: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }
  .card-switch {
    width: 100%;
    display: flex;
    justify-content: center;
    padding-bottom: 0;
  }
  /* switch card */
  .switch {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 16px;
    width: min(320px, 90vw);
    height: auto;
    padding-top: 0;
    margin: 0 auto;
  }

  .switch-row {
    position: relative;
    width: 240px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }

  .card-side::before {
    position: absolute;
    content: 'Log in';
    left: 0;
    top: 0;
    width: 80px;
    text-decoration: underline;
    color: var(--switch-color);
    font-weight: 600;
    text-align: right;
    opacity: 0.85;
  }

  .card-side::after {
    position: absolute;
    content: 'Sign up';
    right: 0;
    top: 0;
    width: 80px;
    text-decoration: none;
    color: var(--switch-color);
    font-weight: 600;
    text-align: left;
    opacity: 0.85;
  }

  .card-side {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .toggle {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    box-sizing: border-box;
    border-radius: 5px;
    border: 2px solid var(--switch-color);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 88px;
    right: 88px;
    height: 28px;
    background-color: var(--bg-color-alt);
    transition: 0.3s;
    z-index: 1;
  }

  .slider:before {
    box-sizing: border-box;
    position: absolute;
    content: "";
    height: 24px;
    width: 24px;
    border: 2px solid var(--switch-color);
    border-radius: 5px;
    left: -2px;
    bottom: 1px;
    background-color: var(--bg-color);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
    transition: 0.3s;
  }

  .toggle:checked + .switch-row .slider {
    background-color: rgba(140, 243, 122, 0.3);
  }

  .toggle:checked + .switch-row .slider:before {
    transform: translateX(32px);
  }

  .toggle:checked + .switch-row .card-side:before {
    text-decoration: none;
  }

  .toggle:checked + .switch-row .card-side:after {
    text-decoration: underline;
  }

  /* card */ 

  .flip-card__inner {
    width: 100%;
    height: 100%;
    position: absolute;
    background-color: transparent;
    perspective: 1000px;
    margin-top: 0;
      /* width: 100%;
      height: 100%; */
    text-align: center;
    transition: transform 0.8s;
    transform-style: preserve-3d;
    top: 0;
    left: 0;
    box-sizing: border-box;
  }

  .toggle:checked ~ .card-stack .flip-card__inner {
    transform: rotateY(180deg);
  }

  .flip-card__front, .flip-card__back {
    padding: 18px;
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: center;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    background: var(--bg-color);
    gap: 16px;
    border-radius: 5px;
    border: 1px solid var(--main-color);
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.35),
      0 0 26px rgba(14, 229, 203, 0.22),
      0 0 18px rgba(140, 243, 122, 0.2);
    width: 100%;
    box-sizing: border-box;
  }

  .card-stack {
    width: min(300px, 90vw);
    height: 350px;
    position: relative;
    padding-bottom: 6px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  .flip-card__back {
    width: 100%;
    transform: rotateY(180deg);
  }

  .flip-card__form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    pointer-events: auto;
  }

  .flip-card__input,
  .flip-card__btn {
    pointer-events: auto;
  }

  .title {
    margin: 20px 0 20px 0;
    font-size: 25px;
    font-weight: 900;
    text-align: center;
    color: var(--font-color);
  }

  .flip-card__input {
    width: min(240px, 78vw);
    height: 40px;
    border-radius: 5px;
    border: 1px solid var(--main-color);
    background-color: var(--bg-color-alt);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
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
    border: 1px solid var(--input-focus);
    box-shadow:
      0 0 0 1px rgba(14, 229, 203, 0.45),
      0 0 22px rgba(14, 229, 203, 0.3),
      0 0 14px rgba(140, 243, 122, 0.2);
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
    border: 1px solid var(--switch-color);
    background-color: rgba(140, 243, 122, 0.18);
    box-shadow:
      0 10px 20px rgba(0, 0, 0, 0.35),
      0 0 22px rgba(14, 229, 203, 0.3),
      0 0 16px rgba(140, 243, 122, 0.25);
    font-size: 17px;
    font-weight: 600;
    color: #c7f000;
    cursor: pointer;
  }

  .flip-card__btn:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .auth-message {
    margin-top: 6px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    border: 1px solid rgba(14, 229, 203, 0.55);
    background: rgba(10, 30, 48, 0.85);
    color: #e2f2ff;
    box-shadow:
      0 8px 18px rgba(0, 0, 0, 0.28),
      0 0 16px rgba(14, 229, 203, 0.22);
    z-index: 1;
    max-width: 100%;
  }

  .flip-card__front .auth-message {
    display: block;
  }

  .flip-card__back .auth-message {
    display: none;
  }

  .toggle:checked ~ .card-stack .flip-card__front .auth-message {
    display: none;
  }

  .toggle:checked ~ .card-stack .flip-card__back .auth-message {
    display: block;
  }

  @media (max-width: 480px) {
    .flip-card__inner {
      margin-top: 32px;
    }

    .flip-card__front, .flip-card__back {
      padding: 16px;
    }

    .title {
      font-size: 22px;
      margin: 12px 0;
    }

    .flip-card__input {
      height: 36px;
      font-size: 14px;
    }

    .flip-card__btn {
      width: 110px;
      height: 36px;
      font-size: 15px;
      margin: 12px 0;
    }
  }

  @media (max-width: 768px) {
    .flip-card__inner {
      width: 100%;
    }

    .flip-card__front, .flip-card__back {
      padding: 17px;
    }

    .flip-card__input {
      width: min(260px, 78vw);
    }
  }

  .auth-message.error {
    border-color: rgba(255, 125, 125, 0.85);
    color: #ffd0d0;
    box-shadow:
      0 8px 18px rgba(0, 0, 0, 0.3),
      0 0 18px rgba(255, 125, 125, 0.28);
  }

  .auth-message.success {
    border-color: rgba(140, 243, 122, 0.85);
    color: #c7f000;
    box-shadow:
      0 8px 18px rgba(0, 0, 0, 0.3),
      0 0 18px rgba(140, 243, 122, 0.3);
  }`;

export default Form;
