import { describe, expect, it } from "vitest";
import { displayChannelName, fitRect, isCurrentDisplayAck, isDisplayRelayMessage, relayStateFromAck, shouldAcceptDisplayAck } from "./displayProtocol";

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
  it("accepts only ACKs for frames sent by the current display session", () => {
    expect(isCurrentDisplayAck(42, 40, 45, 41)).toBe(true);
    expect(isCurrentDisplayAck(39, 40, 45, -1)).toBe(false);
    expect(isCurrentDisplayAck(46, 40, 45, 41)).toBe(false);
    expect(isCurrentDisplayAck(41, 40, 45, 41)).toBe(false);
  });

  it("accepts only fresh acknowledgements for frames sent by this session", () => {
    const now = 10_000;
    expect(shouldAcceptDisplayAck(
      { type: "ack", targetId: "output-0", sequence: 8, sentAt: 9_900, receivedAt: 9_950 },
      7,
      8,
      now
    )).toBe(true);
    expect(shouldAcceptDisplayAck(
      { type: "ack", targetId: "output-0", sequence: 7, sentAt: 9_800, receivedAt: 9_900 },
      7,
      8,
      now
    )).toBe(false);
    expect(shouldAcceptDisplayAck(
      { type: "ack", targetId: "output-0", sequence: 9, sentAt: 9_900, receivedAt: 9_950 },
      7,
      8,
      now
    )).toBe(false);
    expect(shouldAcceptDisplayAck(
      { type: "ack", targetId: "output-0", sequence: 8, sentAt: 7_000, receivedAt: 7_100 },
      7,
      8,
      now
    )).toBe(false);
  });
});
