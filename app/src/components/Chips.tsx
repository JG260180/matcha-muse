interface Props<T extends string> {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
}

export default function Chips<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div>
      <span className="text-sm text-ink/70">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            type="button"
            key={o}
            aria-pressed={value === o}
            onClick={() => onChange(value === o ? null : o)}
            className={
              value === o
                ? 'rounded-full bg-matcha-deep px-4 py-2 text-sm capitalize text-cream'
                : 'rounded-full bg-sand px-4 py-2 text-sm capitalize text-sand-ink'
            }
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
