/**
 * Standalone build config for the dsh-desktop-notify plugin: node-half lib/
 * (host notification engine + routes) plus the browser bundle lib/client.js
 * (settings.section UI for the GUI's __ModuleLoader__).
 */
import { clientBundle } from './build/tsdown.client.ts'

export default clientBundle('dsh-desktop-notify', ['src/index.ts'])
