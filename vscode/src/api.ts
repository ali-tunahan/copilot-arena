import * as vscode from 'vscode';
import { setupStatusBar, stopStatusBarLoading } from './statusBar';

interface ChatCompletionResponse {
    choices: Array<{
        message: { content: string };
    }>;
}

/**
 * Fires a single chat completion request to the configured OpenAI-compatible endpoint.
 * API key is read from SecretStorage (set via the "MyExt: API Anahtarını Ayarla" command).
 * Throws on HTTP errors, timeouts, or missing API key.
 */
export async function chatCompletion(
    prompt: { system?: string; user: string },
    context: vscode.ExtensionContext,
    signal?: AbortSignal
): Promise<string> {
    const config = vscode.workspace.getConfiguration('myext');
    const apiBaseUrl = config.get<string>('apiBaseUrl', 'https://api.openai.com/v1');
    const model = config.get<string>('model', 'gpt-4o-mini');
    const timeoutMs = config.get<number>('requestTimeoutMs', 60000);

    const apiKey = await context.secrets.get('myext.apiKey');
    if (!apiKey) {
        throw new Error('API key not set. Run "MyExt: API Anahtarını Ayarla" command.');
    }

    const messages: Array<{ role: string; content: string }> = prompt.system
        ? [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }]
        : [{ role: 'user', content: prompt.user }];

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    // Forward outer cancellation to our controller.
    let outerListener: (() => void) | undefined;
    if (signal) {
        outerListener = () => timeoutController.abort();
        signal.addEventListener('abort', outerListener, { once: true });
    }

    try {
        setupStatusBar(undefined, true);
        const response = await fetch(`${apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0,
            }),
            signal: timeoutController.signal,
        });

        if (!response.ok) {
            throw new Error(`API request failed: HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as ChatCompletionResponse;
        return data.choices[0].message.content;
    } finally {
        clearTimeout(timeoutId);
        if (signal && outerListener) {
            signal.removeEventListener('abort', outerListener);
        }
        stopStatusBarLoading();
    }
}
