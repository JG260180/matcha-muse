import { render, screen, fireEvent } from '@testing-library/react';
import CafeMenu from './CafeMenu';
import type { MenuPhoto } from '../lib/menu';

const fetchMenuPhotos = vi.fn();
const addMenuPhoto = vi.fn();
const deleteMenuPhoto = vi.fn();
vi.mock('../lib/menu', () => ({
  fetchMenuPhotos: (...a: unknown[]) => fetchMenuPhotos(...a),
  addMenuPhoto: (...a: unknown[]) => addMenuPhoto(...a),
  deleteMenuPhoto: (...a: unknown[]) => deleteMenuPhoto(...a),
}));
vi.mock('./SignedImage', () => ({
  default: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

function makePhoto(over: Partial<MenuPhoto>): MenuPhoto {
  return { id: 'm1', cafe_id: 'c1', photo_path: 'menus/a.jpg', taken_at: '2026-07-15T10:00:00Z', ...over };
}

function renderMenu(photos: MenuPhoto[] | Error) {
  if (photos instanceof Error) fetchMenuPhotos.mockRejectedValue(photos);
  else fetchMenuPhotos.mockResolvedValue(photos);
  render(<CafeMenu cafeId="c1" cafeName="Cafe A" />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CafeMenu', () => {
  it('shows the empty state with add controls when the cafe has no menu photos', async () => {
    renderMenu([]);
    expect(await screen.findByText('Menu')).toBeDefined();
    expect(screen.getByText(/No menu photos yet/)).toBeDefined();
    expect(screen.getByLabelText('Take a photo')).toBeDefined();
    expect(screen.getByLabelText('Choose from library')).toBeDefined();
  });

  it('renders a positioned, labelled thumbnail per photo', async () => {
    renderMenu([makePhoto({}), makePhoto({ id: 'm2', photo_path: 'menus/b.jpg' })]);
    expect(await screen.findByRole('button', { name: 'Menu photo 1 of 2 — Cafe A' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Menu photo 2 of 2 — Cafe A' })).toBeDefined();
    expect(screen.queryByText(/No menu photos yet/)).toBeNull();
  });

  it('shows the friendly error line when the fetch fails', async () => {
    renderMenu(new Error('offline'));
    expect(await screen.findByText(/Couldn't load the menu/)).toBeDefined();
    expect(screen.queryByText('Menu')).toBeNull();
  });

  it('adds a photo via the library input and appends its thumbnail', async () => {
    renderMenu([makePhoto({})]);
    await screen.findByText('Menu');
    addMenuPhoto.mockResolvedValue(makePhoto({ id: 'm2', photo_path: 'menus/new.jpg' }));
    const file = new File(['x'], 'menu.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Choose from library'), { target: { files: [file] } });
    expect(await screen.findByRole('button', { name: 'Menu photo 2 of 2 — Cafe A' })).toBeDefined();
    expect(addMenuPhoto).toHaveBeenCalledWith('c1', file);
  });

  it('shows the friendly error when adding fails, and keeps the add controls', async () => {
    renderMenu([]);
    await screen.findByText('Menu');
    addMenuPhoto.mockRejectedValue(new Error('offline'));
    const file = new File(['x'], 'menu.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Choose from library'), { target: { files: [file] } });
    expect(await screen.findByText(/Couldn't add the photo/)).toBeDefined();
    expect(screen.getByLabelText('Choose from library')).toBeDefined();
  });

  it('opens the full-screen viewer from a thumbnail and closes it with ✕', async () => {
    renderMenu([makePhoto({})]);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' }));
    expect(screen.getByRole('dialog', { name: 'Menu photo — Cafe A' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close menu photo' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('removes a photo only after arm-then-confirm, then closes the viewer', async () => {
    deleteMenuPhoto.mockResolvedValue(undefined);
    renderMenu([makePhoto({})]);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' }));
    const remove = screen.getByRole('button', { name: 'Remove this photo' });
    fireEvent.click(remove);
    expect(deleteMenuPhoto).not.toHaveBeenCalled();
    expect(screen.getByText(/Tap again to confirm/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Tap again to confirm/ }));
    expect(deleteMenuPhoto).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/No menu photos yet/)).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the photo and shows the friendly error when removal fails', async () => {
    deleteMenuPhoto.mockRejectedValue(new Error('offline'));
    renderMenu([makePhoto({})]);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove this photo' }));
    fireEvent.click(screen.getByRole('button', { name: /Tap again to confirm/ }));
    expect(await screen.findByText(/Couldn't remove/)).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined(); // viewer stays open
    fireEvent.click(screen.getByRole('button', { name: 'Close menu photo' }));
    expect(screen.getByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' })).toBeDefined();
  });

  it('toggles the viewer photo between fitted and natural size on tap', async () => {
    renderMenu([makePhoto({})]);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu photo 1 of 1 — Cafe A' }));
    const zoom = screen.getByRole('button', { name: 'Zoom menu photo' });
    expect(zoom.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(zoom);
    expect(zoom.getAttribute('aria-pressed')).toBe('true');
  });
});
