export interface SearchReplaceBlock {
    search: string;
    replace: string;
}

export class SearchReplaceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SearchReplaceError';
    }
}

const SEARCH_MARKER = '<<<<<<< SEARCH';
const DIVIDER_MARKER = '=======';
const REPLACE_MARKER = '>>>>>>> REPLACE';

/**
 * Parse one or more SEARCH/REPLACE blocks from model output.
 * Tolerates leading/trailing prose; rejects malformed or missing blocks.
 */
export function parseSearchReplace(text: string): SearchReplaceBlock[] {
    const blocks: SearchReplaceBlock[] = [];
    let pos = 0;

    while (pos < text.length) {
        const searchStart = text.indexOf(SEARCH_MARKER, pos);
        if (searchStart === -1) { break; }

        const afterSearch = searchStart + SEARCH_MARKER.length;
        const dividerStart = text.indexOf(DIVIDER_MARKER, afterSearch);
        if (dividerStart === -1) {
            throw new SearchReplaceError('Missing ======= divider in SEARCH/REPLACE block');
        }

        const afterDivider = dividerStart + DIVIDER_MARKER.length;
        const replaceEnd = text.indexOf(REPLACE_MARKER, afterDivider);
        if (replaceEnd === -1) {
            throw new SearchReplaceError('Missing >>>>>>> REPLACE marker in SEARCH/REPLACE block');
        }

        // Strip exactly one leading and one trailing newline from each section.
        const search = stripOuterNewline(text.slice(afterSearch, dividerStart));
        const replace = stripOuterNewline(text.slice(afterDivider, replaceEnd));

        blocks.push({ search, replace });
        pos = replaceEnd + REPLACE_MARKER.length;
    }

    if (blocks.length === 0) {
        throw new SearchReplaceError('No SEARCH/REPLACE blocks found in model output');
    }

    return blocks;
}

/**
 * Apply all SEARCH/REPLACE blocks to fileContent in order.
 * Each SEARCH string must appear exactly once; throws SearchReplaceError otherwise.
 */
export function applySearchReplace(fileContent: string, blocks: SearchReplaceBlock[]): string {
    let content = fileContent;

    for (let i = 0; i < blocks.length; i++) {
        const { search, replace } = blocks[i];

        if (search === '') {
            // Pure insertion is not supported without an anchor line.
            // The model is instructed to include an anchor; treat empty SEARCH as error.
            throw new SearchReplaceError(`Block ${i + 1}: SEARCH section is empty`);
        }

        const count = countOccurrences(content, search);
        if (count === 0) {
            throw new SearchReplaceError(
                `Block ${i + 1}: SEARCH text not found in file (first 60 chars: "${search.slice(0, 60).replace(/\n/g, '↵')}")`
            );
        }
        if (count > 1) {
            throw new SearchReplaceError(
                `Block ${i + 1}: SEARCH text matches ${count} locations — must be unique`
            );
        }

        // Safe replacement: avoid String.replace() dollar-sign special handling.
        const idx = content.indexOf(search);
        content = content.slice(0, idx) + replace + content.slice(idx + search.length);
    }

    return content;
}

function stripOuterNewline(s: string): string {
    if (s.startsWith('\n')) { s = s.slice(1); }
    if (s.endsWith('\n')) { s = s.slice(0, -1); }
    return s;
}

function countOccurrences(text: string, search: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(search, pos)) !== -1) {
        count++;
        pos += search.length;
    }
    return count;
}
