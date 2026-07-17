import { Link } from 'react-router-dom';
import { useGuardedClick } from '../lib/leaveGuard';

// Explicit way back for anyone who doesn't know the header is tappable.
// The header link stays — this is in addition (owner request 2026-07-12).
// Respects the leave-guard: a half-finished review intercepts this link.
export default function BackToJournal() {
  const guarded = useGuardedClick();
  return (
    <Link to="/" onClick={guarded('/')} className="inline-flex min-h-11 items-center px-6 text-sm text-matcha-deep">
      ← Journal
    </Link>
  );
}
