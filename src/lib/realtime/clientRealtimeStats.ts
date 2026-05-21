/**
 * FAZ 20 — Session-local realtime diagnostics (browser).
 * No PII; safe for ops troubleshooting panel in-session.
 */

export type ClientRealtimeCounters = {
  notificationFetch: number;
  notificationRealtimeEvent: number;
  notificationFetchThrottled: number;
  financeInvalidate: number;
  financeRealtimeEvent: number;
  financeCrossTab: number;
  attendanceRealtimeEvent: number;
  presenceSync: number;
  duplicateListenersPrevented: number;
  reconnectNoted: number;
  failedSubscription: number;
  channelSubscribed: number;
  hiddenTabPause: number;
};

const empty: ClientRealtimeCounters = {
  notificationFetch: 0,
  notificationRealtimeEvent: 0,
  notificationFetchThrottled: 0,
  financeInvalidate: 0,
  financeRealtimeEvent: 0,
  financeCrossTab: 0,
  attendanceRealtimeEvent: 0,
  presenceSync: 0,
  duplicateListenersPrevented: 0,
  reconnectNoted: 0,
  failedSubscription: 0,
  channelSubscribed: 0,
  hiddenTabPause: 0,
};

const RECONNECT_STORM_THRESHOLD = 12;
const RECONNECT_STORM_WINDOW_MS = 2 * 60_000;
let reconnectTimestamps: number[] = [];

let counters: ClientRealtimeCounters = { ...empty };

export function resetClientRealtimeStats(): void {
  counters = { ...empty };
  reconnectTimestamps = [];
}

export function bumpClientRealtimeStat<K extends keyof ClientRealtimeCounters>(key: K, by = 1): void {
  counters[key] += by;
  if (key === "reconnectNoted" || key === "failedSubscription") {
    const now = Date.now();
    reconnectTimestamps.push(now);
    reconnectTimestamps = reconnectTimestamps.filter((t) => now - t < RECONNECT_STORM_WINDOW_MS);
  }
}

export function isRealtimeReconnectStorm(): boolean {
  return reconnectTimestamps.length >= RECONNECT_STORM_THRESHOLD;
}

export function getRealtimeHealthSummary(): {
  reconnectStorm: boolean;
  reconnectCountWindow: number;
  counters: ClientRealtimeCounters;
} {
  return {
    reconnectStorm: isRealtimeReconnectStorm(),
    reconnectCountWindow: reconnectTimestamps.length,
    counters: getClientRealtimeStatsSnapshot(),
  };
}

export function getClientRealtimeStatsSnapshot(): ClientRealtimeCounters {
  return { ...counters };
}
