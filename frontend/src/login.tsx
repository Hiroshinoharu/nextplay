import { useNavigate, useLocation } from 'react-router-dom'
import Form from './components/Form'
import BrandLogo from './components/BrandLogo'


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
                <BrandLogo onClick={() => navigate('/')} />
            </nav>
            <main className="auth-page">
                <Form initialEmail={emailFromQuery} />
            </main>
        </div>
    </div>
)
}
