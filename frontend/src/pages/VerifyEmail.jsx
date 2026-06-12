import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { refresh, user } = useAuth();
  const [state, setState] = useState("verifying"); // verifying | ok | error
  const [msg, setMsg] = useState("");
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const token = params.get("token");
    if (!token) {
      setState("error");
      setMsg("Missing verification token.");
      return;
    }
    api
      .post("/auth/verify-email", { token })
      .then(() => {
        setState("ok");
        return refresh();
      })
      .catch((e) => {
        setState("error");
        setMsg(e?.response?.data?.detail || "Could not verify this link.");
      });
  }, [params, refresh]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="marketing" />
      <main className="flex-1 max-w-md mx-auto w-full px-5 py-16">
        <div className="mf-eyebrow">Customs · Verification</div>
        <div className="mf-card mt-6 text-center" data-testid="verify-card">
          {state === "verifying" && (
            <>
              <div className="font-display text-2xl font-bold">Stamping…</div>
              <div className="font-data text-xs text-ink/60 mt-2">Verifying your email link.</div>
            </>
          )}
          {state === "ok" && (
            <>
              <div className="mf-stamp inline-block mt-2" data-testid="verify-stamp-ok">★ Email<br />verified</div>
              <div className="font-display text-2xl font-bold mt-4">Email verified.</div>
              <p className="text-sm text-ink/70 mt-2">
                Thanks — the reminder banner is gone for good.
              </p>
              <Link to={user ? "/app" : "/login"} className="mf-btn mt-5 inline-flex" data-testid="verify-continue">
                {user ? "Continue to the tool" : "Log in"}
              </Link>
            </>
          )}
          {state === "error" && (
            <>
              <div className="font-display text-2xl font-bold text-red-700">Couldn't verify</div>
              <p className="text-sm text-ink/70 mt-2" data-testid="verify-error">{msg}</p>
              <Link to={user ? "/account" : "/login"} className="mf-btn mt-5 inline-flex">
                {user ? "Back to account" : "Back to login"}
              </Link>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
