import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

type AuthFormProps = {
  apiBaseUrl?: string;
  onAuthSuccess?: (payload: unknown, mode: 'login' | 'register') => void;
  initialEmail?: string;
  initialMode?: 'login' | 'register';
};

type AvailabilityFieldState = {
  value: string;
  exists: boolean;
};

type AvailabilityResponse = {
  username?: AvailabilityFieldState;
  email?: AvailabilityFieldState;
  error?: string;
};

const PASSWORD_POLICY_TEXT =
  'Password must be at least 8 characters and include upper-case, lower-case, number, and special character.';

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
  const [signupNameExists, setSignupNameExists] = useState(false);
  const [signupEmailExists, setSignupEmailExists] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    const trimmedEmail = initialEmail?.trim();
    if (!trimmedEmail) return;
    setLoginIdentifier((current) => current || trimmedEmail);
    setSignupEmail((current) => current || trimmedEmail);
  }, [initialEmail]);

  useEffect(() => {
    const trimmedUsername = signupName.trim();
    const trimmedEmail = signupEmail.trim();

    setSignupNameExists(false);
    setSignupEmailExists(false);
    setAvailabilityError(null);

    if (!trimmedUsername && !trimmedEmail) {
      setAvailabilityLoading(false);
      return;
    }

    if (trimmedEmail && !trimmedEmail.includes('@')) {
      setAvailabilityLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setAvailabilityLoading(true);
      try {
        const params = new URLSearchParams();
        if (trimmedUsername) params.set('username', trimmedUsername);
        if (trimmedEmail) params.set('email', trimmedEmail);

        const response = await fetch(apiUrl(`/users/availability?${params.toString()}`), {
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as AvailabilityResponse | null;
        if (!response.ok) {
          setAvailabilityError(data?.error ?? `Availability check failed: ${response.status}`);
          return;
        }

        const usernameMatches =
          trimmedUsername !== '' &&
          data?.username?.value?.trim().toLowerCase() === trimmedUsername.toLowerCase();
        const emailMatches =
          trimmedEmail !== '' &&
          data?.email?.value?.trim().toLowerCase() === trimmedEmail.toLowerCase();

        setSignupNameExists(Boolean(usernameMatches && data?.username?.exists));
        setSignupEmailExists(Boolean(emailMatches && data?.email?.exists));
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setAvailabilityError(`${err}`);
      } finally {
        if (!controller.signal.aborted) {
          setAvailabilityLoading(false);
        }
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [signupEmail, signupName]);

  const extractToken = (payload: unknown): string => {
    if (typeof payload !== 'object' || payload === null) return '';
    const data = payload as Record<string, unknown>;
    const directToken = data['token'];
    if (typeof directToken === 'string' && directToken.trim()) {
      return directToken.trim();
    }
    const accessToken = data['access_token'];
    if (typeof accessToken === 'string' && accessToken.trim()) {
      return accessToken.trim();
    }
    const jwtToken = data['jwt'];
    if (typeof jwtToken === 'string' && jwtToken.trim()) {
      return jwtToken.trim();
    }
    const nested = data['data'];
    if (typeof nested === 'object' && nested !== null) {
      const nestedToken = (nested as Record<string, unknown>)['token'];
      if (typeof nestedToken === 'string' && nestedToken.trim()) {
        return nestedToken.trim();
      }
    }
    return '';
  };

  const hasToken = (payload: unknown) => extractToken(payload) !== '';

  // handleLogin processes the login form submission, validates inputs, and communicates with the backend API to authenticate the user.
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
    } else if (loginIdentifier.trim()) {
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
      if(!hasToken(data)) {
        setError('Login failed: No token received from API.');
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
    if (signupNameExists) {
      setError('That username already exists.');
      return;
    }
    if (signupEmailExists) {
      setError('That email is already registered.');
      return;
    }
    if (availabilityError) {
      setError('Resolve the account availability check before signing up.');
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
      if (hasToken(data)) {
        setStatus('Registered and logged in successfully.');
        onAuthSuccess?.(data, 'register');
        return;
      } 


      // Backwards-compatible fallback: if register does not return a token,
      // perform a login request to make sure we still obtain one.
      const loginResponse = await fetch(apiUrl('/users/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail.trim(), password: signupPassword.trim() }),
      });
      const loginData = await loginResponse.json().catch(() => null);
      if (!loginResponse.ok) {
        setError(loginData?.error ?? 'Account created but automatic sign-in failed. Please log in.');
        return;
      }
      if (!hasToken(loginData)) {
        setError('Account created but no token was returned. Please log in manually.');
        return;
      }
      setStatus('Account created and signed in successfully.');
      onAuthSuccess?.(loginData, 'register');
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
            <input
              id="auth-mode-toggle"
              name="auth_mode_toggle"
              type="checkbox"
              className="toggle"
              defaultChecked={initialMode === 'register'}
            />
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
                      name="username"
                      placeholder="Username"
                      type="text"
                      value={signupName}
                      onChange={event => setSignupName(event.target.value)}
                    />
                    {signupName.trim() && (
                      <div className={`auth-inline-message ${signupNameExists ? 'error' : 'success'}`}>
                        {signupNameExists ? 'Username already exists.' : 'Username is available.'}
                      </div>
                    )}
                    <input
                      className="flip-card__input"
                      name="email"
                      placeholder="Email"
                      type="email"
                      value={signupEmail}
                      onChange={event => setSignupEmail(event.target.value)}
                    />
                    {signupEmail.trim() && signupEmail.includes('@') && (
                      <div className={`auth-inline-message ${signupEmailExists ? 'error' : 'success'}`}>
                        {signupEmailExists ? 'Email already exists.' : 'Email is available.'}
                      </div>
                    )}
                    <input
                      className="flip-card__input"
                      name="password"
                      placeholder="Password"
                      type="password"
                      value={signupPassword}
                      onChange={event => setSignupPassword(event.target.value)}
                    />
                    <div className="auth-policy">
                      <strong>Policy</strong>
                      <span>{PASSWORD_POLICY_TEXT}</span>
                    </div>
                    {availabilityLoading && (
                      <div className="auth-inline-message pending">Checking account availability...</div>
                    )}
                    {availabilityError && (
                      <div className="auth-inline-message error">{availabilityError}</div>
                    )}
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

  .landing[data-theme='light'] & .wrapper,
  .landing[data-theme='light'] .wrapper {
    --input-focus: #5fa93b;
    --font-color: #18354a;
    --font-color-sub: rgba(24, 53, 74, 0.86);
    --bg-color: rgba(255, 255, 255, 0.95);
    --bg-color-alt: rgba(239, 248, 255, 0.9);
    --main-color: rgba(59, 143, 62, 0.28);
    --switch-color: #5fa93b;
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
    --switch-pill-width: 64px;
    position: relative;
    width: min(240px, 100%);
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
    left: calc(50% - (var(--switch-pill-width) / 2));
    right: auto;
    width: var(--switch-pill-width);
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
    transform: translateX(calc(var(--switch-pill-width) - 32px));
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
    width: min(320px, 92vw);
    height: 470px;
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
    width: 100%;
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
    width: min(260px, 100%);
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

  .landing[data-theme='light'] & .flip-card__front,
  .landing[data-theme='light'] & .flip-card__back,
  .landing[data-theme='light'] .flip-card__front,
  .landing[data-theme='light'] .flip-card__back {
    box-shadow:
      0 16px 28px rgba(31, 67, 92, 0.12),
      0 0 24px rgba(121, 199, 230, 0.12),
      0 0 16px rgba(59, 143, 62, 0.08);
  }

  .flip-card__btn:active, .button-confirm:active {
    box-shadow: 0px 0px var(--main-color);
    transform: translate(3px, 3px);
  }

  .flip-card__btn {
    margin: 20px 0 20px 0;
    width: min(140px, 100%);
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

  .landing[data-theme='light'] & .flip-card__btn,
  .landing[data-theme='light'] .flip-card__btn {
    background-color: rgba(59, 143, 62, 0.12);
    box-shadow:
      0 10px 20px rgba(31, 67, 92, 0.12),
      0 0 18px rgba(121, 199, 230, 0.12),
      0 0 14px rgba(59, 143, 62, 0.12);
    color: #3b8f3e;
  }

  .flip-card__btn:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .auth-message {
    box-sizing: border-box;
    margin-top: 8px;
    width: 100%;
    max-width: min(260px, 100%);
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    border: 1px solid rgba(140, 243, 122, 0.5);
    background: linear-gradient(160deg, rgba(10, 30, 48, 0.9), rgba(8, 20, 34, 0.85));
    color: #e2f2ff;
    box-shadow:
      0 10px 18px rgba(0, 0, 0, 0.26),
      inset 0 0 0 1px rgba(140, 243, 122, 0.08);
    z-index: 1;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .landing[data-theme='light'] & .auth-message,
  .landing[data-theme='light'] .auth-message {
    border-color: rgba(59, 143, 62, 0.24);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.94), rgba(239, 248, 255, 0.9));
    color: #18354a;
    box-shadow:
      0 10px 18px rgba(31, 67, 92, 0.1),
      inset 0 0 0 1px rgba(59, 143, 62, 0.05);
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
    .card-stack {
      height: 500px;
    }

    .switch {
      width: min(320px, 94vw);
      gap: 12px;
    }

    .switch-row {
      --switch-pill-width: 58px;
      width: min(220px, 100%);
    }

    .card-side::before,
    .card-side::after {
      width: 72px;
      font-size: 13px;
    }

    .flip-card__front, .flip-card__back {
      padding: 14px;
    }

    .title {
      font-size: 22px;
      margin: 10px 0;
    }

    .flip-card__input {
      height: 36px;
      font-size: 14px;
      width: 100%;
    }

    .flip-card__btn {
      width: 100%;
      height: 36px;
      font-size: 15px;
      margin: 8px 0 10px;
    }

    .auth-message {
      max-width: 100%;
      padding: 10px;
      font-size: 12px;
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
    border-color: rgba(255, 125, 125, 0.75);
    color: #ffd7d7;
    background: linear-gradient(160deg, rgba(52, 16, 18, 0.9), rgba(36, 13, 16, 0.85));
    box-shadow:
      0 10px 18px rgba(0, 0, 0, 0.3),
      inset 0 0 0 1px rgba(255, 125, 125, 0.15);
  }

  .auth-message.success {
    border-color: rgba(140, 243, 122, 0.75);
    color: #d4f932;
    background: linear-gradient(160deg, rgba(12, 36, 28, 0.9), rgba(10, 28, 22, 0.85));
    box-shadow:
      0 10px 18px rgba(0, 0, 0, 0.3),
      inset 0 0 0 1px rgba(140, 243, 122, 0.16);
  }

  .auth-inline-message,
  .auth-policy {
    width: 100%;
    max-width: min(260px, 100%);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .landing[data-theme='light'] & .auth-inline-message,
  .landing[data-theme='light'] .auth-inline-message {
    border-color: rgba(59, 143, 62, 0.2);
    background: rgba(255, 255, 255, 0.92);
    color: #23455d;
  }

  .auth-inline-message {
    border: 1px solid rgba(140, 243, 122, 0.3);
    background: rgba(7, 21, 33, 0.72);
    color: #d7e8f6;
  }

  .auth-inline-message.success {
    border-color: rgba(140, 243, 122, 0.55);
    color: #d4f932;
  }

  .auth-inline-message.error {
    border-color: rgba(255, 125, 125, 0.58);
    color: #ffd7d7;
  }

  .auth-inline-message.pending {
    border-color: rgba(14, 165, 233, 0.42);
    color: #bfeaff;
  }

  .auth-policy {
    display: grid;
    gap: 4px;
    border: 1px solid rgba(140, 243, 122, 0.24);
    background: linear-gradient(160deg, rgba(8, 24, 38, 0.82), rgba(7, 18, 28, 0.78));
    color: #d7e8f6;
  }

  .landing[data-theme='light'] & .auth-policy,
  .landing[data-theme='light'] .auth-policy {
    border-color: rgba(59, 143, 62, 0.18);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.94), rgba(239, 248, 255, 0.9));
    color: #23455d;
  }

  .auth-policy strong {
    color: #c7f000;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .auth-policy span {
    color: rgba(226, 242, 255, 0.78);
  }

  .landing[data-theme='light'] & .auth-policy strong,
  .landing[data-theme='light'] .auth-policy strong {
    color: #3b8f3e;
  }

  .landing[data-theme='light'] & .auth-policy span,
  .landing[data-theme='light'] .auth-policy span {
    color: rgba(24, 53, 74, 0.88);
  }

  @media (max-width: 480px) {
    .auth-inline-message,
    .auth-policy {
      max-width: 100%;
      font-size: 11px;
      padding: 8px 9px;
    }
  }`;

export default Form;
