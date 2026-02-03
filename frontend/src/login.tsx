import { useNavigate, useLocation } from 'react-router-dom'
import Form from './components/Form'
import logoUrl from './assets/logo.png'


export default function Login() {
    // Initialize navigation hook
    const navigate = useNavigate()
    const location = useLocation()
    const emailFromQuery = new URLSearchParams(location.search).get("email") ?? undefined;

    // Render login page layout
    return (
        <div className="landing landing--auth">
            <div className="landing__container landing__container--auth">
            <nav className="landing__nav">
                <div className="landing__logo" onClick={() => navigate('/')}>
                    <img src={logoUrl} alt="NextPlay Logo" width={96} height={96} />
                    <span>NextPlay</span>
                </div>
            </nav>
            <main className="auth-page">
                <Form initialEmail={emailFromQuery} />
            </main>
        </div>
    </div>
)
}
