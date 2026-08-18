import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { NotifyKind } from './protocol.ts';
import type { NotifyStore } from './store.ts';
export interface RouteDeps {
    store: NotifyStore;
    /** Send one notification; used by the test route. */
    notify: (kind: NotifyKind, body: string) => void;
}
/** Build the plugin's route family. */
export declare function buildRoutes(deps: RouteDeps): WebRoute[];
