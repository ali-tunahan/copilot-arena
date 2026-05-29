import * as vscode from "vscode";

let statusBarItem: vscode.StatusBarItem | undefined;
let statusBarFalseTimeout: NodeJS.Timeout | undefined;

export function stopStatusBarLoading() {
    statusBarFalseTimeout = setTimeout(() => {
        setupStatusBar(undefined, false);
    }, 100);
}

export function setupStatusBar(
    _enabled?: boolean,  // unused; kept so api.ts call sites compile unchanged
    loading?: boolean,
) {
    if (loading !== false) {
        clearTimeout(statusBarFalseTimeout);
        statusBarFalseTimeout = undefined;
    }

    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    }

    statusBarItem.text = loading
        ? '$(loading~spin) Yanıt oluşturuluyor...'
        : '$(edit) Kod Düzenleyici';
    statusBarItem.tooltip = 'Kod Düzenleyici — Ctrl+I / Cmd+I ile düzenleme başlat';
    statusBarItem.command = 'myext.showOptions';
    statusBarItem.show();
}
