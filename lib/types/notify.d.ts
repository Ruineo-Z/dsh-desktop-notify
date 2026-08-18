import type { NotifyKind } from './protocol.ts';
/** Titles per notification kind (emoji + label). */
export declare const KIND_TITLES: Record<NotifyKind, string>;
/** AppleScript string escaping. */
export declare function appleEscape(value: unknown): string;
export interface NotifyOptions {
    title: string;
    body: string;
    /** Play the system "Glass" sound when no custom sound is configured. */
    systemSound: boolean;
    /** Absolute path of a custom audio file to play, or null. */
    customSoundPath: string | null;
}
/** Show one macOS notification (+ optional custom audio via afplay). */
export declare function showNotification(options: NotifyOptions, warn?: (message: string) => void): void;
