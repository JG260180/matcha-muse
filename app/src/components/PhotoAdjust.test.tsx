import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import PhotoAdjust from './PhotoAdjust';

// jsdom has no object URLs, image decoding, or canvas — stub the URL pair and
// lean on PhotoAdjust's fall-back-to-original stance for the "Use photo" path.
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(Object.create(URL), {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

const photo = new Blob(['x'], { type: 'image/jpeg' });

function renderAdjust(onDone = vi.fn(), onCancel = vi.fn()) {
  render(<PhotoAdjust photo={photo} onDone={onDone} onCancel={onCancel} />);
  return { onDone, onCancel };
}

// The frame div has size 0 in jsdom, so "ready" needs both a measured frame
// and a loaded image; simulate them.
function makeReady() {
  const img = screen.getByAltText('Photo being adjusted') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: 2000 });
  Object.defineProperty(img, 'naturalHeight', { value: 1000 });
  const frame = img.parentElement!;
  Object.defineProperty(frame, 'clientWidth', { value: 400 });
  Object.defineProperty(frame, 'clientHeight', { value: 300 });
  fireEvent.resize(window); // re-measure the frame
  fireEvent.load(img);
}

describe('PhotoAdjust', () => {
  it('renders as a modal dialog with zoom + actions, controls disabled until ready', () => {
    renderAdjust();
    expect(screen.getByRole('dialog', { name: 'Adjust photo' })).toBeDefined();
    expect(screen.getByLabelText('Zoom')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeDisabled();
    makeReady();
    expect(screen.getByLabelText('Zoom')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeEnabled();
  });

  it('Cancel and Escape both call onCancel', () => {
    const { onCancel } = renderAdjust();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('falls back to the original photo when rendering fails (no canvas here)', async () => {
    const { onDone } = renderAdjust();
    makeReady();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(photo));
  });
});
