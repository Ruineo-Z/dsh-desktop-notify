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
import type { Context } from '@deepseek-ai/cordis'
import { KIND_TITLES, showNotification } from './notify.ts'
import type { NotifyKind } from './protocol.ts'
import { buildRoutes } from './routes.ts'
import { NotifyStore } from './store.ts'

/**
 * DSH host events have no upstream type declarations (they are emitted by the
 * fused dispatcher at runtime); declare them here so `ctx.on` type-checks.
 */
declare module '@deepseek-ai/cordis' {
  interface Events {
    'session/event'(session: { id: unknown }, event: { type: string; data?: Record<string, unknown> }): void
    'agent/status'(payload: { status: string; agent?: { session?: { id: unknown } } }): void
  }
}

export const name = 'desktop-notify'

/** Static event switches (plugin config, patch layer). */
const DEFAULT_SWITCHES = {
  onStart: false, // 开始执行时通知
  onComplete: true, // 执行完成时通知
  onError: true, // 执行失败时通知
  onInterrupt: true, // 执行中断时通知
  onAsk: true, // 需要用户批准时通知
  systemSound: true, // 无自定义音频时是否带系统提示音
  cooldownMs: 3000, // 同一会话同一类事件的最小通知间隔（防抖）
}

function switchKey(kind: NotifyKind): keyof typeof DEFAULT_SWITCHES {
  return `on${kind[0]!.toUpperCase()}${kind.slice(1)}` as keyof typeof DEFAULT_SWITCHES
}

function shortId(id: unknown): string {
  if (!id) return '会话'
  const text = String(id)
  return text.length > 10 ? text.slice(0, 8) : text
}

export function apply(ctx: Context, rawConfig: Record<string, unknown> = {}): void {
  const config = { ...DEFAULT_SWITCHES, ...rawConfig }
  const cooldownMs = Number(config.cooldownMs)
  const store = new NotifyStore()

  /** Debounce table: `${sessionId}:${kind}` → last notification timestamp. */
  const recent = new Map<string, number>()

  const warn = (message: string): void => {
    ctx.logger?.warn?.(`[desktop-notify] ${message}`)
  }

  const notify = (sessionId: unknown, kind: NotifyKind, body: string): void => {
    if (!store.get().enabled) return
    if (!config[switchKey(kind)]) return
    const key = `${sessionId}:${kind}`
    const now = Date.now()
    const last = recent.get(key)
    if (last !== undefined && now - last < cooldownMs) return
    recent.set(key, now)
    showNotification({
      title: `${KIND_TITLES[kind]}（${shortId(sessionId)}）`,
      body,
      systemSound: config.systemSound,
      customSoundPath: store.soundPath(),
    }, warn)
  }

  // Session log events: turn ends + approval requests.
  ctx.on(
    'session/event',
    (session, event) => {
      try {
        if (event.type === 'turn/end') {
          const reason = event.data?.reason as { kind?: string; error?: { message?: string } } | undefined
          const kind = reason?.kind
          if (kind === 'completed') {
            notify(session.id, 'complete', 'Agent 已处理完当前任务')
          } else if (kind === 'error') {
            const message = reason?.error?.message ?? String(reason?.error ?? '未知错误')
            notify(session.id, 'error', message.slice(0, 120))
          } else if (kind === 'aborted') {
            notify(session.id, 'interrupt', '执行已被中断')
          }
        } else if (event.type === 'approval/asked') {
          const data = event.data ?? {}
          const tool = typeof data.toolName === 'string' ? data.toolName : '某个工具'
          const reason = typeof data.reason === 'string' ? `（${data.reason}）` : ''
          notify(session.id, 'ask', `${tool} 请求批准${reason}`)
        }
      } catch (error) {
        warn(`处理 session 事件失败: ${String(error)}`)
      }
    },
    { global: true },
  )

  // Agent status transitions: execution started (opt-in).
  ctx.on(
    'agent/status',
    (payload) => {
      try {
        if (payload.status === 'running') {
          notify(payload.agent?.session?.id ?? 'agent', 'start', 'Agent 开始执行任务')
        }
      } catch (error) {
        warn(`处理 agent 状态失败: ${String(error)}`)
      }
    },
    { global: true },
  )

  // HTTP routes (config + sound + test).
  ctx.effect(() => {
    const disposers = buildRoutes({
      store,
      notify: (kind, body) => notify('settings', kind, body),
    }).map((route) => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-desktop-notify: routes')
}
