import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-data text-xs uppercase tracking-widest text-ink/60">Verifying credentials…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/app" replace />;
  return children;
}
