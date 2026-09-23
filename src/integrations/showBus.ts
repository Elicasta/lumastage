export const LUMA_SHOW_BUS_VERSION=1 as const;
export type PlaybackState="playing"|"paused"|"stopped";export type ProgramState="live"|"black"|"clear"|"freeze";
export interface ShowBusFrame{type:"luma.show";version:1;source:"lumastudio"|"lumastage"|"lumarig";timestamp:number;showId?:string;song?:{id?:string;name:string;artist?:string;positionSeconds:number;durationSeconds?:number;bpm?:number;playback:PlaybackState};section?:{id?:string;name:string;index?:number;progress?:number};beat?:{bar?:number;beat?:number;phase?:number};}
export interface StageProgramFrame{type:"lumastage.program";version:1;timestamp:number;outputId:string;state:ProgramState;sceneId?:string;sceneName?:string;positionSeconds:number;playing:boolean;sectionId?:string;previewUrl?:string;}
export interface StageVizFrame{type:"lumastage.viz";version:1;timestamp:number;outputs:Array<{id:string;name:string;width:number;height:number;active:boolean;previewUrl?:string;fit:"fit"|"fill"|"stretch";brightness:number;flipX:boolean;flipY:boolean;rotation:number;latencyMs:number}>;}
export function isShowBusFrame(v:unknown):v is ShowBusFrame{if(!v||typeof v!=="object"||Array.isArray(v))return false;const x=v as Partial<ShowBusFrame>;if(x.type!=="luma.show"||x.version!==1||!["lumastudio","lumastage","lumarig"].includes(String(x.source))||typeof x.timestamp!=="number"||!Number.isFinite(x.timestamp)||x.timestamp<0)return false;if(x.song){if(typeof x.song.name!=="string"||!Number.isFinite(x.song.positionSeconds)||x.song.positionSeconds<0||!["playing","paused","stopped"].includes(x.song.playback))return false;}if(x.section){if(typeof x.section.name!=="string"||x.section.progress!==undefined&&(!Number.isFinite(x.section.progress)||x.section.progress<0||x.section.progress>1))return false;}return true;}
export function fromLegacyStudioMedia(frame:any):ShowBusFrame{
  const timestamp=Number(frame?.timestamp);
  const position=Number(frame?.positionSeconds);
  const duration=Number(frame?.song?.durationSeconds);
  const bpm=Number(frame?.song?.bpm);
  const sectionIndex=Number(frame?.sectionIndex);
  const songName=typeof frame?.song?.name==="string"&&frame.song.name.trim()
    ?frame.song.name.trim()
    :typeof frame?.program?.name==="string"&&frame.program.name.trim()
      ?frame.program.name.trim()
      :"LumaStudio";
  const sectionName=typeof frame?.sectionName==="string"&&frame.sectionName.trim()
    ?frame.sectionName.trim()
    :typeof frame?.sectionId==="string"&&frame.sectionId.trim()
      ?frame.sectionId.trim()
      :"";
  return{
    type:"luma.show",
    version:1,
    source:"lumastudio",
    timestamp:Number.isFinite(timestamp)&&timestamp>=0?timestamp:Date.now(),
    song:{
      id:typeof frame?.song?.id==="string"?frame.song.id:undefined,
      name:songName,
      artist:typeof frame?.song?.artist==="string"?frame.song.artist:undefined,
      positionSeconds:Number.isFinite(position)&&position>=0?position:0,
      durationSeconds:Number.isFinite(duration)&&duration>=0?duration:undefined,
      bpm:Number.isFinite(bpm)&&bpm>0?bpm:undefined,
      playback:frame?.playing?"playing":"paused"
    },
    section:sectionName?{
      id:typeof frame?.sectionId==="string"?frame.sectionId:undefined,
      name:sectionName,
      index:Number.isInteger(sectionIndex)&&sectionIndex>=0?sectionIndex:undefined
    }:undefined
  };
}