import * as vscode from 'vscode';
import { VerticalPerLineDiffManager } from './diff/verticalPerLine/manager';
import { chatCompletion } from './api';
import { buildPromptA, buildPromptB, PromptContext } from './prompts';
import { parseSearchReplace, applySearchReplace, SearchReplaceError } from './searchReplace';

export class PromptToDiffHandler {
    constructor(
        private readonly diffManager: VerticalPerLineDiffManager,
        private readonly context: vscode.ExtensionContext
    ) {}

    public async handlePrompt(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const instruction = await vscode.window.showInputBox({
            placeHolder: 'Talimatınızı yazın...',
        });
        if (!instruction) { return; }

        const document = editor.document;
        const selection = editor.selection;
        const lang = document.languageId;
        const originalCode = document.getText();
        const highlightedCode = selection.isEmpty ? undefined : document.getText(selection);

        const ctx: PromptContext = {
            lang,
            originalCode,
            instruction,
            highlightedCode,
            cursorLine: editor.selection.active.line + 1,
            cursorCol: editor.selection.active.character + 1,
        };

        const controller = new AbortController();

        const [responseA, responseB] = await Promise.all([
            chatCompletion(buildPromptA(ctx), this.context, controller.signal)
                .catch((e: unknown) => {
                    console.error('Prompt A request failed:', e);
                    return null;
                }),
            chatCompletion(buildPromptB(ctx), this.context, controller.signal)
                .catch((e: unknown) => {
                    console.error('Prompt B request failed:', e);
                    return null;
                }),
        ]);

        if (!responseA && !responseB) {
            vscode.window.showErrorMessage('Model isteği başarısız oldu');
            return;
        }

        // --- Process A: parse SEARCH/REPLACE and apply to original file ---
        let appliedA: string | undefined;
        if (responseA) {
            try {
                const blocks = parseSearchReplace(responseA);
                appliedA = applySearchReplace(originalCode, blocks);
            } catch (e) {
                if (e instanceof SearchReplaceError) {
                    vscode.window.showWarningMessage('A uygulanamadı: arama bloğu eşleşmedi');
                } else {
                    console.error('Unexpected error applying SEARCH/REPLACE:', e);
                    vscode.window.showWarningMessage('A uygulanamadı: arama bloğu eşleşmedi');
                }
                // appliedA remains undefined; Cmd+1 will be disabled for this round.
            }
        } else {
            vscode.window.showWarningMessage('Model isteği başarısız oldu');
        }

        // --- Process B: extract whole-file code block ---
        let appliedB: string | undefined;
        if (responseB) {
            appliedB = extractCodeBlock(responseB, lang) ?? responseB;
        } else {
            vscode.window.showWarningMessage('Model isteği başarısız oldu');
        }

        if (!appliedA && !appliedB) { return; }

        const fullRange = new vscode.Range(
            0, 0,
            document.lineCount - 1,
            document.lineAt(document.lineCount - 1).text.length
        );

        try {
            await this.diffManager.streamSideBySideDiff(
                document.uri,
                fullRange,
                appliedA,
                appliedB,
            );
        } catch (error) {
            console.error('Error opening diff view:', error);
            vscode.window.showErrorMessage('Model isteği başarısız oldu');
        }
    }
}

/** Extract the content of the first fenced code block from a model response. */
function extractCodeBlock(response: string, lang: string): string | undefined {
    // Try language-specific fence first (```python, ```typescript, etc.)
    const specificFence = new RegExp(
        '```' + escapeRegex(lang) + '\\r?\\n([\\s\\S]*?)\\r?\\n?```',
        'i'
    );
    const specificMatch = response.match(specificFence);
    if (specificMatch) { return specificMatch[1]; }

    // Fallback: any fenced code block
    const anyFence = /```[\w]*\r?\n([\s\S]*?)\r?\n?```/;
    const anyMatch = response.match(anyFence);
    if (anyMatch) { return anyMatch[1]; }

    return undefined;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
