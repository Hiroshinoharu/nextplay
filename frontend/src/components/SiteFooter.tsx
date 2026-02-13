import BrandLogo from "./BrandLogo";

// A component for rendering the site footer with multiple sections and a subscription form.
const SiteFooter = () => {
  return (
    <footer className="landing__footer">
      <div className="landing__footer-grid">
        <div className="landing__footer-brand">
          <BrandLogo width={56} height={56} />
          <p>
            Find your next obsession with curated picks, social play, and smart
            recommendations.
          </p>
        </div>
        <div className="landing__footer-section">
          <h4>Product</h4>
          <ul>
            <li>Discover</li>
            <li>Collections</li>
            <li>Party Finder</li>
            <li>Wishlist</li>
          </ul>
        </div>
        <div className="landing__footer-section">
          <h4>Company</h4>
          <ul>
            <li>About</li>
            <li>Careers</li>
            <li>Press</li>
            <li>Contact</li>
          </ul>
        </div>
        <div className="landing__footer-section">
          <h4>Resources</h4>
          <ul>
            <li>Help Center</li>
            <li>Community</li>
            <li>Developers</li>
            <li>Status</li>
          </ul>
        </div>
        <div className="landing__footer-section">
          <h4>Stay in the loop</h4>
          <p>Weekly drops, co-op nights, and hot releases.</p>
          <div className="landing__footer-form">
            <input
              id="footer-email"
              name="email"
              type="email"
              placeholder="you@email.com"
              aria-label="Email address"
            />
            <button type="button">Subscribe</button>
          </div>
        </div>
      </div>
      <div className="landing__footer-bottom">
        <span>© 2026 NextPlay. All rights reserved.</span>
        <div className="landing__footer-links">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Cookies</span>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
