import { Link } from 'react-router-dom';

// Explicit way back for anyone who doesn't know the header is tappable.
// The header link stays — this is in addition (owner request 2026-07-12).
export default function BackToJournal() {
  return (
    <Link to="/" className="inline-flex min-h-11 items-center px-6 text-sm text-matcha-deep">
      ← Journal
    </Link>
  );
}
