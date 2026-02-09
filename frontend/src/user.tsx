import { Navigate, useNavigate } from "react-router-dom";
import BrandLogo from "./components/BrandLogo";

type AuthUser = {
  id?: number;
  username?: string;
  email?: string;
  steam_linked?: boolean;
};

type UserPageProps = {
  authUser: AuthUser | null;
  onSignOut: () => void;
};

const UserPage = ({ authUser, onSignOut }: UserPageProps) => {
  const navigate = useNavigate();

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    onSignOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="landing landing--auth">
      <div className="landing__container landing__container--auth">
        <nav className="landing__nav">
          <BrandLogo onClick={() => navigate("/")} />
          <div className="landing__nav-actions">
            <button type="button" onClick={() => navigate("/games")}>
              Back to games
            </button>
            <button type="button" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </nav>
        <main className="user-page">
          <div className="auth-status">
            Signed in as {authUser.username ?? authUser.email ?? "User"}
          </div>
          <section className="user-card">
            <h1 className="user-title">My List</h1>
            <p className="user-subtitle">
              Placeholder user page to test the logout flow.
            </p>
            <p className="user-hint">
              Click “Log Out” to return to the root page.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
};

export default UserPage;
