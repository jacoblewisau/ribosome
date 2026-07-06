// @vitest-environment node
//
// This suite reads OPERATOR.md from disk via `import.meta.url`, which is a
// file: URL only under the node environment. The default happy-dom environment
// gives `import.meta.url` a non-file scheme and `fileURLToPath` would throw.

/**
 * Acceptance test for chain 0008.
 *
 * Spec: specs/0008.md
 *
 * Guards the OPERATOR.md command-table copy against re-drifting. The `/keep`
 * and `/forget` rows must carry the `<id>` argument that the coordinator
 * dispatch requires. Asserts the id form is present and the bare id-less form
 * is absent (matched on table-cell delimiters so the negative check does not
 * trip on the `` `/keep <id>` `` text, which contains the substring `/keep`).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const operatorMd = readFileSync(
  fileURLToPath(new URL("../../OPERATOR.md", import.meta.url)),
  "utf8",
);

describe("chain 0008 acceptance: OPERATOR.md /keep and /forget carry <id>", () => {
  it("shows the id form in the command table", () => {
    expect(operatorMd).toContain("`/keep <id>`");
    expect(operatorMd).toContain("`/forget <id>`");
  });

  it("no longer shows the bare id-less command-table cell", () => {
    expect(operatorMd).not.toContain("| `/keep` |");
    expect(operatorMd).not.toContain("| `/forget` |");
  });
});
