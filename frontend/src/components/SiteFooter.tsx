import BrandLogo from "./BrandLogo";

const SiteFooter = () => {
  return (
    <footer className="landing__footer" aria-label="Site footer">
      <div className="landing__footer-simple">
        <div className="landing__footer-brand">
          <div className="landing__footer-brand-lockup">
            <BrandLogo width={52} height={52} />
            <div>
              <p className="landing__footer-eyebrow">NextPlay</p>
              <h3 className="landing__footer-title">Sharper game discovery, less noise.</h3>
            </div>
          </div>
          <p className="landing__footer-copy">
            Personalized recommendations, better shortlist control, and a feed shaped around what you actually want to play.
          </p>
        </div>
        <div className="landing__footer-meta">
          <div className="landing__footer-badges" aria-label="Product highlights">
            <span>Personalized picks</span>
            <span>Questionnaire tuning</span>
            <span>Saved favorites</span>
          </div>
          <p className="landing__footer-note">
            Build a taste profile, refresh your feed, and keep the shortlist focused on what is worth your next session.
          </p>
        </div>
      </div>
      <div className="landing__footer-bottom">
        <span>© 2026 NextPlay</span>
        <span>Discover, shortlist, play.</span>
      </div>
    </footer>
  );
};

export default SiteFooter;
