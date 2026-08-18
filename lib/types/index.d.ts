/**
 * dsh-desktop-notify host half.
 *
 * Listens to agent lifecycle events and raises macOS desktop notifications:
 *   - execution complete (turn/end reason = completed)
 *   - execution failure (turn/end reason = error)
 *   - execution interrupted (turn/end reason = aborted)
 *   - user approval needed (approval/asked)
 *   - execution started (agent/status = running, opt-in)
 *
 * The master switch (enabled) and the custom sound live in the persistent
 * store (~/.dsh/dsh-desktop-notify/), editable from the GUI settings page
 * (see src/client). Per-kind switches and the system sound are static plugin
 * config (cordis.patch.yml).
 */
import type { Context } from '@deepseek-ai/cordis';
/**
 * DSH host events have no upstream type declarations (they are emitted by the
 * fused dispatcher at runtime); declare them here so `ctx.on` type-checks.
 */
declare module '@deepseek-ai/cordis' {
    interface Events {
        'session/event'(session: {
            id: unknown;
        }, event: {
            type: string;
            data?: Record<string, unknown>;
        }): void;
        'agent/status'(payload: {
            status: string;
            agent?: {
                session?: {
                    id: unknown;
                };
            };
        }): void;
    }
}
export declare const name = "desktop-notify";
/** Host service required to register the settings and test routes. */
export declare const inject: string[];
export declare function apply(ctx: Context, rawConfig?: Record<string, unknown>): void;
