import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Header({ variant = "marketing" }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const onLogout = () => {
    logout();
    nav("/");
  };

  const planPill =
    user?.plan === "full" ? (
      <span className="mf-pill mf-pill-full" data-testid="plan-pill-full">★ Full version</span>
    ) : (
      <span className="mf-pill mf-pill-free" data-testid="plan-pill-free">Free tier</span>
    );

  return (
    <header className="border-b border-ink bg-paper">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
        <Link to="/" data-testid="header-logo" className="flex items-center gap-2 group">
          <div className="font-data text-[10px] tracking-[0.22em] uppercase text-accent font-semibold">M·001</div>
          <div className="font-display font-bold text-xl tracking-tight">Manifest</div>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 font-data text-xs uppercase tracking-widest">
          {variant === "marketing" && (
            <>
              <a href="/#how" className="hidden sm:inline hover:text-accent transition-colors">How it works</a>
              <a href="/#pricing" className="hidden sm:inline hover:text-accent transition-colors">Pricing</a>
              <a href="/#faq" className="hidden sm:inline hover:text-accent transition-colors">FAQ</a>
            </>
          )}
          {!user && (
            <>
              <Link to="/login" data-testid="header-login-link" className="hover:text-accent transition-colors">Log in</Link>
              <Link to="/signup" data-testid="header-signup-cta" className="mf-btn !py-2 !px-3 !text-[11px]">
                Try free
              </Link>
            </>
          )}
          {user && (
            <>
              {planPill}
              {user.plan !== "full" && loc.pathname !== "/app" && (
                <Link to="/app" data-testid="header-go-app" className="hover:text-accent transition-colors">Open tool</Link>
              )}
              <Link to="/account" data-testid="header-account-link" className="hover:text-accent transition-colors">Account</Link>
              <button onClick={onLogout} data-testid="header-logout-btn" className="hover:text-accent transition-colors">
                Log out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
