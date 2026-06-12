import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await signup(email, pw, name);
      nav("/app", { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Could not create account");
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
        <div className="mf-eyebrow">New shipment · Open file</div>
        <h1 className="font-display font-bold text-3xl mt-2">Create your account</h1>
        <p className="text-sm text-ink/70 mt-2">Free tier · 20 conversations from 1 project. No card needed.</p>
        <div className="mf-card mt-8">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="mf-label block mb-2">Name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mf-input" data-testid="signup-name-input" />
            </div>
            <div>
              <label className="mf-label block mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mf-input"
                data-testid="signup-email-input"
              />
            </div>
            <div>
              <label className="mf-label block mb-2">Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="mf-input"
                data-testid="signup-password-input"
              />
            </div>
            {err && <div className="text-sm text-red-700 font-data" data-testid="signup-error">{err}</div>}
            <button disabled={busy} className="mf-btn w-full" data-testid="signup-submit-btn">
              {busy ? "Stamping document…" : "Create account · Start free"}
            </button>
          </form>
          <div className="flex items-center gap-3 my-5">
            <hr className="mf-divider flex-1" />
            <span className="font-data text-[11px] uppercase tracking-widest text-ink/50">or</span>
            <hr className="mf-divider flex-1" />
          </div>
          <button onClick={googleLogin} className="mf-btn mf-btn-secondary w-full" data-testid="signup-google-btn">
            Continue with Google
          </button>
          <p className="text-sm text-ink/70 mt-5 text-center">
            Already have an account?{" "}
            <Link to="/login" data-testid="signup-to-login" className="text-accent font-semibold underline">
              Log in
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
