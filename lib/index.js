/**
 * dsh-desktop-notify
 *
 * DSH 桌面通知插件（宿主端，零外部依赖）：
 * 监听 agent 生命周期事件，在以下时刻通过 macOS 原生通知提醒用户，
 * 避免一直盯着 Web GUI：
 *
 *   - 执行完成（turn/end reason = completed）      → ✅ 默认开
 *   - 执行失败（turn/end reason = error）          → ❌ 默认开
 *   - 执行中断（turn/end reason = aborted）        → ⏹️ 默认开
 *   - 需要用户批准（approval/asked 日志事件）      → 🙋 默认开
 *   - 开始执行（agent/status = running）           → ▶️ 默认关
 *
 * 事件来源（DeepSeek Harness / Cordis）：
 *   - ctx.on('session/event', cb, { global: true })：每个会话日志事件追加时派发，
 *     事件对象形如 { type: 'turn/end', data: { turn, reason } } 或
 *     { type: 'approval/asked', data: { id, toolName, reason } }。
 *   - ctx.on('agent/status', cb)：agent 空闲/运行状态转换，
 *     payload 形如 { status: 'idle' | 'running', agent }。
 *
 * 通知实现：macOS `osascript display notification`，无需任何 npm 依赖。
 */

import { spawn } from 'node:child_process'

export const name = 'desktop-notify'

/** 默认配置（可通过 cordis.patch.yml 的 config 覆盖） */
const DEFAULTS = {
  onStart: false, // 开始执行时通知
  onComplete: true, // 执行完成时通知
  onError: true, // 执行失败时通知
  onInterrupt: true, // 执行中断时通知
  onAsk: true, // 需要用户批准时通知
  sound: true, // 是否带系统提示音（默认开）
  cooldownMs: 3000, // 同一会话同一类事件的最小通知间隔（防抖）
}

const KIND_SWITCH = {
  start: 'onStart',
  complete: 'onComplete',
  error: 'onError',
  interrupt: 'onInterrupt',
  ask: 'onAsk',
}

const TITLES = {
  start: '▶️ DSH 开始执行',
  complete: '✅ DSH 执行完成',
  error: '❌ DSH 执行失败',
  interrupt: '⏹️ DSH 执行中断',
  ask: '🙋 DSH 需要你决策',
}

/** 会话 id 可能很长，通知里只展示短 id 便于区分多个会话 */
function shortId(id) {
  if (!id) return '会话'
  const text = String(id)
  return text.length > 10 ? text.slice(0, 8) : text
}

/** AppleScript 字符串转义 */
function appleEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config }
  /** 防抖表：`${sessionId}:${kind}` → 上次通知时间戳 */
  const recent = new Map()

  const throttled = (session, kind) => {
    const key = `${session.id}:${kind}`
    const now = Date.now()
    const last = recent.get(key)
    if (last !== undefined && now - last < cfg.cooldownMs) return false
    recent.set(key, now)
    return true
  }

  const notify = (session, kind, body) => {
    if (!cfg[KIND_SWITCH[kind]]) return
    if (!throttled(session, kind)) return
    const title = `${TITLES[kind]}（${shortId(session.id)}）`
    const sound = cfg.sound ? ' sound name "Glass"' : ''
    const script = `display notification "${appleEscape(body)}" with title "${appleEscape(title)}"${sound}`
    const child = spawn('osascript', ['-e', script], { stdio: 'ignore' })
    child.on('error', (err) => {
      ctx.logger?.warn?.(`[desktop-notify] osascript 启动失败: ${String(err)}`)
    })
  }

  // 会话日志事件：turn 结束（完成/失败/中断）+ 批准请求（需要决策）
  ctx.on(
    'session/event',
    (session, event) => {
      try {
        if (event.type === 'turn/end') {
          const reason = event.data?.reason
          const kind = reason?.kind
          if (kind === 'completed') {
            notify(session, 'complete', 'Agent 已处理完当前任务')
          } else if (kind === 'error') {
            const message = reason?.error?.message ?? String(reason?.error ?? '未知错误')
            notify(session, 'error', message.slice(0, 120))
          } else if (kind === 'aborted') {
            notify(session, 'interrupt', '执行已被中断')
          }
        } else if (event.type === 'approval/asked') {
          const data = event.data ?? {}
          const tool = data.toolName ?? '某个工具'
          const reason = data.reason ? `（${data.reason}）` : ''
          notify(session, 'ask', `${tool} 请求批准${reason}`)
        }
      } catch (err) {
        ctx.logger?.warn?.(`[desktop-notify] 处理 session 事件失败: ${String(err)}`)
      }
    },
    { global: true },
  )

  // agent 状态转换：开始执行（可选，默认关闭）
  ctx.on(
    'agent/status',
    ({ status, agent }) => {
      try {
        if (status === 'running') {
          notify(agent.session, 'start', 'Agent 开始执行任务')
        }
      } catch (err) {
        ctx.logger?.warn?.(`[desktop-notify] 处理 agent 状态失败: ${String(err)}`)
      }
    },
    { global: true },
  )
}
