import type { NotifyConfig } from './protocol.ts';
/** Persist plugin config to ~/.dsh/dsh-desktop-notify/config.json. */
export declare class NotifyStore {
    private value;
    constructor();
    get(): NotifyConfig;
    update(patch: Partial<NotifyConfig>): NotifyConfig;
    /** Absolute path of the uploaded sound file, or null when absent. */
    soundPath(): string | null;
    soundsDir(): string;
    private persist;
}
