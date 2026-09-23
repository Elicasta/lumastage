import { frameClock } from './frameClock';
import { CanvasCompositor } from './compositor';
import { renderGraph } from './renderGraph';
import { starterScenes } from './starterScenes';
import { engineHealth } from './health';
import { mediaPool } from './mediaPool';
export const playableScenes = new Map([[0, starterScenes[0]], [2, starterScenes[1]]]);
class EngineRuntime {
  private compositor?: CanvasCompositor;
  private stopClock?: () => void;
  private settings = { blackout: true, intensity: 1, speed: 1, frozen: false };
  private time = 0;
  private lastTime?: number;
  start() {
    if (this.stopClock) return;
    this.compositor = new CanvasCompositor(1920, 1080);
    this.lastTime = undefined;
    this.loadStarter(0);
    this.stopClock = frameClock.start(({ now }) => {
      const delta = this.lastTime === undefined ? 0 : Math.max(0, Math.min(100, now - this.lastTime));
      this.lastTime = now;
      if (!this.settings.frozen) this.time += delta * this.settings.speed;
      const frame = renderGraph.frame(this.time);
      if (!frame || !this.compositor) return;
      const stats = this.compositor.render(frame, this.settings.blackout ? 0 : this.settings.intensity, mediaPool.source());
      engineHealth.update({ fps: stats.fps, frameTimeMs: stats.frameTimeMs, droppedFrames: stats.droppedFrames });
    });
  }
  stop() { this.stopClock?.(); this.stopClock = undefined; }
  surface() { return this.compositor?.surface(); }
  configure(settings: typeof this.settings) { this.settings = settings; }
  loadStarter(index: number) {
    renderGraph.load(playableScenes.get(index) ?? { id: 'unavailable', name: 'Unavailable scene', width: 1920, height: 1080, background: '#000', layers: [] });
  }
}
export const engineRuntime = new EngineRuntime();
