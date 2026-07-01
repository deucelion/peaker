export function hasFieldTestPendingSave(
  dirtyCellKeys: ReadonlySet<string>,
  dirtyNoteProfileIds: ReadonlySet<string>
): boolean {
  return dirtyCellKeys.size > 0 || dirtyNoteProfileIds.size > 0;
}

export function shouldSkipFieldTestAutosave(params: {
  saveInFlight: boolean;
  saveLoading: boolean;
  dirtyCellKeys: ReadonlySet<string>;
  dirtyNoteProfileIds: ReadonlySet<string>;
}): boolean {
  if (params.saveInFlight || params.saveLoading) return true;
  return !hasFieldTestPendingSave(params.dirtyCellKeys, params.dirtyNoteProfileIds);
}
