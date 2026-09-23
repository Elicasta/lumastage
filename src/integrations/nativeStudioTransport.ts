import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { stageRuntime } from "../runtime/stageStore";
import { fromLegacyStudioMedia, isShowBusFrame } from "./showBus";

function nativeAvailable() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export class NativeStudioTransport {
  start() {
    if (!nativeAvailable()) return () => {};

    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    void (async () => {
      const mediaUnlisten = await listen<unknown>("lumastudio-media", event => {
        if (disposed) return;
        const payload = event.payload;
        if (isShowBusFrame(payload)) {
          stageRuntime.receiveShow(payload);
          return;
        }
        if (payload && typeof payload === "object" && (payload as { type?: unknown }).type === "lumastudio.media") {
          stageRuntime.receiveShow(fromLegacyStudioMedia(payload));
        }
      });

      if (disposed) {
        mediaUnlisten();
        return;
      }
      unlisteners.push(mediaUnlisten);

      const statusUnlisten = await listen<string>("lumastudio-media-status", event => {
        if (disposed) return;
        if (event.payload !== "connected") stageRuntime.markStudioDisconnected();
      });

      if (disposed) {
        statusUnlisten();
        return;
      }
      unlisteners.push(statusUnlisten);

      await invoke("start_lumastudio_media_listener");
    })().catch(() => {
      if (!disposed) stageRuntime.markStudioDisconnected();
    });

    return () => {
      disposed = true;
      for (const unlisten of unlisteners.splice(0)) unlisten();
    };
  }
}
