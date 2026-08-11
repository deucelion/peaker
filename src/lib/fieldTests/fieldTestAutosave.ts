export function hasFieldTestPendingSave(
  dirtyCellKeys: ReadonlySet<string>,
  dirtyNoteProfileIds: ReadonlySet<string>
): boolean {
  return dirtyCellKeys.size > 0 || dirtyNoteProfileIds.size > 0;
}

export function canStartFieldTestSaveNow(params: {
  saveInFlight: boolean;
  saveLoading: boolean;
}): boolean {
  return !params.saveInFlight && !params.saveLoading;
}

/** Blur during an in-flight save should defer flush, not drop pending work. */
export function shouldDeferFieldTestAutosave(params: {
  saveInFlight: boolean;
  dirtyCellKeys: ReadonlySet<string>;
  dirtyNoteProfileIds: ReadonlySet<string>;
}): boolean {
  return params.saveInFlight && hasFieldTestPendingSave(params.dirtyCellKeys, params.dirtyNoteProfileIds);
}

export function shouldFlushFieldTestAfterSave(params: {
  pendingFlushRequested: boolean;
  dirtyCellKeys: ReadonlySet<string>;
  dirtyNoteProfileIds: ReadonlySet<string>;
}): boolean {
  return params.pendingFlushRequested || hasFieldTestPendingSave(params.dirtyCellKeys, params.dirtyNoteProfileIds);
}

export type FieldTestSaveFeedback =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "queued"
  | "error";

/** Do not hydrate from DB while local unsynced edits may exist. */
export function shouldPreserveLocalFieldTestValuesOnFetch(
  saveFeedback: FieldTestSaveFeedback
): boolean {
  return (
    saveFeedback === "dirty" ||
    saveFeedback === "saving" ||
    saveFeedback === "queued" ||
    saveFeedback === "error"
  );
}

export function shouldSkipFieldTestAutosave(params: {
  saveInFlight: boolean;
  saveLoading: boolean;
  dirtyCellKeys: ReadonlySet<string>;
  dirtyNoteProfileIds: ReadonlySet<string>;
}): boolean {
  if (params.saveLoading) return true;
  if (!hasFieldTestPendingSave(params.dirtyCellKeys, params.dirtyNoteProfileIds)) return true;
  if (params.saveInFlight) return true;
  return false;
}
