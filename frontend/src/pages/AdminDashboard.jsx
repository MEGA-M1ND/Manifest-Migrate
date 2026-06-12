import { useEffect, useState, useMemo } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";

function KPI({ label, value, sub, "data-testid": testId }) {
  return (
    <div className="mf-card-soft border border-line p-5" data-testid={testId}>
      <div className="mf-label">{label}</div>
      <div className="font-display font-bold text-3xl mt-1">{value}</div>
      {sub && <div className="font-data text-xs text-ink/60 mt-1">{sub}</div>}
    </div>
  );
}

function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.signups));
  return (
    <div className="flex items-end gap-[3px] h-32 mt-3 border-b border-line">
      {data.map((d) => {
        const h = (d.signups / max) * 100;
        return (
          <div
            key={d.day}
            className="flex-1 relative group"
            title={`${d.day}: ${d.signups} signup${d.signups === 1 ? "" : "s"} · ${d.paid} paid`}
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-ink hover:bg-accent transition-colors"
              style={{ height: `${h}%`, minHeight: d.signups ? "2px" : "0" }}
            />
            {d.paid > 0 && (
              <div
                className="absolute bottom-0 left-0 right-0 bg-stamp"
                style={{ height: `${(d.paid / max) * 100}%`, minHeight: "2px" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api.get("/admin/stats"), api.get("/admin/users?limit=100")])
      .then(([s, u]) => {
        setStats(s.data);
        setUsers(u.data.items || []);
      })
      .catch((e) => setErr(e?.response?.data?.detail || "Could not load admin data."));
  }, []);

  const totalDays = useMemo(() => stats?.signups_30d?.length || 0, [stats]);
  const totalSignups30d = useMemo(
    () => (stats?.signups_30d || []).reduce((n, d) => n + d.signups, 0),
    [stats],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="app" />
      <main className="flex-1 max-w-6xl mx-auto w-full px-5 py-10">
        <div className="mf-eyebrow">Operations · Admin</div>
        <h1 className="font-display font-bold text-3xl tracking-tight mt-2">Manifest control room</h1>
        <p className="text-sm text-ink/70 mt-2">
          Live counts and the last 30 days of signups. Numbers refresh on page load.
        </p>

        {err && <div className="mt-4 text-red-700 font-data text-sm" data-testid="admin-error">{err}</div>}
        {!stats && !err && (
          <div className="mt-6 font-data text-xs uppercase tracking-widest text-ink/60">Loading…</div>
        )}

        {stats && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <KPI label="Total users" value={stats.users.total} data-testid="kpi-total-users" />
              <KPI label="Free users" value={stats.users.free} />
              <KPI label="Paid users" value={stats.users.paid} sub={`${stats.users.total ? Math.round((stats.users.paid / stats.users.total) * 100) : 0}% conversion`} />
              <KPI label="Revenue" value={`$${stats.revenue.total_usd.toFixed(2)}`} sub={`${stats.revenue.count} payment${stats.revenue.count === 1 ? "" : "s"}`} />
            </div>

            <section className="mf-card mt-8 relative">
              <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">Logbook · Signups · 30d</div>
              <h2 className="font-display text-lg font-bold mt-3">Signups · last 30 days</h2>
              <div className="font-data text-xs text-ink/60 mt-1">
                {totalSignups30d} signup{totalSignups30d === 1 ? "" : "s"} across {totalDays} days · <span className="text-stamp">green</span> = converted to paid
              </div>
              <Bars data={stats.signups_30d} />
              <div className="flex justify-between font-data text-[10px] text-ink/50 mt-2">
                <span>{stats.signups_30d[0]?.day}</span>
                <span>{stats.signups_30d[stats.signups_30d.length - 1]?.day}</span>
              </div>
            </section>

            <section className="mf-card mt-6 relative">
              <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">Receipts · 10 most recent</div>
              <h2 className="font-display text-lg font-bold mt-3">Recent payments</h2>
              {stats.recent_payments?.length ? (
                <table className="w-full text-sm mt-3 font-data">
                  <thead className="text-left text-ink/60 text-xs uppercase tracking-widest">
                    <tr><th className="py-2">Paid at</th><th>Email</th><th>Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {stats.recent_payments.map((t) => (
                      <tr key={t.session_id} className="border-t border-line">
                        <td className="py-2">{(t.paid_at || t.created_at || "").slice(0, 16).replace("T", " ")}</td>
                        <td className="truncate max-w-[220px]">{t.email}</td>
                        <td>${Number(t.amount).toFixed(2)} {(t.currency || "usd").toUpperCase()}</td>
                        <td>{t.payment_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-ink/60 mt-2">No payments yet.</p>
              )}
            </section>

            <section className="mf-card mt-6 relative">
              <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">Crew roster</div>
              <h2 className="font-display text-lg font-bold mt-3">Users <span className="font-data text-xs text-ink/60">· {users.length} loaded</span></h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm mt-3 font-data" data-testid="admin-users-table">
                  <thead className="text-left text-ink/60 text-xs uppercase tracking-widest">
                    <tr><th className="py-2">Email</th><th>Plan</th><th>Verified</th><th>Joined</th><th>Convos packed</th></tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id} className="border-t border-line">
                        <td className="py-2 max-w-[260px] truncate">{u.email}{u.is_admin && <span className="ml-1 text-accent">★</span>}</td>
                        <td>
                          {u.plan === "full" ? (
                            <span className="text-stamp">Full</span>
                          ) : (
                            <span className="text-ink/60">Free</span>
                          )}
                        </td>
                        <td>{u.email_verified ? "yes" : <span className="text-ink/60">no</span>}</td>
                        <td>{(u.created_at || "").slice(0, 10)}</td>
                        <td>{u.usage_conversations_packed || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
