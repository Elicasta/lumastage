import { describe, expect, it } from "vitest";
import { displayChannelName, fitRect, isDisplayRelayMessage, relayStateFromAck } from "./displayProtocol";

describe("display relay protocol", () => {
  it("letterboxes a 16:9 program into portrait output without cropping", () => {
    expect(fitRect(1920, 1080, 1080, 1920)).toEqual({ x: 0, y: 656.25, width: 1080, height: 607.5 });
  });

  it("treats only fresh receiver acknowledgements as live", () => {
    expect(relayStateFromAck(10_000, 11_000)).toBe("live");
    expect(relayStateFromAck(10_000, 11_501)).toBe("waiting");
    expect(relayStateFromAck(null, 11_000)).toBe("waiting");
  });

  it("uses a target-scoped versioned channel", () => {
    expect(displayChannelName("output-0")).toBe("lumastage.display.output-0.v1");
  });

  it("rejects malformed acknowledgements", () => {
    expect(isDisplayRelayMessage({ type: "ack", targetId: "output-0", sequence: 2, sentAt: 10, receivedAt: 20 })).toBe(true);
    expect(isDisplayRelayMessage({ type: "ack", targetId: "output-0", sequence: -1, sentAt: 10, receivedAt: 20 })).toBe(false);
  });
});
