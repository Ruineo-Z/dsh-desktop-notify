/**
 * Shared wire contract between the host half and the browser half.
 * This file is imported by both src/index.ts (node) and src/client/* (browser),
 * so it must stay dependency-free.
 */

/** Base path of the plugin's HTTP route family. */
export const API = '/api/dsh-desktop-notify'

/** Persisted plugin configuration. */
export interface NotifyConfig {
  /** Master switch: whether desktop notifications are sent at all. */
  enabled: boolean
  /** Stored sound file name (inside the sounds dir), or null when none. */
  soundFile: string | null
  /** Human-friendly name of the uploaded sound (for display), or null. */
  soundFileName: string | null
}

/** HTTP route paths. */
export const ROUTES = {
  config: `${API}/config`,
  sound: `${API}/sound`,
  test: `${API}/test`,
} as const

/** Notification event kinds. */
export type NotifyKind = 'start' | 'complete' | 'error' | 'interrupt' | 'ask'
