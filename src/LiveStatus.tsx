import { useEffect, useState } from 'react';
import { useStageRuntime } from './runtime/stageStore';
import { displayOutputManager } from './output/displayOutput';
import { relayStateFromAck } from './output/displayProtocol';
import { outputs } from './data';

export function LiveStatus() {
  const runtime = useStageRuntime();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  const routes = outputs.map((_, index) => displayOutputManager.status(`output-${index}`));
  const open = routes.filter(route => route.state !== 'closed');
  const confirmed = open.filter(route => route.state === 'live' && relayStateFromAck(route.lastAckAt, now) === 'live');
  const studioFresh = runtime.studioConnected && runtime.lastStudioAt !== undefined && now - runtime.lastStudioAt < 3000;
  return <section className="live-status" aria-label="Live operation status">
    <div className={runtime.blackout ? 'status-cell blackout' : 'status-cell'}>
      <small>PROGRAM OUTPUT</small><strong>{runtime.blackout ? 'BLACKOUT ACTIVE' : 'PROGRAM ENABLED'}</strong>
      <span>{runtime.blackout ? 'All rendered output is black' : `Master intensity ${Math.round(runtime.intensity * 100)}%`}</span>
    </div>
    <div className="status-cell"><small>CONTROL AUTHORITY</small><strong>{runtime.autoFollow ? 'STUDIO AUTO-FOLLOW' : 'MANUAL CONTROL'}</strong>
      <span>{runtime.autoFollow ? studioFresh ? 'Following Studio section changes' : 'Studio offline · holding current look' : 'Your next TAKE controls Program'}</span>
    </div>
    <div className="status-cell"><small>STUDIO SHOW</small><strong>{studioFresh ? runtime.show?.song?.name || 'Connected' : 'OFFLINE'}</strong>
      <span>{studioFresh ? runtime.show?.section?.name || 'No section selected' : 'Manual operation available'}</span>
    </div>
    <div className={'status-cell' + (confirmed.length < open.length ? ' attention' : '')}><small>DISPLAY DELIVERY</small>
      <strong>{open.length ? `${confirmed.length} / ${open.length} CONFIRMED` : 'NO OUTPUT OPEN'}</strong>
      <span>{open.length ? 'Window acknowledgments · verify physical screens' : 'Open a display from Screens'}</span>
    </div>
  </section>;
}
