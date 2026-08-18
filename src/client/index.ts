/**
 * Browser-half entry for dsh-desktop-notify — runs inside the dsh web GUI.
 *
 * Registers the "桌面通知" settings page (settings.section slot) that lets
 * the user toggle notifications and upload a custom sound. Failure policy:
 * registration problems are logged, never thrown — an external plugin must
 * not take the GUI down.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the slots Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.section` SlotMap declaration.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { NotifySettings } from './NotifySettings.tsx'

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots']

/** Register the settings section once the `settings.section` declaration is on the ledger. */
export function apply(ctx: ClientContext): void {
  try {
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'desktop-notify',
      order: 80,
      label: () => '桌面通知',
      inject: () => ({}),
    }, NotifySettings))
  } catch (error) {
    console.warn('[dsh-desktop-notify] 设置页注册失败:', error)
  }
}
