import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { engineHealth } from "../engine/health";
import {
  displayChannelName,
  isDisplayRelayMessage,
  relayStateFromAck,
  type DisplayRelayStatus,
  type DisplayTargetDefinition
} from "./displayProtocol";

type Session = {
  target: DisplayTargetDefinition;
  status: DisplayRelayStatus;
  channel: BroadcastChannel;
  window?: WebviewWindow;
};

const RELAY_FPS = 30;
const RELAY_INTERVAL_MS = Math.round(1000 / RELAY_FPS);

function desktopAvailable() {
  return typeof window !== "undefined"
    && "__TAURI_INTERNALS__" in window
    && typeof BroadcastChannel !== "undefined";
}

function labelFor(id: string) {
  return "stage-output-" + id.replace(/[^a-zA-Z0-9_/:\-]/g, "-");
}

function initialStatus(targetId: string): DisplayRelayStatus {
  return {
    targetId,
    state: "closed",
    framesSent: 0,
    framesAcked: 0,
    latencyMs: null,
    lastAckAt: null,
    fullscreen: false
  };
}

class DisplayOutputManager {
  private sessions = new Map<string, Session>();
  private listeners = new Set<() => void>();
  private source?: () => HTMLCanvasElement | undefined;
  private relayTimer?: number;
  private encoding = false;
  private sequence = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  setSource(provider: () => HTMLCanvasElement | undefined) {
    this.source = provider;
  }

  available() {
    return desktopAvailable();
  }

  status(targetId: string): DisplayRelayStatus {
    return this.sessions.get(targetId)?.status ?? initialStatus(targetId);
  }

  snapshot(targetIds: readonly string[]) {
    return targetIds.map(id => this.status(id));
  }

  async open(target: DisplayTargetDefinition) {
    if (!this.available()) {
      throw this.fail(target, "Display windows are available only in the LumaStage desktop app.");
    }

    let session = this.sessions.get(target.id);
    if (!session) {
      const channel = new BroadcastChannel(displayChannelName(target.id));
      session = { target, channel, status: { ...initialStatus(target.id), state: "opening" } };
      this.sessions.set(target.id, session);
      channel.onmessage = event => {
        if (!isDisplayRelayMessage(event.data) || event.data.targetId !== target.id) return;
        const current = this.sessions.get(target.id);
        if (!current) return;
        if (event.data.type === "hello") {
          if (current.status.state !== "live") {
            current.status = { ...current.status, state: relayStateFromAck(current.status.lastAckAt), lastError: undefined };
            this.changed();
          }
          return;
        }
        if (event.data.type === "ack") {
          const now = Date.now();
          current.status = {
            ...current.status,
            state: "live",
            framesAcked: current.status.framesAcked + 1,
            lastAckAt: now,
            latencyMs: Math.max(0, now - event.data.sentAt),
            lastError: undefined
          };
          this.changed();
        }
      };
    } else {
      session.target = target;
      session.status = { ...session.status, state: "opening", lastError: undefined };
    }
    this.changed();

    try {
      const label = labelFor(target.id);
      const existing = await WebviewWindow.getByLabel(label);
      const windowScale = Math.min(1, 1600 / target.width, 900 / target.height);
      const outputWindow = existing ?? new WebviewWindow(label, {
        url: `/?output=display&target=${encodeURIComponent(target.id)}&width=${target.width}&height=${target.height}`,
        title: `LumaStage · ${target.name}`,
        width: Math.max(320, Math.round(target.width * windowScale)),
        height: Math.max(240, Math.round(target.height * windowScale)),
        minWidth: 480,
        minHeight: 270,
        resizable: true,
        decorations: false,
        fullscreen: false
      });

      session.window = outputWindow;
      if (!existing) {
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            error ? reject(error) : resolve();
          };
          outputWindow.once("tauri://created", () => finish());
          outputWindow.once("tauri://error", event => finish(event.payload));
        });
      } else {
        await outputWindow.show();
      }

      outputWindow.once("tauri://destroyed", () => this.drop(target.id));
      session.status = { ...session.status, state: "waiting", lastError: undefined };
      this.changed();
      this.startRelay();
      return session.status;
    } catch (error) {
      throw this.fail(target, error instanceof Error ? error.message : String(error));
    }
  }

  async close(targetId: string) {
    const session = this.sessions.get(targetId);
    if (!session) return;
    try {
      await session.window?.close();
    } finally {
      this.drop(targetId);
    }
  }

  async setFullscreen(targetId: string, enabled: boolean) {
    const session = this.sessions.get(targetId);
    if (!session?.window) throw new Error("Open this display output before changing fullscreen mode.");
    await session.window.setFullscreen(enabled);
    session.status = { ...session.status, fullscreen: enabled };
    this.changed();
  }

  private fail(target: DisplayTargetDefinition, message: string) {
    const current = this.sessions.get(target.id);
    if (current) {
      current.status = { ...current.status, state: "error", lastError: message };
    } else {
      const channel = new BroadcastChannel(displayChannelName(target.id));
      this.sessions.set(target.id, {
        target,
        channel,
        status: { ...initialStatus(target.id), state: "error", lastError: message }
      });
    }
    this.changed();
    return new Error(message);
  }

  private drop(targetId: string) {
    const session = this.sessions.get(targetId);
    if (!session) return;
    session.channel.close();
    this.sessions.delete(targetId);
    this.changed();
    if (this.sessions.size === 0 && this.relayTimer !== undefined) {
      window.clearInterval(this.relayTimer);
      this.relayTimer = undefined;
    }
  }

  private startRelay() {
    if (this.relayTimer !== undefined) return;
    this.relayTimer = window.setInterval(() => this.relayFrame(), RELAY_INTERVAL_MS);
  }

  private relayFrame() {
    const canvas = this.source?.();
    if (!canvas || this.encoding || this.sessions.size === 0 || canvas.width < 2 || canvas.height < 2) return;

    const now = Date.now();
    let changed = false;
    for (const session of this.sessions.values()) {
      if (session.status.state === "live" && relayStateFromAck(session.status.lastAckAt, now) !== "live") {
        session.status = { ...session.status, state: "waiting" };
        changed = true;
      }
    }
    if (changed) this.changed();

    this.encoding = true;
    canvas.toBlob(blob => {
      this.encoding = false;
      if (!blob) return;
      const sentAt = Date.now();
      const sequence = ++this.sequence;
      for (const session of this.sessions.values()) {
        if (session.status.state === "error" || session.status.state === "closed") continue;
        session.channel.postMessage({
          type: "frame",
          targetId: session.target.id,
          sequence,
          sentAt,
          blob,
          sourceWidth: canvas.width,
          sourceHeight: canvas.height
        });
        session.status = { ...session.status, framesSent: session.status.framesSent + 1 };
      }
      this.changed();
    }, "image/jpeg", 0.9);
  }

  private changed() {
    engineHealth.update({
      outputsActive: [...this.sessions.values()].filter(session => session.status.state === "live").length
    });
    this.listeners.forEach(listener => listener());
  }
}

export const displayOutputManager = new DisplayOutputManager();
