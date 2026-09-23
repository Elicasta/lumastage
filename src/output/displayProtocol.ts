export type DisplayRelayState = "closed" | "opening" | "waiting" | "live" | "error";

export interface DisplayTargetDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
}

export interface DisplayRelayStatus {
  targetId: string;
  state: DisplayRelayState;
  framesSent: number;
  framesAcked: number;
  latencyMs: number | null;
  lastAckAt: number | null;
  lastError?: string;
  fullscreen: boolean;
}

export type DisplayRelayMessage =
  | { type: "hello"; targetId: string; at: number }
  | { type: "frame"; targetId: string; sequence: number; sentAt: number; blob: Blob; sourceWidth: number; sourceHeight: number }
  | { type: "ack"; targetId: string; sequence: number; sentAt: number; receivedAt: number };

export function displayChannelName(targetId: string) {
  return `lumastage.display.${targetId}.v1`;
}

export function fitRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(value => Number.isFinite(value) && value > 0)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

export function shouldAcceptDisplayAck(
  ack: Extract<DisplayRelayMessage, { type: "ack" }>,
  lastAckSequence: number,
  lastSentSequence: number,
  now = Date.now()
) {
  if (ack.sequence <= lastAckSequence || ack.sequence > lastSentSequence) return false;
  if (ack.sentAt > ack.receivedAt) return false;
  if (ack.receivedAt > now + 250) return false;
  return Math.max(0, now - ack.receivedAt) <= 1500;
}

export function relayStateFromAck(lastAckAt: number | null, now = Date.now()): Exclude<DisplayRelayState, "closed" | "opening" | "error"> {
  return lastAckAt !== null && Math.max(0, now - lastAckAt) <= 1500 ? "live" : "waiting";
}

export function isDisplayRelayMessage(value: unknown): value is DisplayRelayMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<DisplayRelayMessage>;
  if (typeof message.type !== "string" || typeof message.targetId !== "string" || !message.targetId) return false;
  if (message.type === "hello") return typeof message.at === "number" && Number.isFinite(message.at);
  if (message.type === "ack") {
    return Number.isSafeInteger(message.sequence) && (message.sequence as number) >= 0 && typeof message.sentAt === "number" && Number.isFinite(message.sentAt)
      && typeof message.receivedAt === "number" && Number.isFinite(message.receivedAt);
  }
  if (message.type === "frame") {
    return Number.isSafeInteger(message.sequence) && (message.sequence as number) >= 0 && typeof message.sentAt === "number" && Number.isFinite(message.sentAt)
      && message.blob instanceof Blob && typeof message.sourceWidth === "number" && message.sourceWidth > 0
      && typeof message.sourceHeight === "number" && message.sourceHeight > 0;
  }
  return false;
}
