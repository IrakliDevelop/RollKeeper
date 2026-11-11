import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortraitUpload } from '../usePortraitUpload';

const URL_A = 'https://rollkeeper-images.s3.amazonaws.com/npc/a.webp';
const URL_B = 'https://rollkeeper-images.s3.amazonaws.com/npc/b.webp';

const fetchMock = vi.fn();

function imageFile(name = 'p.png', type = 'image/png') {
  return new File(['x'], name, { type });
}

function okUpload(url: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ url }),
  });
}

function deleteCalls() {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE'
  );
}

function deletedUrls() {
  return deleteCalls().map(([input]) =>
    decodeURIComponent(String(input).split('?url=')[1])
  );
}

function setup() {
  const onChange = vi.fn();
  const hook = renderHook(() =>
    usePortraitUpload({ npcId: 'npc-1', onChange })
  );
  return { ...hook, onChange };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePortraitUpload upload', () => {
  it('rejects a non-image file without sending a request', async () => {
    const { result, onChange } = setup();
    await act(async () => {
      await result.current.upload(imageFile('notes.txt', 'text/plain'));
    });
    expect(result.current.error).toBe('type');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a file over 5 MB without sending a request', async () => {
    const { result } = setup();
    const big = imageFile();
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
    await act(async () => {
      await result.current.upload(big);
    });
    expect(result.current.error).toBe('size');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a file of exactly 5 MB', async () => {
    const { result, onChange } = setup();
    const exact = imageFile();
    Object.defineProperty(exact, 'size', { value: 5 * 1024 * 1024 });
    okUpload(URL_A);
    await act(async () => {
      await result.current.upload(exact);
    });
    expect(result.current.error).toBeNull();
    expect(onChange).toHaveBeenCalledWith(URL_A);
  });

  it('reports upload when the POST fails and leaves the value alone', async () => {
    const { result, onChange } = setup();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await act(async () => {
      await result.current.upload(imageFile());
    });
    expect(result.current.error).toBe('upload');
    expect(result.current.uploading).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports upload when the request throws', async () => {
    const { result, onChange } = setup();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.upload(imageFile());
    });
    expect(result.current.error).toBe('upload');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('posts the file and npcId to the upload route', async () => {
    const { result } = setup();
    okUpload(URL_A);
    await act(async () => {
      await result.current.upload(imageFile());
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/npc/upload');
    expect((init as RequestInit).method).toBe('POST');
    const body = (init as RequestInit).body as FormData;
    expect(body.get('npcId')).toBe('npc-1');
    expect((body.get('file') as File).name).toBe('p.png');
  });

  it('uses a generated npcId when there is no NPC yet', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePortraitUpload({ npcId: undefined, onChange })
    );
    okUpload(URL_A);
    await act(async () => {
      await result.current.upload(imageFile());
    });
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(String(body.get('npcId'))).toMatch(/^new-npc-\d+$/);
  });

  it('calls onChange with the new url, clears the error and sends no DELETE', async () => {
    const { result, onChange } = setup();
    await act(async () => {
      await result.current.upload(imageFile('notes.txt', 'text/plain'));
    });
    expect(result.current.error).toBe('type');

    okUpload(URL_A);
    await act(async () => {
      await result.current.upload(imageFile());
    });
    expect(result.current.error).toBeNull();
    expect(onChange).toHaveBeenCalledWith(URL_A);
    expect(deleteCalls()).toHaveLength(0);
  });

  it('is uploading while the request is in flight', async () => {
    const { result } = setup();
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise(r => (resolve = r)));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.upload(imageFile());
    });
    expect(result.current.uploading).toBe(true);
    await act(async () => {
      resolve({ ok: true, json: async () => ({ url: URL_A }) });
      await pending;
    });
    expect(result.current.uploading).toBe(false);
  });
});

describe('usePortraitUpload cleanup', () => {
  it('commit deletes earlier session uploads but keeps the saved one', async () => {
    const { result } = setup();
    okUpload(URL_A);
    await act(async () => {
      await result.current.upload(imageFile());
    });
    okUpload(URL_B);
    await act(async () => {
      await result.current.upload(imageFile());
    });
    act(() => result.current.commit(URL_B));
    expect(deleteCalls()).toHaveLength(1);
    expect(deletedUrls()).toEqual([URL_A]);
    expect(deleteCalls()[0][1]).toEqual({ method: 'DELETE' });
  });

  it('discardAll deletes every session upload', async () => {
    const { result } = setup();
    okUpload(URL_A);
    await act(async () => {
      await result.current.upload(imageFile());
    });
    act(() => result.current.discardAll());
    expect(deletedUrls()).toEqual([URL_A]);
  });

  it('remove clears the value without a DELETE, and commit sends none either', () => {
    const { result, onChange } = setup();
    act(() => result.current.remove());
    expect(onChange).toHaveBeenCalledWith('');
    act(() => result.current.commit(''));
    expect(deleteCalls()).toHaveLength(0);
  });

  it('discardAll with no session uploads sends no DELETE', () => {
    const { result } = setup();
    act(() => result.current.discardAll());
    expect(deleteCalls()).toHaveLength(0);
  });

  it('forgets uploads after commit', async () => {
    const { result } = setup();
    okUpload(URL_A);
    await act(async () => {
      await result.current.upload(imageFile());
    });
    act(() => result.current.commit(URL_A));
    act(() => result.current.discardAll());
    expect(deleteCalls()).toHaveLength(0);
  });

  it('forgets uploads after discardAll', async () => {
    const { result } = setup();
    okUpload(URL_A);
    await act(async () => {
      await result.current.upload(imageFile());
    });
    act(() => result.current.discardAll());
    act(() => result.current.discardAll());
    expect(deleteCalls()).toHaveLength(1);
  });

  it('does not record an upload that failed', async () => {
    const { result } = setup();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await act(async () => {
      await result.current.upload(imageFile());
    });
    act(() => result.current.discardAll());
    expect(deleteCalls()).toHaveLength(0);
  });

  it('sends no DELETE for a url that is not on S3', async () => {
    const { result } = setup();
    okUpload('https://example.com/local/a.webp');
    await act(async () => {
      await result.current.upload(imageFile());
    });
    act(() => result.current.discardAll());
    expect(deleteCalls()).toHaveLength(0);
  });

  it('sends no DELETE for a regional S3 URL, matching the other upload controls', async () => {
    const { result } = setup();
    okUpload(
      'https://rollkeeper-images.s3.eu-central-1.amazonaws.com/npc/a.webp'
    );
    await act(async () => {
      await result.current.upload(imageFile());
    });
    act(() => result.current.discardAll());
    expect(deleteCalls()).toHaveLength(0);
  });
});
