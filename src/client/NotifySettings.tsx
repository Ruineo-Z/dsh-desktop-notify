/**
 * "桌面通知" settings page: master switch, custom sound upload / preview /
 * removal, and a test notification button.
 */
import { useEffect, useState } from 'react'
import type { NotifyConfig } from '../protocol.ts'
import { ROUTES } from '../protocol.ts'

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px 0',
  borderBottom: '1px solid rgba(127,127,127,0.18)',
}

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
}

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  opacity: 0.65,
  marginTop: '4px',
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: '6px',
  border: '1px solid rgba(127,127,127,0.35)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '13px',
}

const primaryButton: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(80,140,255,0.15)',
  borderColor: 'rgba(80,140,255,0.45)',
}

const messageStyle: React.CSSProperties = {
  marginTop: '10px',
  fontSize: '13px',
  color: 'rgba(60,160,90,1)',
}

const errorStyle: React.CSSProperties = {
  marginTop: '10px',
  fontSize: '13px',
  color: 'rgba(220,80,80,1)',
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as { error?: string }
      detail = body.error ?? ''
    } catch {
      // non-JSON error body
    }
    throw new Error(`请求失败 (${response.status})${detail ? `：${detail}` : ''}`)
  }
  return (await response.json()) as T
}

export function NotifySettings(): React.JSX.Element {
  const [config, setConfig] = useState<NotifyConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('') // bump to reload <audio> src

  const load = async (): Promise<void> => {
    try {
      const value = await readJson<NotifyConfig>(await fetch(ROUTES.config))
      setConfig(value)
      setPreview(`${ROUTES.sound}?t=${Date.now()}`)
    } catch (err) {
      setError(String(err))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const toggleEnabled = async (): Promise<void> => {
    if (!config) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fetch(ROUTES.config, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: !config.enabled }),
      })
      await load()
      setMessage(config.enabled ? '通知已关闭' : '通知已开启')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const uploadSound = async (file: File): Promise<void> => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fetch(ROUTES.sound, {
        method: 'POST',
        headers: { 'content-type': file.type || 'audio/mpeg' },
        body: file,
      })
      await load()
      setMessage(`已上传提示音：${file.name}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const removeSound = async (): Promise<void> => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fetch(ROUTES.sound, { method: 'DELETE' })
      await load()
      setMessage('已移除自定义提示音')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async (): Promise<void> => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fetch(ROUTES.test, { method: 'POST' })
      setMessage('测试通知已发送，请查看屏幕右上角')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={hintStyle}>
        Agent 执行完成 / 失败 / 中断或需要你批准时，发送 macOS 桌面通知。可上传自定义提示音（通知时自动播放）。
      </p>

      <div style={row}>
        <div>
          <div style={labelStyle}>启用桌面通知</div>
          <div style={hintStyle}>总开关，关闭后所有事件都不再弹通知</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config?.enabled ?? true}
          onClick={() => void toggleEnabled()}
          disabled={busy || !config}
          style={{
            ...buttonStyle,
            minWidth: 96,
            background: config?.enabled ? 'rgba(80,140,255,0.18)' : undefined,
          }}
        >
          {config?.enabled ? '已开启' : '已关闭'}
        </button>
      </div>

      <div style={row}>
        <div>
          <div style={labelStyle}>自定义提示音</div>
          <div style={hintStyle}>
            {config?.soundFileName
              ? `当前：${config.soundFileName}`
              : '未设置（使用系统默认提示音）'}
          </div>
          {config?.soundFileName && (
            <audio controls src={preview} style={{ marginTop: 8, maxWidth: 320, height: 32 }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ ...buttonStyle, display: 'inline-block' }}>
            选择音频文件
            <input
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadSound(file)
                event.target.value = ''
              }}
            />
          </label>
          {config?.soundFileName && (
            <button type="button" style={buttonStyle} disabled={busy} onClick={() => void removeSound()}>
              移除
            </button>
          )}
        </div>
      </div>

      <div style={row}>
        <div>
          <div style={labelStyle}>测试通知</div>
          <div style={hintStyle}>立即发送一条测试通知，确认效果</div>
        </div>
        <button type="button" style={primaryButton} disabled={busy} onClick={() => void sendTest()}>
          发送测试
        </button>
      </div>

      {message && <div style={messageStyle}>{message}</div>}
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  )
}
