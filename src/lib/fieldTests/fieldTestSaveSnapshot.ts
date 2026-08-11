/**
 * Field test autosave reads React state from blur handlers; without a ref merge,
 * the first edit after load can persist stale DB values. Generation counters ensure
 * stale save responses cannot clear newer local edits.
 */
export function mergeFieldTestValuesForSave(
  stateValues: Record<string, string | number>,
  latestValues: Record<string, string | number>
): Record<string, string | number> {
  return { ...stateValues, ...latestValues };
}

export function incrementFieldTestDirtyGeneration(
  generations: Map<string, number>,
  key: string
): number {
  const next = (generations.get(key) ?? 0) + 1;
  generations.set(key, next);
  return next;
}

export function snapshotFieldTestDirtyGenerations(
  keys: ReadonlySet<string> | readonly string[],
  generations: ReadonlyMap<string, number>
): Map<string, number> {
  const snapshot = new Map<string, number>();
  for (const key of keys) {
    snapshot.set(key, generations.get(key) ?? 0);
  }
  return snapshot;
}

export function clearSavedFieldTestDirtyKeys(
  dirtyCellKeys: Set<string>,
  dirtyNoteProfileIds: Set<string>,
  savedCellKeys: ReadonlySet<string>,
  savedNoteProfileIds: readonly string[]
): void {
  for (const key of savedCellKeys) {
    dirtyCellKeys.delete(key);
  }
  for (const profileId of savedNoteProfileIds) {
    dirtyNoteProfileIds.delete(profileId);
  }
}

export function clearSavedFieldTestDirtyKeysIfUnchanged(
  dirtyCellKeys: Set<string>,
  dirtyNoteProfileIds: Set<string>,
  savedCellKeys: ReadonlySet<string>,
  savedNoteProfileIds: readonly string[],
  cellGenerationsAtSave: ReadonlyMap<string, number>,
  noteGenerationsAtSave: ReadonlyMap<string, number>,
  currentCellGenerations: ReadonlyMap<string, number>,
  currentNoteGenerations: ReadonlyMap<string, number>
): void {
  for (const key of savedCellKeys) {
    if (cellGenerationsAtSave.get(key) === currentCellGenerations.get(key)) {
      dirtyCellKeys.delete(key);
    }
  }
  for (const profileId of savedNoteProfileIds) {
    if (noteGenerationsAtSave.get(profileId) === currentNoteGenerations.get(profileId)) {
      dirtyNoteProfileIds.delete(profileId);
    }
  }
}

export type FieldTestOfflineQueuedBatch = {
  queueItemId: string;
  cellKeys: ReadonlySet<string>;
  noteProfileIds: readonly string[];
  cellGenerationsAtQueue: ReadonlyMap<string, number>;
  noteGenerationsAtQueue: ReadonlyMap<string, number>;
};

/** Queue item removed after successful replay → apply generation-aware dirty cleanup. */
export function reconcileFieldTestOfflineQueueCompletion(
  queuedBatches: FieldTestOfflineQueuedBatch[],
  activeQueueItemIds: ReadonlySet<string>,
  dirtyCellKeys: Set<string>,
  dirtyNoteProfileIds: Set<string>,
  currentCellGenerations: ReadonlyMap<string, number>,
  currentNoteGenerations: ReadonlyMap<string, number>
): FieldTestOfflineQueuedBatch[] {
  const remaining: FieldTestOfflineQueuedBatch[] = [];

  for (const batch of queuedBatches) {
    if (activeQueueItemIds.has(batch.queueItemId)) {
      remaining.push(batch);
      continue;
    }

    clearSavedFieldTestDirtyKeysIfUnchanged(
      dirtyCellKeys,
      dirtyNoteProfileIds,
      batch.cellKeys,
      batch.noteProfileIds,
      batch.cellGenerationsAtQueue,
      batch.noteGenerationsAtQueue,
      currentCellGenerations,
      currentNoteGenerations
    );
  }

  return remaining;
}
