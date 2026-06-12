import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-24 border-t-4 border-ink bg-paper">
      <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row gap-6 md:items-end md:justify-between">
        <div>
          <div className="mf-eyebrow">Manifest · MIGRATION MANIFEST No. 001</div>
          <div className="font-display text-2xl font-bold mt-2">ChatGPT → Claude, in one trip.</div>
          <p className="text-sm text-ink/70 mt-2 max-w-md">
            Your conversations never leave your browser — provably.
            Open DevTools and watch: zero uploads.
          </p>
        </div>
        <div className="font-data text-xs uppercase tracking-widest flex flex-col gap-2">
          <Link to="/privacy" data-testid="footer-privacy-link" className="hover:text-accent transition-colors">Privacy</Link>
          <Link to="/terms" data-testid="footer-terms-link" className="hover:text-accent transition-colors">Terms</Link>
          <a href="mailto:hello@manifest.app" className="hover:text-accent transition-colors">hello@manifest.app</a>
        </div>
      </div>
      <div className="border-t border-line text-center font-data text-[11px] uppercase tracking-widest text-ink/50 py-4">
        © 2026 Manifest · Built for the one-way trip
      </div>
    </footer>
  );
}
