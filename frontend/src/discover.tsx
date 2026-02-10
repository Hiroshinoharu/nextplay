import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import SiteFooter from "./components/SiteFooter";
import logoUrl from "./assets/logo.png";
import "./search.css";

function SearchPage() {
  const navigate = useNavigate();

  return (
    <div className="search-page">
      <div className="search-shell">
        <header className="search-header">
          <button
            type="button"
            className="search-brand"
            onClick={() => navigate("/")}
          >
            <img src={logoUrl} alt="NextPlay Logo" />
            <span className="search-brand__text">
              <span className="search-brand__title">NextPlay</span>
              <span className="search-brand__subtitle">Discover</span>
            </span>
          </button>
          <nav className="search-nav" aria-label="Primary">
            <Navbar />
          </nav>
          <div />
        </header>

        <main className="search-content">
          <section className="search-summary">
            <p className="search-summary__label">Discover</p>
            <p className="search-summary__count">Coming soon.</p>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

export default SearchPage;
