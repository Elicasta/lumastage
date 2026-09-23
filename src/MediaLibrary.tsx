import { useEffect, useState } from 'react';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { mediaKind, mediaPool, readMediaLibrary, saveMediaLibrary, type MediaAsset } from './engine/mediaPool';

export function useMediaPool() {
  const [, refresh] = useState(0);
  useEffect(() => mediaPool.subscribe(() => refresh(value => value + 1)), []);
  return mediaPool;
}

function persist() { saveMediaLibrary(localStorage, mediaPool.list()); }

export function RestoreMediaLibrary() {
  useEffect(() => {
    if (!isTauri()) return;
    for (const item of readMediaLibrary(localStorage)) mediaPool.register({ ...item, uri: convertFileSrc(item.path) });
  }, []);
  return null;
}

export function MediaLibrary({ close }: { close: () => void }) {
  const pool = useMediaPool();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const files = pool.list().filter(file => file.name.toLowerCase().includes(query.toLowerCase()));

  async function pick(relink?: MediaAsset) {
    if (!isTauri()) { setMessage('Import requires the LumaStage desktop app.'); return; }
    setBusy(true); setMessage('');
    try {
      const selected = await open({ multiple: !relink, filters: [
        { name: 'Images and video', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'mov', 'm4v'] },
      ] });
      const paths = selected ? (Array.isArray(selected) ? selected : [selected]) : [];
      let skipped = 0;
      for (const path of paths) {
        const kind = mediaKind(path);
        if (!kind) { skipped++; continue; }
        if (!relink && pool.list().some(file => file.path === path)) { skipped++; continue; }
        const name = path.split(/[/\\]/).pop() ?? path;
        pool.register({ id: relink?.id ?? crypto.randomUUID(), name, path, uri: convertFileSrc(path), kind });
      }
      persist();
      if (skipped) setMessage(`${skipped} duplicate or unsupported file${skipped === 1 ? '' : 's'} skipped.`);
    } catch (error) { setMessage(`Import failed: ${String(error)}`); }
    finally { setBusy(false); }
  }

  return <div className="media" role="dialog" aria-label="Media library">
    <header><b>LOCAL MEDIA</b><div><input aria-label="Search media" placeholder="Search files" value={query} onChange={event => setQuery(event.target.value)}/></div>
      <button className="media-import" disabled={busy} onClick={() => void pick()}>{busy ? 'IMPORTING…' : 'IMPORT FILES'}</button>
      <button aria-label="Close media library" onClick={close}>×</button></header>
    {message && <p className="media-message" role="status">{message}</p>}
    {files.length === 0 ? <div className="media-empty">{query ? 'No matching files.' : 'No media imported. Import files to cue them for the local program renderer.'}</div> :
      <div className="mediagrid">{files.map(file => <div className={'media-card' + (pool.previewId() === file.id ? ' selected' : '')} key={file.id}>
        <button className="media-cue" onClick={() => { pool.cue(file.id); close(); }} aria-label={`Cue ${file.name}`}>
          {file.kind === 'image' && pool.state(file.id) !== 'error' ? <img src={file.uri} alt=""/> : <span>{file.kind === 'video' ? 'VIDEO' : 'IMAGE'}</span>}
          <b title={file.name}>{file.name}</b><small>{pool.state(file.id).toUpperCase()} · {file.width && file.height ? `${file.width}×${file.height}` : 'DECODING'}</small>
        </button>
        {pool.error(file.id) && <p className="media-error" role="alert">{pool.error(file.id)}</p>}
        <div className="media-actions"><button onClick={() => void pick(file)} disabled={busy}>RELINK</button>
          {pool.state(file.id) === 'error' && <button onClick={() => pool.preload(file.id)}>RETRY</button>}
          <button onClick={() => { pool.evict(file.id); persist(); }}>REMOVE</button></div>
      </div>)}</div>}
  </div>;
}
