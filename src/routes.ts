/**
 * The /api/dsh-desktop-notify route family: config read/write, sound upload
 * (raw body), sound playback (preview), sound removal, and a test
 * notification. Every route carries a loopback-only trust fence — these
 * endpoints write to the user's home directory, so LAN-exposed dsh web
 * deployments must not serve them.
 */
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { NotifyKind } from './protocol.ts'
import { ROUTES } from './protocol.ts'
import type { NotifyStore } from './store.ts'

/** Cap on uploaded audio bodies. */
const MAX_SOUND_BYTES = 10 * 1024 * 1024

/** Content-type → file extension for uploaded audio. */
const SOUND_EXT_BY_TYPE: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
}

/** Extension → content-type for serving the stored sound. */
const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

function isLoopbackRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress?.toLowerCase() ?? ''
  const loopback = address === '::1'
    || address.startsWith('::ffff:127.')
    || address.startsWith('127.')
  if (loopback) return true
  // Browser same-origin markers (the GUI proxies /api through the same host).
  const secFetch = req.headers['sec-fetch-site']
  return secFetch === 'same-origin' || secFetch === 'same-site'
}

async function readRawBody(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > limit) return null
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

export interface RouteDeps {
  store: NotifyStore
  /** Send one notification; used by the test route. */
  notify: (kind: NotifyKind, body: string) => void
}

/** Build the plugin's route family. */
export function buildRoutes(deps: RouteDeps): WebRoute[] {
  const { store, notify } = deps

  const sendConfig = (res: ServerResponse): void => {
    writeJson(res, 200, store.get())
  }

  return [
    {
      kind: 'exact',
      path: ROUTES.config,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return writeJson(res, 403, { error: 'loopback only' })
        if (req.method === 'GET') return sendConfig(res)
        if (req.method !== 'POST') return writeJson(res, 405, { error: 'method not allowed' })
        const body = await readRawBody(req, 64 * 1024)
        if (!body) return writeJson(res, 413, { error: 'body too large' })
        let patch: unknown
        try {
          patch = JSON.parse(body.toString('utf8'))
        } catch {
          return writeJson(res, 400, { error: 'invalid json' })
        }
        if (typeof patch !== 'object' || patch === null) return writeJson(res, 400, { error: 'invalid body' })
        const record = patch as Record<string, unknown>
        if (typeof record.enabled !== 'boolean') return writeJson(res, 400, { error: 'enabled must be boolean' })
        store.update({ enabled: record.enabled })
        return sendConfig(res)
      },
    },
    {
      kind: 'exact',
      path: ROUTES.sound,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return writeJson(res, 403, { error: 'loopback only' })
        if (req.method === 'GET') {
          const path = store.soundPath()
          if (!path || !existsSync(path)) return writeJson(res, 404, { error: 'no sound uploaded' })
          const ext = path.split('.').pop() ?? 'mp3'
          res.writeHead(200, {
            'content-type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
            'content-length': String(store.get().soundFile ?? 0) === '' ? undefined : undefined,
          })
          createReadStream(path).pipe(res)
          return
        }
        if (req.method === 'POST') {
          const body = await readRawBody(req, MAX_SOUND_BYTES)
          if (!body || body.length === 0) return writeJson(res, 413, { error: 'sound too large or empty' })
          const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
          const ext = SOUND_EXT_BY_TYPE[contentType] ?? 'mp3'
          mkdirSync(store.soundsDir(), { recursive: true })
          const fileName = `custom.${ext}`
          writeFileSync(join(store.soundsDir(), fileName), body)
          store.update({ soundFile: fileName, soundFileName: fileName })
          return sendConfig(res)
        }
        if (req.method === 'DELETE') {
          const path = store.soundPath()
          if (path && existsSync(path)) {
            try {
              unlinkSync(path)
            } catch {
              // Fall through; the config is cleared regardless.
            }
          }
          store.update({ soundFile: null, soundFileName: null })
          return sendConfig(res)
        }
        return writeJson(res, 405, { error: 'method not allowed' })
      },
    },
    {
      kind: 'exact',
      path: ROUTES.test,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return writeJson(res, 403, { error: 'loopback only' })
        if (req.method !== 'POST') return writeJson(res, 405, { error: 'method not allowed' })
        notify('complete', '这是一条测试通知，说明桌面通知已生效')
        return writeJson(res, 200, { ok: true })
      },
    },
  ]
}
