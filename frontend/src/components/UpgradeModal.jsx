import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { api } from "@/lib/api";

export default function UpgradeModal({ open, onClose, reason }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) setErr("");
  }, [open]);

  if (!open) return null;

  const startCheckout = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.post("/payments/checkout", { origin_url: window.location.origin });
      window.location.href = data.url;
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not start checkout. Try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-5"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="upgrade-modal"
    >
      <div className="bg-white border border-ink shadow-[6px_6px_0_0_#14213D] max-w-md w-full p-7 relative">
        <div className="absolute -top-4 left-6 bg-accent text-white px-3 py-1 font-data text-[10px] uppercase tracking-widest">
          Customs · Upgrade
        </div>
        <button onClick={onClose} aria-label="Close" data-testid="upgrade-modal-close" className="absolute top-3 right-3 text-ink/60 hover:text-ink">
          <X size={20} weight="bold" />
        </button>
        <h3 className="font-display text-xl font-bold mt-3">Unlock the full version</h3>
        <p className="text-sm text-ink/70 mt-2 leading-relaxed">
          {reason || "The free tier covers a taste of the migration. The full version removes all limits — one payment, yours forever."}
        </p>
        <div className="font-data text-xs bg-paper border border-line p-3 mt-4 leading-relaxed">
          <div><span className="text-ink/60">FREE</span> — 20 conversations · 1 project</div>
          <div><span className="text-ink/60">FULL</span> — unlimited convos · unlimited projects · custom instructions</div>
        </div>
        <button
          onClick={startCheckout}
          disabled={loading}
          data-testid="upgrade-buy-btn"
          className="mf-btn w-full mt-5 !py-3"
        >
          {loading ? "Opening checkout…" : "Buy full version · $9 one-time"}
        </button>
        {err && <div className="mt-3 text-sm text-red-700 font-data" data-testid="upgrade-error">{err}</div>}
        <p className="text-[11px] text-ink/50 font-data mt-4 leading-relaxed">
          Payment is processed by Stripe. Lifetime access, no subscription.
        </p>
      </div>
    </div>
  );
}
