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

  it('restores media lazily and begins preload only when the operator cues it', () => {
    const images: Array<{ onload?: () => void; naturalWidth: number; naturalHeight: number; src: string }> = [];
    vi.stubGlobal('Image', class { onload?: () => void; onerror?: () => void; naturalWidth = 1280; naturalHeight = 720; src = ''; constructor() { images.push(this); } });
    vi.stubGlobal('HTMLVideoElement', class {});
    const pool = new MediaPool();
    pool.register({ id: 'lazy', path: '/show/lazy.jpg', uri: 'asset://lazy', kind: 'image', name: 'Lazy' }, false);
    expect(pool.state('lazy')).toBe('idle');
    expect(images).toHaveLength(0);
    pool.cue('lazy');
    expect(pool.state('lazy')).toBe('loading');
    expect(images).toHaveLength(1);
    images[0].onload?.();
    expect(pool.state('lazy')).toBe('ready');
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

  it('cancels an in-flight video TAKE if the operator selects another preview', async () => {
    let start!: () => void;
    class Video {
      oncanplay?: () => void; onerror?: () => void; onended?: () => void;
      preload = ''; muted = false; playsInline = false; loop = false; src = '';
      videoWidth = 1920; videoHeight = 1080; duration = 10; currentTime = 0;
      paused = false;
      load() {} removeAttribute(_name: string) {}
      play() { return new Promise<void>(resolve => { start = resolve; }); }
      pause() { this.paused = true; }
    }
    const video = new Video();
    vi.stubGlobal('HTMLVideoElement', Video);
    vi.stubGlobal('document', { createElement: () => video });
    const pool = new MediaPool();
    pool.register({ id: 'clip', path: '/show/clip.mp4', uri: 'asset://clip', kind: 'video', name: 'Clip' });
    video.oncanplay?.();
    pool.cue('clip');
    const take = pool.take();
    expect(pool.isTaking()).toBe(true);
    pool.cue(null);
    start();
    expect(await take).toBe(false);
    expect(pool.isTaking()).toBe(false);
    expect(video.paused).toBe(true);
    expect(pool.programId()).toBeNull();
  });
});
