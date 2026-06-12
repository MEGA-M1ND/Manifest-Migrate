import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ShieldCheck,
  Package,
  FileArrowDown,
  Stamp,
  FileText,
  Check,
  X as XIcon,
  CaretRight,
} from "@phosphor-icons/react";

const Stat = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="mf-label">{label}</span>
    <span className="font-display text-2xl font-bold mt-1">{value}</span>
  </div>
);

const featureRows = [
  ["Auto-detects Projects vs. Custom GPTs vs. loose chats", true, "manual"],
  ["Extracts ChatGPT custom instructions", true, false],
  ["Works on the official ChatGPT data export", true, false],
  ["Supports split conversations-NNN.json shards", true, false],
  ["Output sized for Claude knowledge (≤700 KB parts)", true, false],
  ["Zero browser-extension install", true, false],
  ["100% offline · no network call", true, false],
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Header variant="marketing" />
      <main className="max-w-6xl mx-auto px-5">
        {/* HERO */}
        <section className="pt-14 pb-20 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8">
              <div className="mf-eyebrow">Migration Manifest · No. 001</div>
              <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl leading-[1.02] tracking-tight mt-3">
                Move your ChatGPT projects to Claude <span className="text-accent">in 5 minutes.</span>
              </h1>
              <p className="text-ink/75 text-base sm:text-lg max-w-2xl mt-5 leading-relaxed">
                Drop your ChatGPT export, pick the conversations you want, and Manifest packs a tidy zip of
                Markdown files — organized by project, ready to drag into Claude Projects' knowledge.
              </p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Link to="/signup" data-testid="hero-start-btn" className="mf-btn">
                  Start migration · Free
                  <CaretRight size={16} weight="bold" />
                </Link>
                <a href="#pricing" data-testid="hero-pricing-link" className="mf-btn mf-btn-secondary">
                  See pricing
                </a>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 border-2 border-stamp text-stamp font-data text-xs px-3 py-1.5 font-semibold">
                <ShieldCheck size={14} weight="bold" />
                <span className="tracking-widest uppercase">100% local · your data never leaves this browser</span>
              </div>
            </div>
            <div className="lg:col-span-4">
              <div className="mf-card">
                <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">
                  Bill of Lading · 001
                </div>
                <div className="mf-stamp absolute -top-4 -right-4 rotate-[-9deg] bg-white" data-testid="hero-privacy-stamp">
                  ★ Privacy<br />Verified
                </div>
                <div className="font-display font-bold text-lg mt-4">Shipment summary</div>
                <hr className="mf-divider my-3" />
                <div className="grid grid-cols-2 gap-y-4">
                  <Stat label="Origin" value="ChatGPT" />
                  <Stat label="Destination" value="Claude" />
                  <Stat label="Carrier" value="Browser" />
                  <Stat label="Customs" value="None" />
                </div>
                <hr className="mf-divider my-4" />
                <div className="font-data text-[11px] text-ink/60 leading-relaxed">
                  Open DevTools · Network panel. Watch a complete migration with <span className="text-accent">zero uploads</span>.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="py-16 border-t border-ink">
          <div className="mf-eyebrow">Section II · Procedure</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight">Three steps. No customs declaration.</h2>
          <div className="grid md:grid-cols-3 gap-0 mt-10 border border-ink">
            {[
              { n: "01", t: "Export from ChatGPT", d: "Settings → Data Controls → Export Data. The download link arrives by email." },
              { n: "02", t: "Drop the file here", d: "Either the .zip or just conversations.json. Parsing happens in your browser." },
              { n: "03", t: "Import into Claude", d: "Drag the unzipped folders into Claude Projects → Knowledge. Done." },
            ].map((s, i) => (
              <div key={s.n} className={`p-7 bg-white ${i < 2 ? "md:border-r border-ink" : ""}`}>
                <div className="font-data text-6xl text-ink/15 font-semibold">{s.n}</div>
                <div className="font-display font-bold text-xl mt-2">{s.t}</div>
                <p className="text-sm text-ink/75 mt-2 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-16 border-t border-ink">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <div className="mf-eyebrow">Section III · Cargo features</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight">
                Engineered for the one-way trip.
              </h2>
              <p className="text-ink/75 mt-4 leading-relaxed">
                Built specifically against the official ChatGPT data-export format — including the split-shard
                <code className="font-data bg-paper px-1.5 mx-1 text-sm">conversations-NNN.json</code> exports that
                Chrome-extension tools choke on.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {[
                { icon: <Package size={22} weight="bold" />, t: "Project auto-detect", d: "Groups by ChatGPT's internal project IDs." },
                { icon: <FileText size={22} weight="bold" />, t: "Custom instructions", d: "Extracts your user_editable_context." },
                { icon: <FileArrowDown size={22} weight="bold" />, t: "Claude-sized parts", d: "Merged .md files split at ~700 KB." },
                { icon: <Stamp size={22} weight="bold" />, t: "Provably private", d: "Audit it: nothing is uploaded." },
              ].map((f) => (
                <div key={f.t} className="mf-card-soft border border-line p-5">
                  <div className="text-accent">{f.icon}</div>
                  <div className="font-display font-bold mt-3">{f.t}</div>
                  <div className="text-sm text-ink/70 mt-1">{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="py-16 border-t border-ink">
          <div className="mf-eyebrow">Section IV · Comparison</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight">Manifest vs. extension exporters</h2>
          <div className="mt-8 mf-card !p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink text-white font-data uppercase text-xs tracking-widest">
                  <th className="text-left p-4">Capability</th>
                  <th className="p-4 text-center">Manifest</th>
                  <th className="p-4 text-center">Chrome extensions</th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((r, i) => (
                  <tr key={i} className={i % 2 ? "bg-paper" : ""}>
                    <td className="p-4 border-t border-line">{r[0]}</td>
                    <td className="p-4 border-t border-line text-center">
                      {r[1] === true ? <Check size={20} weight="bold" className="text-stamp inline" /> : <span className="font-data text-xs">{r[1]}</span>}
                    </td>
                    <td className="p-4 border-t border-line text-center">
                      {r[2] === false ? <XIcon size={20} weight="bold" className="text-accent inline" /> : <span className="font-data text-xs">{r[2]}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-16 border-t border-ink">
          <div className="mf-eyebrow">Section V · Tariff schedule</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight">Two routes. One destination.</h2>
          <div className="grid md:grid-cols-2 gap-6 mt-10">
            <div className="mf-card" data-testid="pricing-free-card">
              <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">
                Tariff A · Free
              </div>
              <div className="font-display font-bold text-2xl mt-4">Free tier</div>
              <div className="font-display font-bold text-5xl mt-3">$0</div>
              <div className="font-data text-xs uppercase tracking-widest text-ink/60 mt-1">forever</div>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Up to 20 conversations per migration",
                  "From 1 project at a time",
                  "100% local · zero uploads",
                  "Markdown output for Claude",
                ].map((x) => (
                  <li key={x} className="flex gap-2"><Check size={18} weight="bold" className="text-stamp shrink-0 mt-0.5" />{x}</li>
                ))}
              </ul>
              <Link to="/signup" data-testid="pricing-free-cta" className="mf-btn mf-btn-secondary mt-7 w-full">Start free</Link>
            </div>

            <div className="mf-card border-t-4 !border-t-accent" data-testid="pricing-full-card">
              <div className="absolute top-3 right-4 font-data text-[10px] uppercase tracking-widest text-ink/50">
                Tariff B · Full
              </div>
              <div className="mf-stamp absolute top-4 right-4 sm:right-32" data-testid="pricing-approved-stamp">
                ★ Approved
              </div>
              <div className="font-display font-bold text-2xl mt-4">Full version</div>
              <div className="flex items-baseline gap-2 mt-3">
                <div className="font-display font-bold text-5xl">$9</div>
                <div className="font-data text-xs uppercase tracking-widest text-ink/60">one-time · lifetime</div>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Unlimited conversations",
                  "Unlimited projects per migration",
                  "Custom-instruction extraction",
                  "Future updates included",
                  "Refund within 7 days · no questions",
                ].map((x) => (
                  <li key={x} className="flex gap-2"><Check size={18} weight="bold" className="text-stamp shrink-0 mt-0.5" />{x}</li>
                ))}
              </ul>
              <Link to="/signup?plan=full" data-testid="pricing-full-cta" className="mf-btn mt-7 w-full">Get the full version</Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 border-t border-ink">
          <div className="mf-eyebrow">Section VI · Customs questions</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight">Frequently inspected</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {[
              { q: "Is my conversation data ever uploaded?", a: "No. All parsing and packaging happens in your browser. Open DevTools → Network and watch: the tool sends only numeric usage counters to our backend, never conversation content." },
              { q: "What file formats does it accept?", a: "The .zip you receive from ChatGPT's data export, or just the conversations.json from inside that zip. Split exports (conversations-001.json etc.) work too." },
              { q: "Does it work with Team or Enterprise exports?", a: "Yes — the format is the same conversation node graph. Project detection works wherever ChatGPT includes gizmo IDs starting with g-p-." },
              { q: "Refund policy?", a: "Email us within 7 days of purchase for a no-questions refund — it'll downgrade your account automatically." },
              { q: "Do I need to install anything?", a: "No browser extensions, no desktop app. Manifest runs as a regular website. After loading, it works offline too." },
            ].map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="cursor-pointer flex items-center justify-between gap-4 list-none">
                  <span className="font-display font-bold text-lg">{f.q}</span>
                  <span className="font-data text-xs text-accent group-open:rotate-90 transition-transform">▶</span>
                </summary>
                <p className="text-ink/75 mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
