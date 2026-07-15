import { fetchMenuPhotos, addMenuPhoto, deleteMenuPhoto, type MenuPhoto } from './menu';

const order = vi.fn();
const single = vi.fn();
const insertArg = vi.fn();
const deleteEq = vi.fn();
const upload = vi.fn();
const remove = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: (col: string, opts: unknown) => order(col, opts) }),
      }),
      insert: (row: unknown) => {
        insertArg(row);
        return { select: () => ({ single: () => single() }) };
      },
      delete: () => ({ eq: (col: string, val: unknown) => deleteEq(col, val) }),
    }),
    storage: {
      from: () => ({
        upload: (path: string, body: unknown) => upload(path, body),
        remove: (paths: string[]) => remove(paths),
      }),
    },
  },
}));

// Downscale is covered by its own tests; here it just passes the blob through.
vi.mock('./api', () => ({ downscalePhoto: vi.fn(async (b: Blob) => b) }));

const photo: MenuPhoto = {
  id: 'm1', cafe_id: 'c1', photo_path: 'menus/abc.jpg', taken_at: '2026-07-15T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchMenuPhotos', () => {
  it('returns photos ordered oldest-first (page 1 stays first)', async () => {
    order.mockResolvedValue({ data: [photo], error: null });
    const result = await fetchMenuPhotos('c1');
    expect(order).toHaveBeenCalledWith('taken_at', { ascending: true });
    expect(result).toEqual([photo]);
  });

  it('returns [] when the table has no rows for the cafe', async () => {
    order.mockResolvedValue({ data: null, error: null });
    expect(await fetchMenuPhotos('c1')).toEqual([]);
  });

  it('throws on fetch error', async () => {
    order.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(fetchMenuPhotos('c1')).rejects.toThrow('boom');
  });
});

describe('addMenuPhoto', () => {
  it('uploads under menus/ then inserts a row pointing at the same path', async () => {
    upload.mockResolvedValue({ error: null });
    single.mockResolvedValue({ data: photo, error: null });
    const result = await addMenuPhoto('c1', new Blob(['x']));
    const uploadedPath = upload.mock.calls[0][0] as string;
    expect(uploadedPath).toMatch(/^menus\/[0-9a-f-]+\.jpg$/);
    expect(insertArg).toHaveBeenCalledWith({ cafe_id: 'c1', photo_path: uploadedPath });
    expect(result).toEqual(photo);
  });

  it('surfaces an upload failure and never inserts', async () => {
    upload.mockResolvedValue({ error: new Error('storage down') });
    await expect(addMenuPhoto('c1', new Blob(['x']))).rejects.toThrow('storage down');
    expect(insertArg).not.toHaveBeenCalled();
  });

  it('surfaces an insert failure (uploaded file is an accepted orphan)', async () => {
    upload.mockResolvedValue({ error: null });
    single.mockResolvedValue({ data: null, error: new Error('rls says no') });
    await expect(addMenuPhoto('c1', new Blob(['x']))).rejects.toThrow('rls says no');
  });
});

describe('deleteMenuPhoto', () => {
  it('removes the storage object, then the row', async () => {
    remove.mockResolvedValue({ error: null });
    deleteEq.mockResolvedValue({ error: null });
    await deleteMenuPhoto(photo);
    expect(remove).toHaveBeenCalledWith(['menus/abc.jpg']);
    expect(deleteEq).toHaveBeenCalledWith('id', 'm1');
  });

  it('still deletes the row when storage cleanup fails (accepted orphan)', async () => {
    remove.mockResolvedValue({ error: new Error('nope') });
    deleteEq.mockResolvedValue({ error: null });
    await expect(deleteMenuPhoto(photo)).resolves.toBeUndefined();
    expect(deleteEq).toHaveBeenCalledWith('id', 'm1');
  });

  it('throws when the row delete fails', async () => {
    remove.mockResolvedValue({ error: null });
    deleteEq.mockResolvedValue({ error: new Error('row gone wrong') });
    await expect(deleteMenuPhoto(photo)).rejects.toThrow('row gone wrong');
  });
});
