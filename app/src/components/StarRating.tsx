import { useId } from 'react';

interface Props {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}

export default function StarRating({ label, value, onChange }: Props) {
  return (
    <div className="flex items-center justify-between py-1">
      <span>{label}</span>
      <div className="flex items-center gap-0.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = value == null ? 0 : Math.min(Math.max(value - star + 1, 0), 1);
          return (
            <span key={star} className="relative h-9 w-9">
              <button
                type="button"
                aria-label={`${star - 0.5} stars`}
                onClick={() => onChange(star - 0.5)}
                className="absolute inset-y-0 left-0 z-10 w-1/2"
              />
              <button
                type="button"
                aria-label={`${star} stars`}
                onClick={() => onChange(star)}
                className="absolute inset-y-0 right-0 z-10 w-1/2"
              />
              <Star fill={fill} />
            </span>
          );
        })}
        <span aria-live="polite" className="ml-2 w-8 text-right font-medium">{value ?? '–'}</span>
      </div>
    </div>
  );
}

function Star({ fill }: { fill: number }) {
  const id = useId();
  const path =
    'M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.5L12 16.9 6.1 20l1.3-6.5L2.5 9l6.6-.8L12 2z';
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      <clipPath id={id}>
        <rect x="0" y="0" width={24 * fill} height="24" />
      </clipPath>
      <path d={path} fill="none" stroke="#40573B" strokeWidth="1.3" />
      <path d={path} fill="#7BA05B" clipPath={`url(#${id})`} />
    </svg>
  );
}
