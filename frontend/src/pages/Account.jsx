import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import UpgradeModal from "@/components/UpgradeModal";

export default function Account() {
  const { user, deleteAccount, refresh } = useAuth();
  const nav = useNavigate();
  const [history, setHistory] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    refresh();
    api.get("/payments/history").then(({ data }) => setHistory(data.items || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  const onDelete = async () => {
    await deleteAccount();
    nav("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="app" />
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 py-10">
        <div className="mf-eyebrow">Crew · Account</div>
        <h1 className="font-display font-bold text-3xl mt-2 tracking-tight">Account</h1>

        <section className="mf-card mt-6">
          <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">Profile · 01</div>
          <h2 className="font-display text-lg font-bold mt-3">Profile</h2>
          <div className="grid sm:grid-cols-2 gap-5 mt-4 text-sm">
            <div>
              <div className="mf-label">Email</div>
              <div className="font-data mt-1" data-testid="account-email">{user.email}</div>
            </div>
            <div>
              <div className="mf-label">Name</div>
              <div className="font-data mt-1">{user.name || "—"}</div>
            </div>
            <div>
              <div className="mf-label">Member since</div>
              <div className="font-data mt-1">{user.created_at?.slice(0, 10)}</div>
            </div>
            <div>
              <div className="mf-label">Auth method</div>
              <div className="font-data mt-1 capitalize">{user.auth_provider}</div>
            </div>
          </div>
        </section>

        <section className="mf-card mt-6">
          <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">Tariff · 02</div>
          <h2 className="font-display text-lg font-bold mt-3">Plan</h2>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {user.plan === "full" ? (
              <span className="mf-pill mf-pill-full" data-testid="account-plan-full">★ Full version · Lifetime</span>
            ) : (
              <span className="mf-pill mf-pill-free" data-testid="account-plan-free">Free tier</span>
            )}
            {user.plan === "full" && user.plan_purchased_at && (
              <span className="font-data text-xs text-ink/60">
                Purchased {user.plan_purchased_at.slice(0, 10)}
              </span>
            )}
          </div>
          {user.plan !== "full" && (
            <button onClick={() => setUpgradeOpen(true)} className="mf-btn mt-5" data-testid="account-upgrade-btn">
              Buy full version · $9 one-time
            </button>
          )}
        </section>

        <section className="mf-card mt-6">
          <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">Logbook · 03</div>
          <h2 className="font-display text-lg font-bold mt-3">Usage</h2>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <div className="mf-label">Migrations run</div>
              <div className="font-display font-bold text-3xl mt-1" data-testid="account-migrations-count">
                {user.usage_migrations_run || 0}
              </div>
            </div>
            <div>
              <div className="mf-label">Convos packed</div>
              <div className="font-display font-bold text-3xl mt-1" data-testid="account-convos-count">
                {user.usage_conversations_packed || 0}
              </div>
            </div>
            <div>
              <div className="mf-label">Last used</div>
              <div className="font-data text-sm mt-2">{user.last_used_at ? user.last_used_at.slice(0, 10) : "—"}</div>
            </div>
          </div>
          <p className="font-data text-xs text-ink/50 mt-4">
            Counters only. Conversation content is never sent here.
          </p>
        </section>

        {history.length > 0 && (
          <section className="mf-card mt-6">
            <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">Receipts · 04</div>
            <h2 className="font-display text-lg font-bold mt-3">Payment history</h2>
            <table className="w-full text-sm mt-3 font-data">
              <thead className="text-left text-ink/60 text-xs uppercase tracking-widest">
                <tr>
                  <th className="py-2">Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Session</th>
                </tr>
              </thead>
              <tbody>
                {history.map((t) => (
                  <tr key={t.session_id} className="border-t border-line">
                    <td className="py-2">{t.created_at?.slice(0, 10)}</td>
                    <td>${Number(t.amount).toFixed(2)} {t.currency?.toUpperCase()}</td>
                    <td>{t.payment_status}</td>
                    <td className="truncate max-w-[180px]">{t.session_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mf-card mt-6">
          <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">Danger · 05</div>
          <h2 className="font-display text-lg font-bold mt-3 text-red-700">Delete account</h2>
          <p className="text-sm text-ink/70 mt-2 leading-relaxed">
            Removes all account data from Manifest. Your ChatGPT export and conversation content are not stored here, so there's nothing else to erase.
          </p>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="mf-btn mf-btn-secondary mt-4 !border-red-700 !text-red-700 hover:!bg-red-700 hover:!text-white" data-testid="account-delete-btn">
              Delete account
            </button>
          ) : (
            <div className="flex gap-3 mt-4 flex-wrap">
              <button onClick={onDelete} className="mf-btn !bg-red-700 !border-red-700 hover:!bg-red-800 hover:!border-red-800" data-testid="account-delete-confirm">
                Confirm · This cannot be undone
              </button>
              <button onClick={() => setConfirming(false)} className="mf-btn mf-btn-secondary" data-testid="account-delete-cancel">
                Cancel
              </button>
            </div>
          )}
        </section>
      </main>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      <Footer />
    </div>
  );
}
