import { useEffect, useRef, useState } from 'react';
import {
  clampView, coverScale, sourceRect, MIN_ZOOM, MAX_ZOOM,
  type CropView, type Size,
} from '../lib/crop';

interface Props {
  photo: Blob;
  onDone: (cropped: Blob) => void;
  onCancel: () => void;
}

// The crop frame is 4:3 — the journal card (~1.1:1) and the detail header
// (~1.7:1) both crop from it modestly, so what she frames here is what shows.
const ASPECT = 4 / 3;
const MAX_OUT_WIDTH = 1600;
const JPEG_QUALITY = 0.8;

// Full-screen crop/position dialog (same dialog pattern as CafeMenu's viewer:
// aria-modal, autofocus, Escape closes, focus returns). Drag to position,
// slider to zoom, "Use photo" bakes the crop into a JPEG. Same stance as
// downscalePhoto: on ANY render failure the original photo is used unchanged —
// a photo must never be lost to this step.
export default function PhotoAdjust({ photo, onDone, onCancel }: Props) {
  const [url] = useState(() => URL.createObjectURL(photo));
  const [natural, setNatural] = useState<Size | null>(null);
  const [frame, setFrame] = useState<Size | null>(null);
  const [view, setView] = useState<CropView>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      URL.revokeObjectURL(url);
      returnFocusRef.current?.focus();
    };
  }, [url]);

  useEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (el) setFrame({ width: el.clientWidth, height: el.clientHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const ready = natural != null && frame != null;
  const scale = ready ? coverScale(natural, frame) * view.zoom : 1;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, baseX: view.offsetX, baseY: view.offsetY };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || !ready) return;
    setView((v) =>
      clampView(
        {
          ...v,
          offsetX: drag.current!.baseX + (e.clientX - drag.current!.x),
          offsetY: drag.current!.baseY + (e.clientY - drag.current!.y),
        },
        natural!,
        frame!
      )
    );
  }

  function onPointerEnd() {
    drag.current = null;
  }

  function onZoom(z: number) {
    if (!ready) return;
    setView((v) => clampView({ ...v, zoom: z }, natural!, frame!));
  }

  async function usePhoto() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
      const img = { width: bitmap.width, height: bitmap.height };
      const r = sourceRect(clampView(view, img, frame!), img, frame!);
      const outW = Math.max(1, Math.min(MAX_OUT_WIDTH, Math.round(r.sw)));
      const outH = Math.max(1, Math.round(outW / ASPECT));
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, outW, outH);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
      );
      onDone(blob ?? photo);
    } catch {
      onDone(photo);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adjust photo"
      className="fixed inset-0 z-50 flex flex-col bg-ink/95"
    >
      <div className="flex justify-end p-3">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          aria-label="Cancel adjusting"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-cream/20 text-lg leading-none text-cream"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className="relative w-full max-w-md touch-none select-none overflow-hidden rounded-2xl bg-ink"
          style={{ aspectRatio: '4 / 3' }}
        >
          <img
            src={url}
            alt="Photo being adjusted"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ width: el.naturalWidth, height: el.naturalHeight });
            }}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={
              ready
                ? {
                    width: natural!.width * scale,
                    height: natural!.height * scale,
                    transform: `translate(calc(-50% + ${view.offsetX}px), calc(-50% + ${view.offsetY}px))`,
                  }
                : { visibility: 'hidden' }
            }
          />
        </div>
      </div>

      <p className="pt-3 text-center text-sm text-cream/80">Drag to position · slide to zoom</p>

      <div className="space-y-3 p-4">
        <input
          type="range"
          aria-label="Zoom"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          disabled={!ready}
          onChange={(e) => onZoom(Number(e.target.value))}
          className="w-full accent-matcha-deep"
        />
        <button
          type="button"
          onClick={usePhoto}
          disabled={!ready || busy}
          className="w-full rounded-xl bg-matcha-deep p-4 font-medium text-cream disabled:opacity-40"
        >
          {busy ? 'Preparing…' : 'Use photo'}
        </button>
        <button type="button" onClick={onCancel} className="w-full p-2 text-cream/70 underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
