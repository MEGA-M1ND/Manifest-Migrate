import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await login(email, pw);
      const to = loc.state?.from || "/app";
      nav(to, { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="marketing" />
      <main className="flex-1 max-w-md mx-auto w-full px-5 py-16">
        <div className="mf-eyebrow">Customs check-in</div>
        <h1 className="font-display font-bold text-3xl mt-2">Log in to Manifest</h1>
        <div className="mf-card mt-8">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mf-label block mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mf-input"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="mf-label block mb-2">Password</label>
              <input
                type="password"
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="mf-input"
                data-testid="login-password-input"
              />
            </div>
            {err && <div className="text-sm text-red-700 font-data" data-testid="login-error">{err}</div>}
            <button disabled={busy} className="mf-btn w-full" data-testid="login-submit-btn">
              {busy ? "Verifying…" : "Log in"}
            </button>
            <Link to="/forgot-password" className="block text-center text-sm text-accent underline mt-2" data-testid="login-forgot-link">
              Forgot your password?
            </Link>
          </form>
          <div className="flex items-center gap-3 my-5">
            <hr className="mf-divider flex-1" />
            <span className="font-data text-[11px] uppercase tracking-widest text-ink/50">or</span>
            <hr className="mf-divider flex-1" />
          </div>
          <button onClick={googleLogin} className="mf-btn mf-btn-secondary w-full" data-testid="login-google-btn">
            Continue with Google
          </button>
          <p className="text-sm text-ink/70 mt-5 text-center">
            New here?{" "}
            <Link to="/signup" data-testid="login-to-signup" className="text-accent font-semibold underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
