import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaPool, mediaKind, readMediaLibrary, saveMediaLibrary } from './mediaPool';

afterEach(() => vi.unstubAllGlobals());

describe('local media', () => {
  it('accepts only declared formats and restores a validated, unique manifest', () => {
    expect(mediaKind('/show/still.JPG')).toBe('image');
    expect(mediaKind('/show/clip.mp4')).toBe('video');
    expect(mediaKind('/show/unknown.exe')).toBeNull();
    let raw = '';
    const file = { id: 'a', name: 'Still', path: '/show/still.jpg', uri: 'asset://still', kind: 'image' as const };
    saveMediaLibrary({ setItem: (_key, value) => { raw = value; } }, [file]);
    expect(raw).not.toContain('asset://still');
    const storage = { getItem: () => JSON.stringify([...JSON.parse(raw), file, { id: 'b', path: '/show/unknown.exe', name: 'Bad', kind: 'video' }]) };
    expect(readMediaLibrary(storage)).toEqual([{ id: 'a', name: 'Still', path: '/show/still.jpg', kind: 'image' }]);
  });

  it('cannot take an image until it decodes; a failed decode blocks TAKE and retry can recover', async () => {
    const images: Array<{ onload?: () => void; onerror?: () => void; naturalWidth: number; naturalHeight: number; src: string }> = [];
    vi.stubGlobal('Image', class { onload?: () => void; onerror?: () => void; naturalWidth = 1920; naturalHeight = 1080; src = ''; constructor() { images.push(this); } });
    vi.stubGlobal('HTMLVideoElement', class {});
    const pool = new MediaPool();
    pool.register({ id: 'a', path: '/show/still.jpg', uri: 'asset://still', kind: 'image', name: 'Still' });
    pool.cue('a');
    expect(await pool.take()).toBe(false);
    images[0].onerror?.();
    expect(pool.state('a')).toBe('error');
    pool.preload('a');
    images[1].onload?.();
    expect(pool.asset('a')?.width).toBe(1920);
    expect(await pool.take()).toBe(true);
    expect(pool.programId()).toBe('a');
    pool.stop();
    expect(pool.programId()).toBeNull();
  });
});
