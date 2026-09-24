import { useEffect, useRef } from "react";
import { displayChannelName, fitRect, isDisplayRelayMessage } from "./output/displayProtocol";

function numberParam(params: URLSearchParams, key: string, fallback: number) {
  const value = Number(params.get(key));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export function DisplayOutputView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("target") || "output-0";
    const width = numberParam(params, "width", 1920);
    const height = numberParam(params, "height", 1080);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);

    const channel = new BroadcastChannel(displayChannelName(targetId));
    let lastRenderedSequence = -1;
    let lastFrameAt = 0;
    let disposed = false;

    const hello = () => channel.postMessage({ type: "hello", targetId, at: Date.now() });
    hello();
    const helloTimer = window.setInterval(hello, 1000);
    const staleTimer = window.setInterval(() => {
      if (!lastFrameAt || Date.now() - lastFrameAt <= 1500) return;
      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);
      lastFrameAt = 0;
    }, 250);

    channel.onmessage = async event => {
      const message = event.data;
      if (!isDisplayRelayMessage(message) || message.type !== "frame" || message.targetId !== targetId) return;
      try {
        const bitmap = await createImageBitmap(message.blob);
        if (disposed || message.sequence <= lastRenderedSequence) {
          bitmap.close();
          return;
        }
        const rect = fitRect(bitmap.width, bitmap.height, width, height);
        context.fillStyle = "#000";
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height);
        bitmap.close();
        lastRenderedSequence = message.sequence;
        lastFrameAt = Date.now();
        channel.postMessage({
          type: "ack",
          targetId,
          sequence: message.sequence,
          sentAt: message.sentAt,
          receivedAt: lastFrameAt
        });
      } catch {
        context.fillStyle = "#000";
        context.fillRect(0, 0, width, height);
      }
    };

    return () => {
      disposed = true;
      window.clearInterval(helloTimer);
      window.clearInterval(staleTimer);
      channel.close();
    };
  }, []);

  const params = new URLSearchParams(window.location.search);
  const width = numberParam(params, "width", 1920);
  const height = numberParam(params, "height", 1080);
  const ratio = width / height;
  return <main className="display-output-root"><canvas ref={canvasRef} aria-label="LumaStage external display output" style={{ width: `min(100vw, calc(100vh * ${ratio}))`, height: `min(100vh, calc(100vw / ${ratio}))` }} /></main>;
}
