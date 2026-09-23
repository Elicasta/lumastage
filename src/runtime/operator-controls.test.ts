import { describe, expect, it } from 'vitest';
import { stageRuntime } from './stageStore';
describe('operator output safeguards',()=>{
 it('rejects invalid scene indexes without changing program or preview',()=>{const before=stageRuntime.get();for(const value of [-1,999,NaN,0.5]){stageRuntime.preview(value);stageRuntime.goScene(value);}expect(stageRuntime.get()).toBe(before);});
 it('clamps master and speed and ignores invalid values',()=>{stageRuntime.setIntensity(-1);expect(stageRuntime.get().intensity).toBe(0);stageRuntime.setIntensity(2);stageRuntime.setIntensity(NaN);expect(stageRuntime.get().intensity).toBe(1);stageRuntime.setSpeed(3);stageRuntime.setSpeed(Infinity);expect(stageRuntime.get().speed).toBe(2);});
 it('never reports a screen definition as a confirmed output',()=>{stageRuntime.setVizConnected(true);expect(stageRuntime.vizFrame().outputs.every(x=>!x.active)).toBe(true);});
 it('keeps preview changes separate from program until take',()=>{stageRuntime.goScene(0);stageRuntime.preview(2);expect(stageRuntime.get().programScene).toBe(0);stageRuntime.take();expect(stageRuntime.get().programScene).toBe(2);});
 it('lets a successful manual media take disarm Studio auto-follow',()=>{stageRuntime.resumeAuto();expect(stageRuntime.get().autoFollow).toBe(true);stageRuntime.claimManualOutput();expect(stageRuntime.get().manualOverride).toBe(true);expect(stageRuntime.get().autoFollow).toBe(false);});
 it('ignores stale Studio frames so reconnect buffers cannot rewind auto-follow',()=>{stageRuntime.resumeAuto();stageRuntime.receiveShow({type:'luma.show',version:1,source:'lumastudio',timestamp:200,section:{name:'Chorus'}});expect(stageRuntime.get().programScene).toBe(2);stageRuntime.receiveShow({type:'luma.show',version:1,source:'lumastudio',timestamp:100,section:{name:'Verse'}});expect(stageRuntime.get().programScene).toBe(2);expect(stageRuntime.get().show?.timestamp).toBe(200);});
});
