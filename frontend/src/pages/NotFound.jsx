import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mf-card max-w-sm text-center">
        <div className="mf-eyebrow">Manifest · 404</div>
        <div className="font-display text-3xl font-bold mt-2">No such cargo.</div>
        <p className="text-sm text-ink/70 mt-2">This route isn't on the manifest.</p>
        <Link to="/" className="mf-btn mt-5 inline-flex">Back to landing</Link>
      </div>
    </div>
  );
}
