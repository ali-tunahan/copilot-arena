export interface PromptContext {
    lang: string;
    originalCode: string;
    instruction: string;
    highlightedCode?: string;
    cursorLine?: number;
    cursorCol?: number;
}

const SYSTEM_DIFF =
    "Sen, Türkçe doğal dil talimatlarına göre kod düzenlemesi yapan bir asistansın. Sadece istenen değişiklikleri içeren bir birleştirilmiş fark (unified diff) bloğu üret. Tüm dosyayı yeniden yazma. Çıktıyı ```diff ... ``` bloğu içinde ver.";

const SYSTEM_FULL =
    "Sen, Türkçe doğal dil talimatlarına göre kod düzenlemesi yapan bir asistansın. Talimatı uygulayarak kodun tamamını yeniden üret. Çıktıyı ```python ... ``` bloğu içinde ver.";

/**
 * Prompt A: unified-diff condition.
 * System prompt contains all format rules; user message contains only the data.
 */
export function buildPromptA(ctx: PromptContext): { system: string; user: string } {
    // TODO: confirm this user-message layout matches the fine-tuning user-message format.
    const { lang, originalCode, instruction, highlightedCode, cursorLine, cursorCol } = ctx;

    let user = `Talimat:\n${instruction}\n\nMevcut dosya (${lang}):\n\`\`\`${lang}\n${originalCode}\n\`\`\`\n`;

    if (highlightedCode) {
        user += `\nSeçili bölüm:\n\`\`\`${lang}\n${highlightedCode}\n\`\`\`\n`;
    }

    if (cursorLine !== undefined && cursorCol !== undefined) {
        user += `\nİmleç konumu: satır ${cursorLine}, sütun ${cursorCol}\n`;
    }

    return { system: SYSTEM_DIFF, user };
}

/**
 * Prompt B: whole-file rewrite condition.
 * System prompt contains all format rules; user message contains only the data.
 */
export function buildPromptB(ctx: PromptContext): { system: string; user: string } {
    // TODO: confirm this user-message layout matches the fine-tuning user-message format.
    const { lang, originalCode, instruction, highlightedCode, cursorLine, cursorCol } = ctx;

    let user = `Talimat:\n${instruction}\n\nMevcut dosya (${lang}):\n\`\`\`${lang}\n${originalCode}\n\`\`\`\n`;

    if (highlightedCode) {
        user += `\nSeçili bölüm:\n\`\`\`${lang}\n${highlightedCode}\n\`\`\`\n`;
    }

    if (cursorLine !== undefined && cursorCol !== undefined) {
        user += `\nİmleç konumu: satır ${cursorLine}, sütun ${cursorCol}\n`;
    }

    return { system: SYSTEM_FULL, user };
}
