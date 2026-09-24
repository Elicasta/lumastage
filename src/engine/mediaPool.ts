export type MediaState = "idle" | "loading" | "ready" | "playing" | "paused" | "error";
export type MediaKind = "video" | "image";
export interface MediaAsset {
  id: string; name: string; path: string; uri: string; kind: MediaKind;
  duration?: number; width?: number; height?: number; loop?: boolean;
}

export function mediaKind(path: string): MediaKind | null {
  if (!/\.(png|jpe?g|webp|gif|mp4|mov|m4v)$/i.test(path)) return null;
  return /\.(mp4|mov|m4v)$/i.test(path) ? "video" : "image";
}

const LIBRARY_KEY = "lumastage.media.library.v1";
export function readMediaLibrary(storage: Pick<Storage,"getItem">): Omit<MediaAsset,"uri">[] {
  try {
    const value = JSON.parse(storage.getItem(LIBRARY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    const ids = new Set<string>();
    return value.filter((item): item is Omit<MediaAsset,"uri"> => {
      if (!item || typeof item !== "object") return false;
      const file = item as Partial<MediaAsset>;
      if (typeof file.id !== "string" || !file.id || ids.has(file.id) || typeof file.path !== "string" || typeof file.name !== "string" || mediaKind(file.path) !== file.kind) return false;
      ids.add(file.id); return true;
    }).slice(0,500);
  } catch { return []; }
}
export function saveMediaLibrary(storage: Pick<Storage,"setItem">, files: MediaAsset[]) {
  storage.setItem(LIBRARY_KEY, JSON.stringify(files.map(({uri,...file}) => file)));
}

export class MediaPool {
  private assets = new Map<string,MediaAsset>();
  private states = new Map<string,MediaState>();
  private elements = new Map<string,HTMLVideoElement | HTMLImageElement>();
  private listeners = new Set<() => void>();
  private preview: string | null = null;
  private program: string | null = null;
  private errors = new Map<string,string>();
  private takeVersion = 0;
  private taking = false;

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private changed() { this.listeners.forEach(listener => listener()); }
  list() { return [...this.assets.values()]; }
  state(id: string) { return this.states.get(id) ?? "idle"; }
  error(id: string) { return this.errors.get(id); }
  asset(id: string) { return this.assets.get(id); }
  previewId() { return this.preview; }
  programId() { return this.program; }
  source() { return this.program ? this.elements.get(this.program) : undefined; }

  register(asset: MediaAsset, preload = true) {
    if (this.assets.get(asset.id)?.uri === asset.uri) {
      if (preload && this.state(asset.id) === "idle") this.preload(asset.id);
      return;
    }
    this.evict(asset.id);
    this.assets.set(asset.id, asset);
    this.states.set(asset.id, "idle");
    this.changed();
    if (preload) this.preload(asset.id);
  }

  preload(id: string) {
    const asset = this.assets.get(id);
    if (!asset || this.states.get(id) === "loading" || this.states.get(id) === "ready") return;
    this.states.set(id,"loading"); this.errors.delete(id); this.changed();
    if (asset.kind === "image") {
      const image = new Image();
      this.elements.set(id,image);
      image.onload = () => {
        if (this.elements.get(id) !== image) return;
        asset.width = image.naturalWidth; asset.height = image.naturalHeight;
        this.states.set(id,"ready"); this.changed();
      };
      image.onerror = () => this.fail(id,image,"Image file is missing or cannot be decoded.");
      image.src = asset.uri;
      return;
    }
    const video = document.createElement("video");
    video.preload = "auto"; video.muted = true; video.playsInline = true;
    video.loop = asset.loop ?? true;
    this.elements.set(id,video);
    video.oncanplay = () => {
      if (this.elements.get(id) !== video || this.states.get(id) === "playing") return;
      asset.width = video.videoWidth; asset.height = video.videoHeight;
      asset.duration = Number.isFinite(video.duration) ? video.duration : undefined;
      this.states.set(id,"ready"); this.changed();
    };
    video.onerror = () => this.fail(id,video,"Video file is missing or its codec cannot be decoded.");
    video.onended = () => { if (this.program === id && !video.loop) this.stop(); };
    video.src = asset.uri; video.load();
  }

  private fail(id: string, source: HTMLImageElement | HTMLVideoElement, message: string) {
    if (this.elements.get(id) !== source) return;
    if (this.program === id) this.program = null;
    this.states.set(id,"error"); this.errors.set(id,message); this.changed();
  }
  cue(id: string | null) {
    if (id && !this.assets.has(id)) return;
    this.takeVersion++;
    this.preview = id;
    if (id && this.state(id) === "idle") this.preload(id);
    this.changed();
  }
  isTaking() { return this.taking; }
  programPositionSeconds() {
    const id = this.program;
    if (!id) return 0;
    const source = this.elements.get(id);
    return source instanceof HTMLVideoElement && Number.isFinite(source.currentTime) ? source.currentTime : 0;
  }
  async take(): Promise<boolean> {
    if (this.taking) return false;
    const version = ++this.takeVersion;
    const id = this.preview;
    if (!id || !["ready","paused","playing"].includes(this.state(id))) return false;
    const source = this.elements.get(id);
    if (!source) return false;
    const previous = this.program;
    if (source instanceof HTMLVideoElement) {
      this.taking = true; this.changed();
      try { source.currentTime = 0; await source.play(); }
      catch { if (version === this.takeVersion && this.elements.get(id) === source) this.fail(id,source,"The video could not start. Check the file and codec."); return false; }
      finally { this.taking = false; this.changed(); }
      if (version !== this.takeVersion || this.preview !== id || this.elements.get(id) !== source) { source.pause(); return false; }
    }
    if (previous && previous !== id) this.stop();
    this.program = id; this.states.set(id,"playing"); this.changed();
    return true;
  }
  stop() {
    this.takeVersion++;
    const id = this.program;
    if (!id) return;
    const source = this.elements.get(id);
    if (source instanceof HTMLVideoElement) source.pause();
    this.program = null;
    this.states.set(id,"ready"); this.changed();
  }
  evict(id: string) {
    this.takeVersion++;
    if (this.program === id) this.stop();
    if (this.preview === id) this.preview = null;
    const source = this.elements.get(id);
    if (source instanceof HTMLVideoElement) { source.pause(); source.removeAttribute("src"); source.load(); }
    else if (source) source.src = "";
    this.elements.delete(id); this.assets.delete(id); this.states.delete(id); this.errors.delete(id); this.changed();
  }
}
export const mediaPool = new MediaPool();
