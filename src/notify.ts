/**
 * Desktop notification engine.
 *
 * macOS notifications themselves only support system sound names, so a
 * custom uploaded audio file is played alongside via `afplay` (the system
 * notification stays silent when a custom sound is configured).
 */
import { spawn } from 'node:child_process'
import type { NotifyKind } from './protocol.ts'

/** Titles per notification kind (emoji + label). */
export const KIND_TITLES: Record<NotifyKind, string> = {
  start: '▶️ DSH 开始执行',
  complete: '✅ DSH 执行完成',
  error: '❌ DSH 执行失败',
  interrupt: '⏹️ DSH 执行中断',
  ask: '🙋 DSH 需要你决策',
}

/** AppleScript string escaping. */
export function appleEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

export interface NotifyOptions {
  title: string
  body: string
  /** Play the system "Glass" sound when no custom sound is configured. */
  systemSound: boolean
  /** Absolute path of a custom audio file to play, or null. */
  customSoundPath: string | null
}

/** Show one macOS notification (+ optional custom audio via afplay). */
export function showNotification(options: NotifyOptions, warn?: (message: string) => void): void {
  const { title, body, systemSound, customSoundPath } = options
  // System sound only when no custom audio is set (avoid double sound).
  const soundClause = systemSound && !customSoundPath ? ' sound name "Glass"' : ''
  const script = `display notification "${appleEscape(body)}" with title "${appleEscape(title)}"${soundClause}`
  const child = spawn('osascript', ['-e', script], { stdio: 'ignore' })
  child.on('error', (error) => {
    warn?.(`osascript 启动失败: ${String(error)}`)
  })
  if (customSoundPath) {
    const player = spawn('afplay', [customSoundPath], { stdio: 'ignore' })
    player.on('error', (error) => {
      warn?.(`afplay 播放失败: ${String(error)}`)
    })
  }
}
