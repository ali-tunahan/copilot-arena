const DEBUG_MODE = false;

export function debugLog(...args: unknown[]): void {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}
