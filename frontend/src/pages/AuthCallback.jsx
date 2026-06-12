import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const nav = useNavigate();
  const { completeGoogle } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    const sid = m ? decodeURIComponent(m[1]) : null;
    if (!sid) {
      nav("/login", { replace: true });
      return;
    }
    completeGoogle(sid)
      .then(() => {
        window.history.replaceState({}, "", "/app");
        nav("/app", { replace: true });
      })
      .catch(() => nav("/login?google_failed=1", { replace: true }));
  }, [completeGoogle, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mf-card max-w-sm w-full text-center">
        <div className="mf-eyebrow">Processing</div>
        <div className="font-display text-xl font-bold mt-2">Stamping your customs document…</div>
        <div className="font-data text-xs text-ink/60 mt-3">Verifying Google session.</div>
      </div>
    </div>
  );
}
