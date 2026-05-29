import * as vscode from 'vscode';
import { setupStatusBar } from './statusBar';
import { PromptToDiffHandler } from './promptToDiff';
import { VerticalPerLineDiffManager } from './diff/verticalPerLine/manager';

export function activate(context: vscode.ExtensionContext) {
    setupStatusBar();

    const diffManager = new VerticalPerLineDiffManager();
    const handler = new PromptToDiffHandler(diffManager, context);

    context.subscriptions.push(
        vscode.commands.registerCommand('myext.promptToDiff', () => {
            handler.handlePrompt();
        }),

        vscode.commands.registerCommand('myext.acceptFirstLLMResponse', async () => {
            await diffManager.acceptLLMResponse(1);
        }),

        vscode.commands.registerCommand('myext.acceptSecondLLMResponse', async () => {
            await diffManager.acceptLLMResponse(2);
        }),

        vscode.commands.registerCommand('myext.rejectAllResponses', () => {
            diffManager.rejectAllResponses();
        }),

        vscode.commands.registerCommand('myext.setApiKey', async () => {
            const key = await vscode.window.showInputBox({
                prompt: 'OpenAI uyumlu API anahtarınızı girin',
                password: true,
                placeHolder: 'sk-...',
            });
            if (key !== undefined && key.trim() !== '') {
                await context.secrets.store('myext.apiKey', key.trim());
                vscode.window.showInformationMessage('API anahtarı kaydedildi.');
            }
        }),

        vscode.commands.registerCommand('myext.showOptions', () => {
            const options = ['API Anahtarını Ayarla', 'Hata Bildir'];
            vscode.window.showQuickPick(options).then(selection => {
                if (selection === 'API Anahtarını Ayarla') {
                    vscode.commands.executeCommand('myext.setApiKey');
                } else if (selection === 'Hata Bildir') {
                    vscode.env.openExternal(
                        vscode.Uri.parse('https://github.com/lmarena/copilot-arena/issues/new')
                    );
                }
            });
        })
    );
}

export function deactivate() {}
