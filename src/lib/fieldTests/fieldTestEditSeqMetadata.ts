/** Persisted per-cell edit generation (no migration — stored in value_text metadata). */

export const FIELD_TEST_EDIT_SEQ_PREFIX = "__peaker_edit_seq:";

const TEXT_EDIT_SEQ_SUFFIX = `\n${FIELD_TEST_EDIT_SEQ_PREFIX}`;

export function encodeNumericCellEditSeqMetadata(editSeq: number): string {
  return `${FIELD_TEST_EDIT_SEQ_PREFIX}${editSeq}`;
}

export function encodeTextCellWithEditSeq(userText: string, editSeq: number): string {
  const trimmed = userText.trim();
  if (!trimmed) return encodeNumericCellEditSeqMetadata(editSeq);
  return `${trimmed}${TEXT_EDIT_SEQ_SUFFIX}${editSeq}`;
}

export function parseStoredFieldTestEditSeq(valueText: string | null | undefined): {
  displayText: string | null;
  editSeq: number;
} {
  if (valueText == null || valueText === "") {
    return { displayText: null, editSeq: 0 };
  }

  const suffixIdx = valueText.lastIndexOf(TEXT_EDIT_SEQ_SUFFIX);
  if (suffixIdx >= 0) {
    const seqPart = valueText.slice(suffixIdx + TEXT_EDIT_SEQ_SUFFIX.length);
    const parsed = Number.parseInt(seqPart, 10);
    return {
      displayText: valueText.slice(0, suffixIdx) || null,
      editSeq: Number.isFinite(parsed) ? parsed : 0,
    };
  }

  if (valueText.startsWith(FIELD_TEST_EDIT_SEQ_PREFIX)) {
    const parsed = Number.parseInt(valueText.slice(FIELD_TEST_EDIT_SEQ_PREFIX.length), 10);
    return {
      displayText: null,
      editSeq: Number.isFinite(parsed) ? parsed : 0,
    };
  }

  return { displayText: valueText, editSeq: 0 };
}

export function shouldSkipStaleFieldTestCellWrite(params: {
  incomingEditSeq: number;
  storedEditSeq: number;
}): boolean {
  if (params.incomingEditSeq <= 0) return false;
  if (params.storedEditSeq <= 0) return false;
  return params.incomingEditSeq <= params.storedEditSeq;
}
