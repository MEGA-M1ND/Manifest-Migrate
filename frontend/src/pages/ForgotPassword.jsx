import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      // Backend always returns ok=true; this catch is just for network errors
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="marketing" />
      <main className="flex-1 max-w-md mx-auto w-full px-5 py-16">
        <div className="mf-eyebrow">Customs · Recovery</div>
        <h1 className="font-display font-bold text-3xl mt-2">Forgot your password?</h1>
        <p className="text-sm text-ink/70 mt-2">
          Enter the email on your account and we'll send a reset link valid for one hour.
        </p>
        <div className="mf-card mt-8">
          {!sent ? (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="mf-label block mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mf-input"
                  data-testid="forgot-email-input"
                />
              </div>
              <button disabled={busy} className="mf-btn w-full" data-testid="forgot-submit-btn">
                {busy ? "Sending…" : "Send reset link"}
              </button>
              <Link to="/login" className="block text-center text-sm text-accent underline mt-2" data-testid="forgot-back-login">
                Back to login
              </Link>
            </form>
          ) : (
            <div className="text-center" data-testid="forgot-sent">
              <div className="mf-stamp inline-block">★ Dispatched</div>
              <div className="font-display text-xl font-bold mt-4">Check your email.</div>
              <p className="text-sm text-ink/70 mt-2">
                If an account exists for <span className="font-data">{email}</span>, you'll receive a reset link within a minute. The link is valid for 1 hour.
              </p>
              <Link to="/login" className="mf-btn mf-btn-secondary mt-5 inline-flex">Back to login</Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
