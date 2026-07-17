import { coverScale, clampView, sourceRect, MIN_ZOOM, MAX_ZOOM } from './crop';

// A 2000x1000 image in a 400x300 frame: cover scale is 0.3 (height-bound),
// so at zoom 1 the displayed image is 600x300.
const img = { width: 2000, height: 1000 };
const frame = { width: 400, height: 300 };

describe('coverScale', () => {
  it('scales so the image just covers the frame', () => {
    expect(coverScale(img, frame)).toBeCloseTo(0.3);
  });

  it('is width-bound for tall images', () => {
    expect(coverScale({ width: 300, height: 3000 }, frame)).toBeCloseTo(400 / 300);
  });
});

describe('clampView', () => {
  it('keeps zoom within bounds', () => {
    expect(clampView({ zoom: 0.2, offsetX: 0, offsetY: 0 }, img, frame).zoom).toBe(MIN_ZOOM);
    expect(clampView({ zoom: 99, offsetX: 0, offsetY: 0 }, img, frame).zoom).toBe(MAX_ZOOM);
  });

  it('clamps offsets so the frame stays covered', () => {
    // At zoom 1 the displayed image is 600x300: 100px of x slack either side, none in y.
    const v = clampView({ zoom: 1, offsetX: 500, offsetY: -50 }, img, frame);
    expect(v.offsetX).toBe(100);
    expect(v.offsetY).toBe(0);
  });

  it('allows more panning when zoomed in', () => {
    // Zoom 2: displayed 1200x600 → x slack 400, y slack 150.
    const v = clampView({ zoom: 2, offsetX: -1000, offsetY: 1000 }, img, frame);
    expect(v.offsetX).toBe(-400);
    expect(v.offsetY).toBe(150);
  });
});

describe('sourceRect', () => {
  it('is the centered cover crop at zoom 1 with no offset', () => {
    const r = sourceRect({ zoom: 1, offsetX: 0, offsetY: 0 }, img, frame);
    expect(r.sw).toBeCloseTo(400 / 0.3);
    expect(r.sh).toBeCloseTo(1000);
    expect(r.sx).toBeCloseTo((2000 - 400 / 0.3) / 2);
    expect(r.sy).toBeCloseTo(0);
  });

  it('moving the image right reveals more of its left side', () => {
    const centered = sourceRect({ zoom: 1, offsetX: 0, offsetY: 0 }, img, frame);
    const moved = sourceRect({ zoom: 1, offsetX: 60, offsetY: 0 }, img, frame);
    expect(moved.sx).toBeCloseTo(centered.sx - 60 / 0.3);
    expect(moved.sw).toBeCloseTo(centered.sw);
  });

  it('halves the source size at zoom 2', () => {
    const r = sourceRect({ zoom: 2, offsetX: 0, offsetY: 0 }, img, frame);
    expect(r.sw).toBeCloseTo(400 / 0.6);
    expect(r.sh).toBeCloseTo(500);
  });

  it('never exceeds the image bounds even at clamped extremes', () => {
    const v = clampView({ zoom: 1.5, offsetX: 9999, offsetY: 9999 }, img, frame);
    const r = sourceRect(v, img, frame);
    expect(r.sx).toBeGreaterThanOrEqual(-1e-6);
    expect(r.sy).toBeGreaterThanOrEqual(-1e-6);
    expect(r.sx + r.sw).toBeLessThanOrEqual(img.width + 1e-6);
    expect(r.sy + r.sh).toBeLessThanOrEqual(img.height + 1e-6);
  });
});
