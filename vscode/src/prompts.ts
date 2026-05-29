export interface PromptContext {
    lang: string;
    originalCode: string;
    instruction: string;
    highlightedCode?: string;
    cursorLine?: number;
    cursorCol?: number;
}

/**
 * Prompt A: SEARCH/REPLACE block format (Aider-style).
 * Verbatim per spec — do not alter.
 */
export function buildPromptA(ctx: PromptContext): string {
    const { lang, originalCode, instruction, highlightedCode, cursorLine, cursorCol } = ctx;

    let prompt =
`You are an expert programmer making a targeted edit to the user's code.

The current file (${lang}):
\`\`\`${lang}
${originalCode}
\`\`\`

The user instruction is:
${instruction}
(Note: the instruction may be written in Turkish.)
`;

    if (highlightedCode) {
        prompt +=
`
The user highlighted this section as the likely edit target:
\`\`\`${lang}
${highlightedCode}
\`\`\`
`;
    }

    if (cursorLine !== undefined && cursorCol !== undefined) {
        prompt += `The user cursor is at line ${cursorLine}, column ${cursorCol}.\n`;
    }

    prompt +=
`
Output ONLY one or more SEARCH/REPLACE blocks in EXACTLY this format,
with no other text:

<<<<<<< SEARCH
[exact existing code, character for character, including whitespace]
=======
[the replacement code]
>>>>>>> REPLACE

Rules:
- Each SEARCH block must match the existing file EXACTLY, including
  indentation and trailing whitespace. No paraphrasing.
- Keep SEARCH blocks small — only the lines that change plus minimal
  surrounding context needed for uniqueness.
- Emit multiple blocks if multiple non-contiguous regions need editing.
- For a pure insertion, use an empty SEARCH block with the new content
  in REPLACE, preceded by an existing anchor line in SEARCH so we can
  locate the insertion point.`;

    return prompt;
}

/**
 * Prompt B: Whole-file rewrite.
 * Verbatim port of EDIT-Bench Appendix D (Figure 13 / Figure 15) — do not alter.
 */
export function buildPromptB(ctx: PromptContext): string {
    const { lang, originalCode, instruction, highlightedCode } = ctx;

    if (highlightedCode) {
        // Figure 13: with highlight
        return (
`Generate a new implementation of the following code based on the user instruction:

The Original code (to be modified):
\`\`\`${lang}
${originalCode}
\`\`\`

The user instruction is:
${instruction}

And they highlighted this section to be changed:
\`\`\`${lang}
${highlightedCode}
\`\`\`

Please only change the highlighted section and leave the rest of the code unchanged.
Please output the entire code file.
Respond only in a code block beginning with \`\`\`${lang}.`
        );
    } else {
        // Figure 15: without highlight
        return (
`Generate a new implementation of the following code based on the user instruction:

The Original code (to be modified):
\`\`\`${lang}
${originalCode}
\`\`\`

The user instruction is:
${instruction}

Please output the entire code file.
Respond only in a code block beginning with \`\`\`${lang}.`
        );
    }
}
