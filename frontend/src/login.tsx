import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Form from './components/Form'
import BrandLogo from './components/BrandLogo'
import SiteFooter from './components/SiteFooter'
import { type AuthUser } from './utils/authUser'
import { type ThemeMode } from './utils/theme'

type LoginProps = {
  apiBaseUrl: string
  authUser: AuthUser | null
  onAuthSuccess: (payload: unknown) => void
  theme: ThemeMode
}

export default function Login({ apiBaseUrl, authUser, onAuthSuccess, theme }: LoginProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const emailFromQuery = new URLSearchParams(location.search).get('email') ?? undefined
  const modeFromQuery = new URLSearchParams(location.search).get('mode') ?? undefined
  const initialMode = modeFromQuery === 'signup' || modeFromQuery === 'register' ? 'register' : 'login'

  useEffect(() => {
    if (!authUser) return
    const timeoutId = window.setTimeout(() => {
      navigate('/games', { replace: true })
    }, 1000)
    return () => window.clearTimeout(timeoutId)
  }, [authUser, navigate])

  return (
    <div className="landing landing--auth" data-theme={theme}>
      <div className="landing__container landing__container--auth">
        <nav className="landing__nav landing__nav--auth">
          <BrandLogo onClick={() => navigate('/')} />
        </nav>
        <main className="auth-page">
          <section className="auth-page__layout">
            <article className="auth-page__panel">
              <p className="auth-page__eyebrow">NEXTPLAY ACCESS</p>
              <h1 className="auth-page__title">Jump back into your library</h1>
              <p className="auth-page__copy">
                Log in or create an account to track what you play, surface better recommendations,
                and build lists for your next session.
              </p>
              {authUser && (
                <div className="auth-status">
                  Signed in as {authUser.username ?? authUser.email ?? 'User'}
                </div>
              )}
            </article>
            <div className="auth-page__form-shell">
              <Form
                apiBaseUrl={apiBaseUrl}
                onAuthSuccess={onAuthSuccess}
                initialEmail={emailFromQuery}
                initialMode={initialMode}
              />
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
