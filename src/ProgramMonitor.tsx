import { useEffect, useRef } from 'react';
import { engineRuntime, playableScenes } from './engine/engineRuntime';
import { CanvasCompositor } from './engine/compositor';
import { RenderGraph } from './engine/renderGraph';
export function ProgramMonitor() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mount = () => { const canvas = engineRuntime.surface(); if (canvas && host.current) { canvas.setAttribute('aria-label', 'Actual local program renderer'); if(host.current.firstChild!==canvas)host.current.replaceChildren(canvas); } };
    mount(); const timer = window.setInterval(mount,250); return () => { window.clearInterval(timer); host.current?.replaceChildren(); };
  }, []);
  return <div className="render-monitor" ref={host}/>;
}
export function PreviewMonitor({ index }: { index: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = playableScenes.get(index); if (!scene || !host.current) return;
    const compositor = new CanvasCompositor(640,360), graph = new RenderGraph();
    graph.load({...scene,width:640,height:360});
    compositor.surface().setAttribute('aria-label', 'Local preview renderer');
    host.current.replaceChildren(compositor.surface());
    let frame = 0; const draw = (time: number) => { const value = graph.frame(time); if(value)compositor.render(value); frame=requestAnimationFrame(draw); }; frame=requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); host.current?.replaceChildren(); };
  },[index]);
  return <div className="render-monitor" ref={host}>{!playableScenes.has(index)&&<span>Scene renderer unavailable</span>}</div>;
}
