import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import UpgradeModal from "@/components/UpgradeModal";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { buildGroups, loadFile, packZip } from "@/lib/migrator";
import { FileArchive, CaretDown, CaretUp } from "@phosphor-icons/react";

const FREE_MAX_CONVOS = 20;
const FREE_MAX_PROJECTS = 1;

export default function AppTool() {
  const { user, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState({ text: "", kind: "" });
  const [groups, setGroups] = useState([]);
  const [step, setStep] = useState(1);
  const [fmt, setFmt] = useState("merged");
  const [withDates, setWithDates] = useState(true);
  const [withCI, setWithCI] = useState(true);
  const [packing, setPacking] = useState(false);
  const [stamp, setStamp] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [polling, setPolling] = useState(false);
  const ciRef = useRef({ profile: "", instructions: "" });
  const dropRef = useRef(null);
  const fileRef = useRef(null);

  const licensed = user?.plan === "full";

  // Poll Stripe checkout status if we returned from a checkout (?upgraded=1&session_id=...)
  useEffect(() => {
    const upgraded = params.get("upgraded");
    const sid = params.get("session_id");
    if (!upgraded || !sid) return;
    setPolling(true);
    let attempts = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sid}`);
        if (data.payment_status === "paid") {
          await refresh();
          setPolling(false);
          const p = new URLSearchParams(params);
          p.delete("session_id");
          p.set("upgraded", "ok");
          setParams(p, { replace: true });
          return;
        }
      } catch (e) { /* ignore */ }
      if (attempts++ < 6) setTimeout(poll, 2000);
      else setPolling(false);
    };
    poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drop handlers
  const onPickFile = () => fileRef.current?.click();
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) intake(f);
  };
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const over = (e) => { e.preventDefault(); el.classList.add("border-accent", "bg-accent-soft"); };
    const leave = (e) => { e.preventDefault(); el.classList.remove("border-accent", "bg-accent-soft"); };
    const drop = (e) => {
      e.preventDefault();
      el.classList.remove("border-accent", "bg-accent-soft");
      const f = e.dataTransfer?.files?.[0];
      if (f) intake(f);
    };
    el.addEventListener("dragover", over);
    el.addEventListener("dragenter", over);
    el.addEventListener("dragleave", leave);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", over);
      el.removeEventListener("dragenter", over);
      el.removeEventListener("dragleave", leave);
      el.removeEventListener("drop", drop);
    };
  }, []);

  async function intake(file) {
    try {
      setStatus({ text: `Reading ${file.name} …`, kind: "busy" });
      const convos = await loadFile(file);
      setStatus({ text: `Parsing ${convos.length} conversations…`, kind: "busy" });
      // brief yield
      await new Promise((r) => setTimeout(r, 30));
      ciRef.current = { profile: "", instructions: "" };
      const built = buildGroups(convos);
      setGroups(built);
      setStep(2);
      setStatus({ text: `Parsed ${convos.length} conversations.`, kind: "ok" });
    } catch (err) {
      console.error(err);
      setStatus({ text: `✕ ${err.message || "Could not read this file."}`, kind: "err" });
    }
  }

  const stats = useMemo(() => {
    let sel = 0;
    let selGroups = 0;
    groups.forEach((g) => {
      const n = g.convos.filter((c) => c.checked).length;
      if (n > 0) selGroups += 1;
      sel += n;
    });
    return { sel, selGroups };
  }, [groups]);

  const overFreeLimit = !licensed && (stats.sel > FREE_MAX_CONVOS || stats.selGroups > FREE_MAX_PROJECTS);

  // Update group checked state when convo checked changes
  const toggleGroup = (gi, checked) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i !== gi
          ? g
          : { ...g, checked, convos: g.convos.map((c) => ({ ...c, checked })) },
      ),
    );
  };
  const toggleConvo = (gi, ci, checked) => {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== gi) return g;
        const convos = g.convos.map((c, j) => (j !== ci ? c : { ...c, checked }));
        const anyChecked = convos.some((c) => c.checked);
        return { ...g, convos, checked: anyChecked };
      }),
    );
  };
  const renameGroup = (gi, name) => {
    setGroups((prev) => prev.map((g, i) => (i !== gi ? g : { ...g, name: name || "Untitled project" })));
  };
  const toggleExpand = (gi) => {
    setGroups((prev) => prev.map((g, i) => (i !== gi ? g : { ...g, _open: !g._open })));
  };

  const onPack = async () => {
    if (overFreeLimit) {
      setUpgradeReason(
        `You selected ${stats.sel} conversations across ${stats.selGroups} project${stats.selGroups === 1 ? "" : "s"}. The free tier packs up to ${FREE_MAX_CONVOS} conversations from 1 project — unlock the full version, or trim your selection.`,
      );
      setUpgradeOpen(true);
      return;
    }
    setPacking(true);
    try {
      const blob = await packZip({
        groups,
        merged: fmt === "merged",
        withDates,
        withCI: withCI && licensed,
        customInstructions: ciRef.current,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "claude-migration.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      // Send anonymous counters only — NEVER content
      try {
        await api.post("/usage/bump", { conversations: stats.sel, projects: stats.selGroups });
      } catch {}
      setStamp(true);
      setStep(3);
    } catch (e) {
      alert("Packing failed: " + (e?.message || e));
    } finally {
      setPacking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="app" />
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 py-10">
        <div className="mf-eyebrow">Migration Manifest · No. 001</div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl mt-2 tracking-tight">
          ChatGPT <span className="text-accent">→</span> Claude Migration Kit
        </h1>
        <p className="text-ink/75 mt-3 max-w-2xl leading-relaxed">
          Unpack your ChatGPT data export, sort conversations by project, and repack as clean Markdown — structured and ready to drop into Claude Projects.
        </p>

        {polling && (
          <div className="mt-5 mf-card-soft border border-stamp font-data text-xs uppercase tracking-widest text-stamp">
            Confirming payment with Stripe…
          </div>
        )}
        {params.get("upgraded") === "ok" && (
          <div className="mt-5 mf-card-soft border border-stamp p-4" data-testid="upgrade-success-banner">
            <div className="font-display font-bold text-stamp">★ Full version activated.</div>
            <div className="text-sm text-ink/70 mt-1">All limits removed. Pack as many conversations as you like.</div>
          </div>
        )}

        <div className="mf-rail mt-6">
          <span className={step >= 1 ? "on" : ""}>1 · Load export</span>
          <span className={step >= 2 ? "on" : ""}>2 · Review manifest</span>
          <span className={step >= 3 ? "on" : ""}>3 · Pack for Claude</span>
        </div>

        {/* STEP 1 — Dropzone */}
        <section className="mf-card mt-6" data-testid="loadCard">
          <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">
            Step 01 · Intake
          </div>
          <h2 className="font-display text-lg font-bold">Load your ChatGPT export</h2>
          <p className="text-sm text-ink/70 mt-1">
            Drop the export <strong>.zip</strong> you received by email, or just the <strong>conversations.json</strong> from inside it. Parsing happens entirely on this device.
          </p>
          <div
            ref={dropRef}
            tabIndex={0}
            role="button"
            data-testid="dropzone"
            onClick={onPickFile}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPickFile(); } }}
            className="mt-4 border-2 border-dashed border-line p-10 text-center cursor-pointer transition-colors hover:border-accent hover:bg-accent-soft focus:outline-none focus:border-accent"
          >
            <FileArchive size={36} weight="bold" className="mx-auto text-ink/60" />
            <div className="font-display font-bold text-lg mt-2">Drop file here, or click to browse</div>
            <div className="font-data text-xs text-ink/60 mt-1">accepts .zip · conversations.json</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            onChange={onFileChange}
            className="hidden"
            data-testid="file-input"
          />
          <div className="text-sm text-ink/70 mt-4 leading-relaxed">
            Don't have an export yet? In ChatGPT: <code className="font-data bg-paper px-1.5 text-xs">Settings → Data Controls → Export Data</code>.
            The download link arrives by email (can take up to 24 hours).
          </div>
          {status.text && (
            <div
              data-testid="status"
              className={`mt-4 font-data text-sm ${
                status.kind === "err" ? "text-red-700" : status.kind === "ok" ? "text-stamp" : "text-ink/70"
              }`}
            >
              {status.text}
            </div>
          )}
        </section>

        {/* STEP 2 — Manifest */}
        {groups.length > 0 && (
          <section className="mf-card mt-6 relative" data-testid="manifest">
            <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">
              Step 02 · Manifest
            </div>
            {stamp && (
              <div className="mf-stamp absolute top-6 right-20 animate-stamp-slam" data-testid="cleared-stamp">
                ★ Cleared<br />for import
              </div>
            )}
            <div className="border-b-2 border-ink pb-2 mb-3 flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-display text-xl font-bold">Cargo manifest</h2>
              <div className="font-data text-xs text-ink/60" data-testid="manifest-meta">
                {groups.reduce((n, g) => n + g.convos.length, 0)} conversations · {groups.filter((g) => g.kind === "project").length} project{groups.filter((g) => g.kind === "project").length === 1 ? "" : "s"} detected
              </div>
            </div>
            <p className="text-sm text-ink/70 leading-relaxed">
              Project names aren't included in ChatGPT's export — only opaque IDs — so detected Projects get placeholder names.{" "}
              <strong>Click any name to rename it.</strong> Untick anything you don't want to bring along.
            </p>

            <div className="mt-4">
              {groups.map((g, gi) => (
                <div key={g.id} className="border-b border-line" data-testid={`group-${gi}`}>
                  <div className="flex items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={g.checked}
                      onChange={(e) => toggleGroup(gi, e.target.checked)}
                      aria-label={`Include ${g.name}`}
                      className="w-4 h-4 accent-accent shrink-0 cursor-pointer"
                      data-testid={`group-checkbox-${gi}`}
                    />
                    <input
                      type="text"
                      value={g.name}
                      onChange={(e) => renameGroup(gi, e.target.value)}
                      className="font-display font-bold text-[15px] flex-1 min-w-[120px] px-1.5 py-1 bg-transparent border-0 focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent rounded-none"
                      spellCheck={false}
                      aria-label="Rename group"
                      data-testid={`group-name-${gi}`}
                    />
                    <span
                      className={`font-data text-[10.5px] uppercase tracking-widest px-2 py-1 border rounded-none whitespace-nowrap ${
                        g.kind === "project" ? "border-accent text-accent" : g.kind === "gpt" ? "border-indigo-500 text-indigo-500" : "border-line text-ink/60"
                      }`}
                    >
                      {g.kind === "project" ? "Project" : g.kind === "gpt" ? "Custom GPT" : "Loose"}
                    </span>
                    <span className="font-data text-xs text-ink/60 whitespace-nowrap">{g.convos.length} conv.</span>
                    <button
                      onClick={() => toggleExpand(gi)}
                      className="font-data text-xs border border-line px-2 py-1 hover:border-ink text-ink/70 hover:text-ink rounded-none flex items-center gap-1"
                      data-testid={`group-expand-${gi}`}
                      aria-expanded={!!g._open}
                    >
                      {g._open ? <><CaretUp size={12} weight="bold"/>Hide</> : <><CaretDown size={12} weight="bold"/>View</>}
                    </button>
                  </div>
                  {g._open && (
                    <div className="pl-12 pb-3 pr-1">
                      {g.convos.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2.5 py-1 text-sm">
                          <input
                            type="checkbox"
                            checked={c.checked}
                            onChange={(e) => toggleConvo(gi, ci, e.target.checked)}
                            className="accent-accent cursor-pointer"
                            data-testid={`convo-checkbox-${gi}-${ci}`}
                          />
                          <span className="flex-1 truncate" title={c.title}>{c.title}</span>
                          <span className="font-data text-[11px] text-ink/60 whitespace-nowrap">
                            {c.ts ? new Date(c.ts * 1000).toISOString().slice(0, 10) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-8 pt-4 pb-1 mt-2">
              <div className="text-sm">
                <div className="mf-label mb-2">Output format</div>
                <label className="flex items-center gap-2 py-0.5">
                  <input type="radio" checked={fmt === "merged"} onChange={() => setFmt("merged")} className="accent-accent" data-testid="fmt-merged"/>
                  One merged .md per project <span className="text-ink/60 text-xs">(recommended)</span>
                </label>
                <label className="flex items-center gap-2 py-0.5">
                  <input type="radio" checked={fmt === "individual"} onChange={() => setFmt("individual")} className="accent-accent" data-testid="fmt-individual"/>
                  One .md file per conversation
                </label>
              </div>
              <div className="text-sm">
                <div className="mf-label mb-2">Details</div>
                <label className="flex items-center gap-2 py-0.5">
                  <input type="checkbox" checked={withDates} onChange={(e) => setWithDates(e.target.checked)} className="accent-accent" data-testid="opt-dates"/>
                  Include conversation dates
                </label>
                <label className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={withCI}
                    onChange={(e) => setWithCI(e.target.checked)}
                    className="accent-accent"
                    disabled={!licensed}
                    data-testid="opt-ci"
                  />
                  Extract custom instructions {!licensed && <span className="text-accent text-xs">(Full only)</span>}
                </label>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-5 flex-wrap">
              <button
                onClick={onPack}
                disabled={stats.sel === 0 || packing}
                className="mf-btn"
                data-testid="pack-btn"
              >
                {packing ? "Packing…" : "Pack & download .zip"}
              </button>
              <span className="font-data text-xs text-ink/60" data-testid="selection-note">
                {stats.sel} conversation{stats.sel === 1 ? "" : "s"} selected
                {!licensed && (
                  <>
                    {" "}· free tier: {FREE_MAX_CONVOS} conv / {FREE_MAX_PROJECTS} project max
                    {overFreeLimit && <span className="text-accent"> — over limit</span>}
                  </>
                )}
              </span>
              {!licensed && (
                <button onClick={() => { setUpgradeReason(""); setUpgradeOpen(true); }} className="font-data text-xs underline text-accent" data-testid="unlock-link">
                  Unlock full version
                </button>
              )}
            </div>
          </section>
        )}

        {/* STEP 3 — Last mile */}
        {step >= 3 && (
          <section className="mf-card mt-6" data-testid="afterbox">
            <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">
              Step 03 · Delivery
            </div>
            <h2 className="font-display text-lg font-bold">Last mile — into Claude</h2>
            <p className="text-sm text-ink/70 mt-1">Your zip contains one folder per project, plus a README with these same steps.</p>
            <ol className="mt-3 pl-5 leading-[1.85] text-[14.5px] list-decimal marker:font-data marker:font-semibold marker:text-accent">
              <li>Unzip the download on your computer.</li>
              <li>In Claude, click <code className="font-data bg-paper px-1.5 text-xs">Projects → Create project</code> and name it after a folder.</li>
              <li>Open the folder and drag its <code className="font-data bg-paper px-1.5 text-xs">.md</code> files into the project's <strong>knowledge</strong> panel.</li>
              <li>If the folder contains <code className="font-data bg-paper px-1.5 text-xs">_custom-instructions.md</code>, paste its contents into the project's <strong>Set instructions</strong> field.</li>
              <li>Repeat per project. Start a chat and ask Claude to confirm what context it has.</li>
            </ol>
          </section>
        )}
      </main>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />
      <Footer />
    </div>
  );
}
