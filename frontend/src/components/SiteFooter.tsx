import BrandLogo from "./BrandLogo";

const SiteFooter = () => {
  return (
    <footer className="landing__footer" aria-label="Site footer">
      <div className="landing__footer-grid">
        <div className="landing__footer-brand">
          <BrandLogo width={56} height={56} />
          <p className="landing__footer-eyebrow">Play better together</p>
          <p>
            Find your next obsession with curated picks, social play, and smart
            recommendations.
          </p>
        </div>
        <div className="landing__footer-section">
          <h4>Product</h4>
          <ul>
            <li><a href="#">Discover</a></li>
            <li><a href="#">Collections</a></li>
            <li><a href="#">Party Finder</a></li>
            <li><a href="#">Wishlist</a></li>
          </ul>
        </div>
        <div className="landing__footer-section">
          <h4>Company</h4>
          <ul>
            <li><a href="#">About</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Press</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </div>
        <div className="landing__footer-section">
          <h4>Resources</h4>
          <ul>
            <li><a href="#">Help Center</a></li>
            <li><a href="#">Community</a></li>
            <li><a href="#">Developers</a></li>
            <li><a href="#">Status</a></li>
          </ul>
        </div>
        <div className="landing__footer-section landing__footer-section--subscribe">
          <h4>Stay in the loop</h4>
          <p>Weekly drops, co-op nights, and hot releases.</p>
          <form className="landing__footer-form" onSubmit={event => event.preventDefault()}>
            <label htmlFor="footer-email" className="landing__sr-only">Email address</label>
            <input
              id="footer-email"
              name="email"
              type="email"
              placeholder="you@email.com"
              aria-label="Email address"
            />
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </div>
      <div className="landing__footer-bottom">
        <span>© 2026 NextPlay. All rights reserved.</span>
        <div className="landing__footer-links" aria-label="Legal links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Cookies</a>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
