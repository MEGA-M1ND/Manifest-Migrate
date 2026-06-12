import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="marketing" />
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 py-12">
        <div className="mf-eyebrow">Bill of Lading · Terms</div>
        <h1 className="font-display font-bold text-4xl mt-2 tracking-tight">Terms of Service</h1>
        <div className="font-data text-xs text-ink/60 mt-2">Effective: 2026</div>

        <div className="mf-card mt-8 space-y-6 text-[15px] leading-relaxed">
          <div>
            <h2 className="font-display font-bold text-lg">1. What Manifest is.</h2>
            <p className="mt-2 text-ink/80">
              Manifest is a browser-side tool that converts your ChatGPT data export into Markdown files organized
              for Claude Projects. You provide the export file; the tool parses it locally and packs the output as a ZIP
              you download.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">2. Account.</h2>
            <p className="mt-2 text-ink/80">
              You agree to provide accurate account information and to keep your password secure. You're responsible for
              activity on your account.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">3. Plans & payments.</h2>
            <p className="mt-2 text-ink/80">
              The Free plan permits packing up to 20 conversations from 1 project per session. The Full plan ($9 one-time,
              lifetime) removes those limits and enables custom-instruction extraction. We may adjust limits with notice.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">4. Refunds.</h2>
            <p className="mt-2 text-ink/80">
              Email us within 7 days of purchase for a no-questions refund. We process the refund through Stripe; your
              account downgrades to Free.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">5. Acceptable use.</h2>
            <p className="mt-2 text-ink/80">
              Don't use Manifest to process data you don't have the right to process. Don't attempt to abuse, reverse-engineer,
              or interfere with the service.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">6. No warranty.</h2>
            <p className="mt-2 text-ink/80">
              Manifest is provided "as is". Parsing is best-effort and tested against the official ChatGPT export format,
              but we don't guarantee compatibility with future format changes.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">7. Liability.</h2>
            <p className="mt-2 text-ink/80">
              Our maximum liability is limited to the amount you paid us in the last 12 months.
            </p>
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">8. Contact.</h2>
            <p className="mt-2 text-ink/80"><a href="mailto:hello@manifest.app" className="text-accent underline">hello@manifest.app</a></p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
