import type { OfflineQueueStorage } from "@/lib/offline/queueStorage/types";
import type { OfflineQueuedAction } from "@/lib/offline/types";
import { readOfflineQueue, writeOfflineQueue, clearOfflineStorage } from "@/lib/offline/storage";

export const localStorageQueueAdapter: OfflineQueueStorage = {
  name: "localStorage",
  async readAll() {
    return readOfflineQueue();
  },
  async writeAll(items: OfflineQueuedAction[]) {
    writeOfflineQueue(items);
  },
  async clear() {
    clearOfflineStorage();
  },
};
