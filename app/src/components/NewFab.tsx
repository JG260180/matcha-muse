import { Link } from 'react-router-dom';

export default function NewFab() {
  return (
    <Link
      to="/new"
      aria-label="New matcha review"
      className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-matcha-deep text-3xl text-cream"
    >
      +
    </Link>
  );
}
