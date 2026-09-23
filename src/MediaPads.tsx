import { useState } from 'react';
import { useMediaPool } from './MediaLibrary';

const BANK_SIZE = 8;

export function MediaPads() {
  const pool = useMediaPool();
  const [bank, setBank] = useState(0);
  const files = pool.list();
  const maxBank = Math.max(0, Math.ceil(files.length / BANK_SIZE) - 1);
  const currentBank = Math.min(bank, maxBank);
  const clips = files.slice(currentBank * BANK_SIZE, (currentBank + 1) * BANK_SIZE);

  return <section className="live-clips" aria-label="Media clip bank">
    <header><b>MEDIA CLIPS</b><span>CUE A CLIP, THEN TAKE</span><div className="clip-banks">
      <button aria-label="Previous media bank" disabled={currentBank === 0} onClick={() => setBank(currentBank - 1)}>‹</button>
      <small>BANK {currentBank + 1} / {maxBank + 1}</small>
      <button aria-label="Next media bank" disabled={currentBank === maxBank} onClick={() => setBank(currentBank + 1)}>›</button>
    </div></header>
    {files.length === 0 ? <p className="clip-empty">Use MEDIA in the top bar to import local images or video.</p> :
      <div className="clip-grid">{clips.map(file => {
        const state = pool.state(file.id);
        const isProgram = pool.programId() === file.id;
        const isPreview = pool.previewId() === file.id;
        const status = isProgram ? 'PROGRAM' : state === 'error' ? 'FILE ERROR' : state === 'loading' ? 'LOADING' : isPreview ? 'CUED' : state === 'idle' ? 'LOAD ON CUE' : 'READY';
        return <button key={file.id} className={'clip-pad' + (isProgram ? ' playing' : isPreview ? ' cued' : '')}
          disabled={state === 'error' || state === 'loading'} title={pool.error(file.id) ?? file.path} onClick={() => pool.cue(file.id)}
          aria-label={`Cue ${file.name}, ${status.toLowerCase()}`}>
          <span className="clip-kind">{file.kind.toUpperCase()}</span><strong>{file.name}</strong>
          <small>{file.width && file.height ? `${file.width}×${file.height}` : file.kind.toUpperCase()}</small>
          <em>{status}</em>
        </button>;
      })}</div>}
    <p className="clip-route">Local Program renderer · video audio muted · external screen output unavailable</p>
  </section>;
}
