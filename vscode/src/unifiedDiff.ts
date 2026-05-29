// src/unifiedDiff.ts
//
// Faithful port of the training/eval-time applier (unified_diff.py) so that the
// Patch Apply Rate measured during evaluation matches exactly what the extension
// applies in the editor. Do NOT "improve" the matching (e.g. fuzzy/whitespace-
// tolerant matching) unless you make the identical change in unified_diff.py —
// any divergence breaks eval<->runtime parity.

export class UnifiedDiffError extends Error {}

const DIFF_FENCE_OPEN = "```diff";
const DIFF_FENCE_CLOSE = "```";
const HUNK_HEADER_RE = /^@@.*?@@\s*$/;

/** Emulate Python's str.splitlines(keepends=False): split on \r\n|\r|\n and
 *  drop the single trailing empty segment a final line-break would create. */
function splitlines(s: string): string[] {
    if (s === "") { return []; }
    const parts = s.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === "") { parts.pop(); }
    return parts;
}

/** Extract the first ```diff ... ``` block. Falls back to a bare unified diff
 *  (first line starting with "--- " or "@@"). Returns null if none found. */
export function extractDiff(modelOutput: string): string | null {
    const open = modelOutput.indexOf(DIFF_FENCE_OPEN);
    if (open !== -1) {
        const rest = modelOutput.slice(open + DIFF_FENCE_OPEN.length);
        const close = rest.indexOf(DIFF_FENCE_CLOSE);
        if (close !== -1) {
            // mirror Python .strip("\n")
            return rest.slice(0, close).replace(/^\n+/, "").replace(/\n+$/, "");
        }
    }
    const lines = splitlines(modelOutput);
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("--- ") || lines[i].startsWith("@@")) {
            return lines.slice(i).join("\n");
        }
    }
    return null;
}

function splitHunks(diff: string): string[][] {
    const hunks: string[][] = [];
    let current: string[] = [];
    let inHunk = false;
    for (const line of splitlines(diff)) {
        if (line.startsWith("--- ") || line.startsWith("+++ ")) { continue; }
        if (HUNK_HEADER_RE.test(line) || line.startsWith("@@")) {
            if (current.length) { hunks.push(current); }
            current = [];
            inHunk = true;
            continue;
        }
        if (inHunk) { current.push(line); }
    }
    if (current.length) { hunks.push(current); }
    return hunks;
}

/** Split a hunk into oldBlock (context + deletions) and newBlock (context + additions). */
function hunkParts(hunk: string[]): { oldBlock: string[]; newBlock: string[] } {
    const oldBlock: string[] = [];
    const newBlock: string[] = [];
    for (const line of hunk) {
        if (line.length === 0) {
            oldBlock.push("");
            newBlock.push("");
            continue;
        }
        const tag = line[0];
        const body = line.slice(1);
        if (tag === " ") {
            oldBlock.push(body);
            newBlock.push(body);
        } else if (tag === "-") {
            oldBlock.push(body);
        } else if (tag === "+") {
            newBlock.push(body);
        } else {
            // defensively treat unprefixed lines as context (matches Python)
            oldBlock.push(line);
            newBlock.push(line);
        }
    }
    return { oldBlock, newBlock };
}

/** First match at/after `start`; if none, wrap around and search [0, start). */
function locate(haystack: string[], needle: string[], start: number): number | null {
    if (needle.length === 0) { return start; }
    const n = needle.length;
    const eq = (i: number): boolean => needle.every((x, k) => haystack[i + k] === x);
    for (let i = start; i <= haystack.length - n; i++) {
        if (eq(i)) { return i; }
    }
    for (let i = 0; i < start; i++) {
        if (i <= haystack.length - n && eq(i)) { return i; }
    }
    return null;
}

/** Apply a line-number-stripped unified diff to `source`.
 *  Throws UnifiedDiffError if there are no hunks or any hunk fails to match
 *  (these are exactly the cases that count as a Patch Apply failure in eval). */
export function applyUnifiedDiff(source: string, diff: string): string {
    const outLines = splitlines(source);
    const hunks = splitHunks(diff);
    if (hunks.length === 0) { throw new UnifiedDiffError("no hunks in diff"); }

    let cursor = 0;
    for (const hunk of hunks) {
        const { oldBlock, newBlock } = hunkParts(hunk);
        const idx = locate(outLines, oldBlock, cursor);
        if (idx === null) { throw new UnifiedDiffError("hunk did not match source"); }
        outLines.splice(idx, oldBlock.length, ...newBlock);
        cursor = idx + newBlock.length;
    }

    let patched = outLines.join("\n");
    if (source.endsWith("\n") && !patched.endsWith("\n")) { patched += "\n"; }
    return patched;
}
