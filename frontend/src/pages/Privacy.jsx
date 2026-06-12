import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="marketing" />
      <main className="flex-1 max-w-3xl mx-auto w-full px-5 py-12">
        <div className="mf-eyebrow">Customs declaration · Privacy</div>
        <h1 className="font-display font-bold text-4xl mt-2 tracking-tight">Privacy policy</h1>
        <div className="font-data text-xs text-ink/60 mt-2">Effective: 2026</div>

        <div className="mf-card mt-8 space-y-6 text-[15px] leading-relaxed">
          <div>
            <h2 className="font-display font-bold text-lg">1. Your conversations stay in your browser.</h2>
            <p className="mt-2 text-ink/80">
              Manifest is a privacy-first tool. The entire ChatGPT-to-Claude migration — reading your export,
              parsing conversations, repackaging them as Markdown, and creating the ZIP — runs <strong>100% in
              your browser</strong>. Conversation content is never transmitted to or stored by our servers.
              You can verify this yourself: open DevTools, switch to the Network panel, and run a full migration.
              You will see zero requests containing conversation data.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg">2. What we do collect.</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-ink/80">
              <li>Account information: email, password hash (bcrypt), display name.</li>
              <li>Authentication: when you sign in with Google, your email and name from Google.</li>
              <li>Plan status: whether your account is on Free or Full.</li>
              <li>Stripe customer ID and payment status (handled by Stripe).</li>
              <li>Numeric usage counters: how many migrations you ran, how many conversations you packed in total. Never which conversations or what they contained.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg">3. What we do NOT collect.</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-ink/80">
              <li>Conversation titles, messages, or any content from your ChatGPT export.</li>
              <li>Custom instructions or user-profile context from ChatGPT.</li>
              <li>Project names you rename inside the tool.</li>
              <li>The output ZIP — it is generated and downloaded entirely on your device.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg">4. Cookies & local storage.</h2>
            <p className="mt-2 text-ink/80">
              We store an authentication token in your browser's localStorage so you stay logged in.
              We use a standard analytics SDK (PostHog) to understand aggregate page views; it does not see
              your conversation content. You can opt out by blocking it at the browser level.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg">5. Payments.</h2>
            <p className="mt-2 text-ink/80">
              Payments are processed by Stripe. We never see your card details. Stripe receives only the data
              needed to bill you and to identify your account in our system.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg">6. Deleting your data.</h2>
            <p className="mt-2 text-ink/80">
              Visit <a href="/account" className="text-accent underline">Account</a> and click <em>Delete account</em>.
              We immediately erase your account record and payment history from our database.
            </p>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg">7. Contact.</h2>
            <p className="mt-2 text-ink/80">Questions? <a href="mailto:hello@manifest.app" className="text-accent underline">hello@manifest.app</a></p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
