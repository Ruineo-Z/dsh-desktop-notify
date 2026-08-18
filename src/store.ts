/**
 * Persistent store for the plugin's configuration and uploaded sound.
 * Data lives under ~/.dsh/dsh-desktop-notify/ (config.json + sounds/).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { NotifyConfig } from './protocol.ts'

const DIR = join(homedir(), '.dsh', 'dsh-desktop-notify')
const CONFIG_PATH = join(DIR, 'config.json')
const SOUNDS_DIR = join(DIR, 'sounds')

const DEFAULTS: NotifyConfig = {
  enabled: true,
  soundFile: null,
  soundFileName: null,
}

/** Persist plugin config to ~/.dsh/dsh-desktop-notify/config.json. */
export class NotifyStore {
  private value: NotifyConfig

  constructor() {
    mkdirSync(DIR, { recursive: true })
    mkdirSync(SOUNDS_DIR, { recursive: true })
    let parsed: Partial<NotifyConfig> = {}
    try {
      parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<NotifyConfig>
    } catch {
      // First run (or corrupted file): start from defaults.
    }
    this.value = { ...DEFAULTS, ...parsed }
  }

  get(): NotifyConfig {
    return { ...this.value }
  }

  update(patch: Partial<NotifyConfig>): NotifyConfig {
    this.value = { ...this.value, ...patch }
    this.persist()
    return this.get()
  }

  /** Absolute path of the uploaded sound file, or null when absent. */
  soundPath(): string | null {
    if (!this.value.soundFile) return null
    const path = join(SOUNDS_DIR, this.value.soundFile)
    return existsSync(path) ? path : null
  }

  soundsDir(): string {
    return SOUNDS_DIR
  }

  private persist(): void {
    try {
      writeFileSync(CONFIG_PATH, JSON.stringify(this.value, null, 2), 'utf8')
    } catch (error) {
      // Best-effort persistence; notifications still work for this process.
      console.warn('[dsh-desktop-notify] 配置写入失败:', error)
    }
  }
}
