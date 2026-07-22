import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewReview from './NewReview';
import { LeaveGuardProvider } from '../lib/leaveGuard';

const saveReviewOrQueue = vi.fn();
const downscalePhoto = vi.fn();
const ensureCafe = vi.fn();
vi.mock('../lib/api', () => ({
  saveReviewOrQueue: (...a: unknown[]) => saveReviewOrQueue(...a),
  downscalePhoto: (...a: unknown[]) => downscalePhoto(...a),
  ensureCafe: (...a: unknown[]) => ensureCafe(...a),
}));
vi.mock('../components/CafeMenu', () => ({
  default: ({ cafeId }: { cafeId: string }) => <div data-testid="cafe-menu" data-cafe={cafeId} />,
}));
// CafePicker hits geolocation/Places on mount — stub it to one-tap choosers.
vi.mock('../components/CafePicker', () => ({
  default: ({ onSelect }: { onSelect: (c: unknown) => void }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onSelect({
            kind: 'candidate',
            candidate: { placeId: 'place-x', name: 'Google Cafe', address: '1 King William St', latitude: -34.9, longitude: 138.6 },
          })
        }
      >
        pick-google-cafe
      </button>
      <button type="button" onClick={() => onSelect({ kind: 'manual', name: 'Manual Cafe', suburb: '' })}>
        pick-manual-cafe
      </button>
    </div>
  ),
}));
// The real form needs ratings/price/photo to enable saving — stub it to
// buttons that submit a complete or draft review directly.
vi.mock('../components/ReviewForm', () => ({
  default: ({ onSubmit }: { onSubmit: (d: unknown) => void }) => {
    const draft = {
      overall: 4, taste: null, sweetness: null, texture: null,
      temperature: null, milk: null, drink_style: null, size: null,
      price: '6', occasions: [], note: 'silky', drankAtDate: '2026-07-22',
    };
    return (
      <div>
        <button type="button" onClick={() => onSubmit({ ...draft, status: 'complete' })}>submit-complete</button>
        <button type="button" onClick={() => onSubmit({ ...draft, status: 'draft' })}>submit-draft</button>
      </div>
    );
  },
}));

// jsdom has no object URLs — stub the pair (same stance as PhotoAdjust.test).
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', Object.assign(Object.create(URL), {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderNew() {
  render(
    <MemoryRouter initialEntries={['/new']}>
      <LeaveGuardProvider>
        <Routes>
          <Route path="/new" element={<NewReview />} />
          <Route path="/" element={<p>journal home</p>} />
        </Routes>
      </LeaveGuardProvider>
    </MemoryRouter>
  );
}

describe('NewReview', () => {
  // White-screen fix (2026-07-22): a freshly picked photo is downscaled
  // before the preview or PhotoAdjust ever decodes it.
  it('downscales a newly picked photo before showing it', async () => {
    const small = new Blob(['small'], { type: 'image/jpeg' });
    downscalePhoto.mockResolvedValue(small);
    renderNew();
    const file = new File(['big'], 'big.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Choose from library'), { target: { files: [file] } });
    expect(screen.getByText('Preparing photo…')).toBeDefined();
    expect(await screen.findByAltText('Your matcha')).toBeDefined();
    expect(downscalePhoto).toHaveBeenCalledWith(file);
    expect(screen.queryByText('Preparing photo…')).toBeNull();
  });

  it('shows the cafe menu section once a Google cafe is picked', async () => {
    ensureCafe.mockResolvedValue('c9');
    renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'pick-google-cafe' }));
    const menu = await screen.findByTestId('cafe-menu');
    expect(menu.getAttribute('data-cafe')).toBe('c9');
  });

  it('shows no menu section for a manually added cafe', async () => {
    renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'pick-manual-cafe' }));
    await screen.findByRole('button', { name: 'submit-complete' });
    expect(ensureCafe).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cafe-menu')).toBeNull();
  });

  describe('Copy review to Google after saving', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    beforeEach(() => {
      writeText.mockClear();
      Object.assign(navigator, { clipboard: { writeText } });
    });

    it('offers the Google review after publishing at a Google cafe', async () => {
      ensureCafe.mockResolvedValue('c9');
      saveReviewOrQueue.mockResolvedValue('saved');
      renderNew();
      fireEvent.click(screen.getByRole('button', { name: 'pick-google-cafe' }));
      fireEvent.click(await screen.findByRole('button', { name: 'submit-complete' }));
      const link = await screen.findByRole('link', { name: /Copy review to Google/ });
      expect(link.getAttribute('href')).toContain('place-x');
      expect(link.getAttribute('target')).toBe('_blank');
      // jsdom cannot navigate; suppress the default so the click stays local.
      link.addEventListener('click', (e) => e.preventDefault());
      fireEvent.click(link);
      expect(writeText).toHaveBeenCalledWith('silky');
      expect(await screen.findByText(/note is copied/)).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(await screen.findByText('journal home')).toBeDefined();
    });

    it('goes straight to the journal when saving a draft', async () => {
      ensureCafe.mockResolvedValue('c9');
      saveReviewOrQueue.mockResolvedValue('saved');
      renderNew();
      fireEvent.click(screen.getByRole('button', { name: 'pick-google-cafe' }));
      fireEvent.click(await screen.findByRole('button', { name: 'submit-draft' }));
      expect(await screen.findByText('journal home')).toBeDefined();
    });

    it('goes straight to the journal for a manually added cafe', async () => {
      saveReviewOrQueue.mockResolvedValue('saved');
      renderNew();
      fireEvent.click(screen.getByRole('button', { name: 'pick-manual-cafe' }));
      fireEvent.click(await screen.findByRole('button', { name: 'submit-complete' }));
      expect(await screen.findByText('journal home')).toBeDefined();
    });

    it('keeps the offline-queued screen when the save was queued', async () => {
      ensureCafe.mockResolvedValue('c9');
      saveReviewOrQueue.mockResolvedValue('queued');
      renderNew();
      fireEvent.click(screen.getByRole('button', { name: 'pick-google-cafe' }));
      fireEvent.click(await screen.findByRole('button', { name: 'submit-complete' }));
      expect(await screen.findByText(/Saved on your phone/)).toBeDefined();
    });
  });
});
