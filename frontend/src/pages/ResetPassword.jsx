import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api.post("/auth/reset-password", { token, password: pw });
      setDone(true);
      setTimeout(() => nav("/login", { replace: true }), 2500);
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Reset failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="marketing" />
      <main className="flex-1 max-w-md mx-auto w-full px-5 py-16">
        <div className="mf-eyebrow">Customs · Password reset</div>
        <h1 className="font-display font-bold text-3xl mt-2">Set a new password</h1>
        <div className="mf-card mt-8">
          {!token ? (
            <div data-testid="reset-no-token">
              <p className="text-sm text-ink/70">
                This page needs a token from the email link. Try the reset flow again.
              </p>
              <Link to="/forgot-password" className="mf-btn mt-5 inline-flex">Restart reset</Link>
            </div>
          ) : done ? (
            <div className="text-center" data-testid="reset-done">
              <div className="mf-stamp inline-block">★ Password<br/>updated</div>
              <p className="text-sm text-ink/70 mt-4">Redirecting you to log in…</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="mf-label block mb-2">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="mf-input"
                  data-testid="reset-pw-input"
                />
              </div>
              <div>
                <label className="mf-label block mb-2">Confirm new password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="mf-input"
                  data-testid="reset-pw2-input"
                />
              </div>
              {err && <div className="text-sm text-red-700 font-data" data-testid="reset-error">{err}</div>}
              <button disabled={busy} className="mf-btn w-full" data-testid="reset-submit-btn">
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
