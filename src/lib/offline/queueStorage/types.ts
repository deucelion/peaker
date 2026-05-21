import type { OfflineQueuedAction } from "@/lib/offline/types";

export interface OfflineQueueStorage {
  readonly name: "localStorage" | "indexedDB";
  readAll(): Promise<OfflineQueuedAction[]>;
  writeAll(items: OfflineQueuedAction[]): Promise<void>;
  clear(): Promise<void>;
}
