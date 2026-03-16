import BrandLogo from "./BrandLogo";

const SiteFooter = () => {
  return (
    <footer className="landing__footer" aria-label="Site footer">
      <div className="landing__footer-simple">
        <div className="landing__footer-brand">
          <BrandLogo width={56} height={56} />
          <p className="landing__footer-eyebrow">NextPlay</p>
          <p>Personalized game discovery with sharper recommendations, cleaner signals, and a feed that feels curated instead of random.</p>
        </div>
        <div className="landing__footer-meta">
          <div className="landing__footer-badges" aria-label="Product highlights">
            <span>Personalized picks</span>
            <span>Questionnaire tuning</span>
            <span>Saved favorites</span>
          </div>
          <p className="landing__footer-note">Build a taste profile, refresh your feed, and keep the shortlist focused on what you actually want to play next.</p>
        </div>
      </div>
      <div className="landing__footer-bottom">
        <span>© 2026 NextPlay - C22380206 Max Ceban</span>
        <span>Discover, shortlist, play.</span>
      </div>
    </footer>
  );
};

export default SiteFooter;
