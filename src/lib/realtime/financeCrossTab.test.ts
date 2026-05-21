import { describe, expect, it, vi } from "vitest";
import { postFinanceTouch, subscribeFinanceTouches } from "./financeCrossTab";

describe("financeCrossTab", () => {
  it("posts and receives touch messages for same org", () => {
    const channels: Array<{ onmessage: ((ev: MessageEvent) => void) | null; close: () => void; postMessage: (m: unknown) => void }> = [];
    class MockBC {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      postMessage(m: unknown) {
        for (const c of channels) {
          c.onmessage?.(new MessageEvent("message", { data: m }));
        }
      }
      close() {}
      constructor() {
        channels.push(this);
      }
    }
    vi.stubGlobal("BroadcastChannel", MockBC as unknown as typeof BroadcastChannel);

    let received: string | null = null;
    const unsub = subscribeFinanceTouches((org) => {
      received = org;
    });
    postFinanceTouch("org-1", "test");
    expect(received).toBe("org-1");
    unsub();
    vi.unstubAllGlobals();
  });
});
