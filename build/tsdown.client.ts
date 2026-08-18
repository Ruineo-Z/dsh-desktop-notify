/**
 * Standalone tsdown preset for dsh-desktop-notify (adapted from the
 * dsh-web-ui shared preset): emits the node-half lib/ (ESM host plugin) plus
 * the browser bundle lib/client.js (closure-factory artifact for the GUI's
 * __ModuleLoader__). CSS-modules handling is omitted — this plugin uses
 * inline styles only.
 */
import { existsSync } from 'node:fs'
import type { UserConfig } from 'tsdown'
import { PLATFORM_MODULES } from './web-platform.ts'

/**
 * Documented exemption: the snapshot-store engine lives in runtime pending
 * its promotion-time rehoming; at runtime the lazy CJS table answers the
 * require natively.
 */
const RUNTIME_STORE_EXEMPTION = '@deepseek-ai/dsh-client-runtime/client'

/** Externals resolved from the loader module table. */
export const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES, RUNTIME_STORE_EXEMPTION]

/** Wire/type layers a client bundle may inline (browser-safe contract surfaces). */
const INLINE_SAFE = /^@deepseek-ai\/dsh-(host-apiproxy|session|llm|tools|brand)(\/|$)/

/** Generated descriptor/codec contribution with no shared runtime identity. */
const GENERATED_REMOTE = /^@deepseek-ai\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*\/remote$/

/** Host-only plugins skip the browser face entirely. */
const SKIP_WORKSPACE_BUILD: UserConfig = { entry: '' }

type BuildFace = 'host' | 'client' | undefined

function buildFace(value: unknown): BuildFace {
  if (value === undefined || value === 'host' || value === 'client') return value
  throw new Error(`tsdown: --env.DSH_BUILD_FACE must be host or client, received ${String(value)}`)
}

/**
 * Build the tsdown config for one UI plugin package: the node-half lib build
 * plus the browser client bundle.
 * @param id - plugin id (package name), stamped into the __ModuleLoader__.load handoff.
 * @param libEntry - node-half entries.
 * @param options - extra node-side externals.
 */
export function clientBundle(
  id: string,
  libEntry: readonly string[],
  options: { libExternal?: readonly (string | RegExp)[] } = {},
): (inlineConfig: Pick<UserConfig, 'env'>) => UserConfig[] {
  const lib = clientLibraryConfig(id, libEntry, options.libExternal)
  return ({ env }) => {
    const face = buildFace(env?.DSH_BUILD_FACE)
    const hasClient = existsSync(new URL('../src/client/index.ts', import.meta.url))
    const client = hasClient ? clientConfig(id) : undefined
    if (face === 'host') return [lib]
    if (face === 'client') return client ? [client] : [SKIP_WORKSPACE_BUILD]
    return client ? [lib, client] : [lib]
  }
}

function clientLibraryConfig(
  id: string,
  libEntry: readonly string[],
  extraExternal: readonly (string | RegExp)[] = [],
): UserConfig {
  return {
    name: id,
    entry: [...libEntry],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    // The cordis framework resolves at runtime from the dsh profile tree.
    external: ['@deepseek-ai/cordis', ...extraExternal],
  }
}

function clientConfig(id: string): UserConfig {
  return {
    name: `${id}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    // Anything NOT in the loader module table must inline instead — a
    // require() the table cannot answer is a guaranteed runtime throw.
    noExternal: (source: string) => (CLIENT_EXTERNALS.includes(source) ? undefined : true),
    plugins: [{
      // Bundle purity gate: platform seed entries stay external, inline-safe
      // wire layers inline, and every other @deepseek-ai value import is a
      // build error (cross-plugin collaboration goes through cordis services).
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (CLIENT_EXTERNALS.includes(source)) return null
        if (INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source)) return null
        throw new Error(
          `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS), an inline-safe wire layer, or a generated /remote contribution — `
          + 'cross-plugin value imports are forbidden; collaborate through cordis services',
        )
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}
