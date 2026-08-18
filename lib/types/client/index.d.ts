/**
 * Browser-half entry for dsh-desktop-notify — runs inside the dsh web GUI.
 *
 * Registers the "桌面通知" settings page (settings.section slot) that lets
 * the user toggle notifications and upload a custom sound. Failure policy:
 * registration problems are logged, never thrown — an external plugin must
 * not take the GUI down.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services (fiber inject waiting — the runtime must be up first). */
export declare const inject: string[];
/** Register the settings section once the `settings.section` declaration is on the ledger. */
export declare function apply(ctx: ClientContext): void;
