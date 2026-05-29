import * as vscode from "vscode";
import * as path from 'path';

/**
 * Manages the side-by-side diff session.
 *
 * Uses vscode.diff (native diff editor) so tab titles can be set explicitly in Turkish.
 * No streaming, no telemetry, no inline decorations — just two diff editors and accept/reject.
 */
export class VerticalPerLineDiffManager {
    private originalFilepath: string | undefined;
    private tempDir: string | undefined;
    private aAvailable = false;
    private bAvailable = false;
    private hintDisposable: vscode.Disposable | undefined;

    /**
     * Open two side-by-side diff editors:
     *   Left  (ViewColumn.One):  "A: Birleştirilmiş Fark"  — appliedA vs original
     *   Right (ViewColumn.Two):  "B: Tüm Dosya"           — appliedB vs original
     *
     * Pass undefined for a side to skip it (that side's accept key will show a warning).
     */
    async streamSideBySideDiff(
        originalUri: vscode.Uri,
        _range: vscode.Range,       // kept for call-site compatibility; unused
        appliedA: string | undefined,
        appliedB: string | undefined,
    ): Promise<void> {
        this.aAvailable = appliedA !== undefined;
        this.bAvailable = appliedB !== undefined;
        this.originalFilepath = originalUri.fsPath;

        const tempDir = path.join(path.dirname(originalUri.fsPath), '.arena_temp');
        this.tempDir = tempDir;
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(tempDir));

        const tempFileA = vscode.Uri.file(path.join(tempDir, 'A_Diff.txt'));
        const tempFileB = vscode.Uri.file(path.join(tempDir, 'B_WholeFile.txt'));

        if (appliedA !== undefined) {
            await vscode.workspace.fs.writeFile(tempFileA, Buffer.from(appliedA, 'utf8'));
        }
        if (appliedB !== undefined) {
            await vscode.workspace.fs.writeFile(tempFileB, Buffer.from(appliedB, 'utf8'));
        }

        if (appliedA !== undefined) {
            await vscode.commands.executeCommand(
                'vscode.diff',
                originalUri,
                tempFileA,
                'A: Birleştirilmiş Fark',
                { viewColumn: vscode.ViewColumn.One, preview: false }
            );
        }

        if (appliedB !== undefined) {
            await vscode.commands.executeCommand(
                'vscode.diff',
                originalUri,
                tempFileB,
                'B: Tüm Dosya',
                { viewColumn: appliedA !== undefined ? vscode.ViewColumn.Two : vscode.ViewColumn.One, preview: false }
            );
        }

        // Persistent hint banner in the status bar while the diff is open.
        const mod = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
        this.hintDisposable = vscode.window.setStatusBarMessage(
            `${mod}+1: A'yı kabul et  •  ${mod}+2: B'yi kabul et  •  ${mod}+3: ikisini de reddet`
        );
    }

    async acceptLLMResponse(responseNumber: 1 | 2): Promise<void> {
        if (responseNumber === 1 && !this.aAvailable) {
            vscode.window.showWarningMessage('A uygulanamadı: fark uygulanamadı');
            return;
        }
        if (responseNumber === 2 && !this.bAvailable) {
            vscode.window.showWarningMessage('Model isteği başarısız oldu');
            return;
        }
        if (!this.originalFilepath || !this.tempDir) { return; }

        const filename = responseNumber === 1 ? 'A_Diff.txt' : 'B_WholeFile.txt';
        const tempFilePath = path.join(this.tempDir, filename);

        await this.copyFileContent(tempFilePath, this.originalFilepath);
        await this.cleanup();
        await this.openFile(this.originalFilepath);
    }

    async rejectAllResponses(): Promise<void> {
        const originalFilepath = this.originalFilepath;
        await this.cleanup();
        if (originalFilepath) {
            await this.openFile(originalFilepath);
        }
    }

    private async copyFileContent(sourceFilepath: string, targetFilepath: string): Promise<void> {
        const sourceContent = await vscode.workspace.fs.readFile(vscode.Uri.file(sourceFilepath));
        const targetDocument = await vscode.workspace.openTextDocument(targetFilepath);

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            targetDocument.positionAt(0),
            targetDocument.positionAt(targetDocument.getText().length)
        );
        edit.replace(targetDocument.uri, fullRange, sourceContent.toString());
        await vscode.workspace.applyEdit(edit);
        await targetDocument.save();
    }

    private async cleanup(): Promise<void> {
        this.hintDisposable?.dispose();
        this.hintDisposable = undefined;

        // Close any diff editor tabs that reference our temp files.
        const tabsToClose = vscode.window.tabGroups.all
            .flatMap(g => g.tabs)
            .filter(tab => {
                if (tab.input instanceof vscode.TabInputTextDiff) {
                    const modifiedPath = tab.input.modified.fsPath;
                    return modifiedPath.includes('.arena_temp');
                }
                return false;
            });

        if (tabsToClose.length > 0) {
            await vscode.window.tabGroups.close(tabsToClose, true);
        }

        if (this.tempDir) {
            try {
                await vscode.workspace.fs.delete(vscode.Uri.file(this.tempDir), { recursive: true });
            } catch {
                // Already deleted or never created — fine.
            }
            this.tempDir = undefined;
        }

        this.originalFilepath = undefined;
        this.aAvailable = false;
        this.bAvailable = false;
    }

    private async openFile(filepath: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument(filepath);
        await vscode.window.showTextDocument(document, { preview: false });
    }
}
