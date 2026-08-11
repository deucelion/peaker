import { describe, expect, it } from "vitest";
import {
  encodeNumericCellEditSeqMetadata,
  encodeTextCellWithEditSeq,
  parseStoredFieldTestEditSeq,
  shouldSkipStaleFieldTestCellWrite,
} from "./fieldTestEditSeqMetadata";

describe("fieldTestEditSeqMetadata", () => {
  it("round-trips numeric metadata", () => {
    const encoded = encodeNumericCellEditSeqMetadata(5);
    expect(parseStoredFieldTestEditSeq(encoded)).toEqual({ displayText: null, editSeq: 5 });
  });

  it("round-trips text metadata suffix", () => {
    const encoded = encodeTextCellWithEditSeq("hello", 3);
    expect(parseStoredFieldTestEditSeq(encoded)).toEqual({ displayText: "hello", editSeq: 3 });
  });

  it("skips stale writes when incoming seq is older", () => {
    expect(shouldSkipStaleFieldTestCellWrite({ incomingEditSeq: 1, storedEditSeq: 2 })).toBe(true);
    expect(shouldSkipStaleFieldTestCellWrite({ incomingEditSeq: 2, storedEditSeq: 2 })).toBe(true);
    expect(shouldSkipStaleFieldTestCellWrite({ incomingEditSeq: 3, storedEditSeq: 2 })).toBe(false);
  });
});
