import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const CSS_VIRTUAL_PREFIX = '\0dsh-shortcuts-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Browser module identities supplied by the DSH Web shell's module table. */
export const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
] as const

const SKIP_WORKSPACE_BUILD: UserConfig = { entry: '' }

type BuildFace = 'host' | 'client' | undefined

type BuildFaceConfig = (input: Pick<UserConfig, 'env'>) => UserConfig[]

/**
 * Build both Node and browser entries for this standalone DSH Client plugin.
 * @param id - package id stamped into the loader wrapper and CSS tags.
 * @param libEntry - emitted Node-half JavaScript entries.
 * @returns an env-selected tsdown workspace config.
 */
export function clientBundle(id: string, libEntry: readonly string[]): BuildFaceConfig {
  const library = libraryConfig(id, libEntry)
  return ({ env }) => {
    const face = buildFace(env?.DSH_BUILD_FACE)
    const browser = browserConfig(id, face === 'client'
      ? 'lib/types/client/index.js'
      : 'src/client/index.ts')
    if (face === 'host') return [SKIP_WORKSPACE_BUILD]
    if (face === 'client') return [browser]
    return [library, browser]
  }
}

function buildFace(value: unknown): BuildFace {
  if (value === undefined || value === 'host' || value === 'client') return value
  throw new Error(`tsdown: DSH_BUILD_FACE must be host or client, received ${String(value)}`)
}

function libraryConfig(id: string, entry: readonly string[]): UserConfig {
  return {
    name: id,
    entry: [...entry],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  }
}

function browserConfig(id: string, entry: string): UserConfig {
  return {
    name: `${id}/client`,
    entry: { client: entry },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    deps: {
      neverBundle: (specifier: string) => CLIENT_EXTERNALS.includes(
        specifier as typeof CLIENT_EXTERNALS[number],
      ),
      alwaysBundle: (specifier: string) => !CLIENT_EXTERNALS.includes(
        specifier as typeof CLIENT_EXTERNALS[number],
      ),
    },
    plugins: [purityPlugin(), cssModulePlugin(id)],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

function purityPlugin() {
  return {
    name: 'dsh-client-shortcuts-bundle-purity',
    resolveId(specifier: string) {
      if (!specifier.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(specifier as typeof CLIENT_EXTERNALS[number])) return null
      throw new Error(
        `client bundle purity: ${JSON.stringify(specifier)} is not a DSH platform module; `
        + 'use a type-only import or a declared service instead',
      )
    },
  }
}

function cssModulePlugin(packageId: string) {
  return {
    name: 'dsh-client-shortcuts-css-modules',
    resolveId(specifier: string, importer?: string) {
      if (!specifier.endsWith('.module.css') || importer === undefined) return null
      return CSS_VIRTUAL_PREFIX + sourceAssetPath(specifier, importer) + CSS_VIRTUAL_SUFFIX
    },
    async load(this: { addWatchFile: (file: string) => void }, virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const file = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(file)
      const source = await readFile(file)
      const result = transform({
        filename: file,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exported] of Object.entries(result.exports ?? {})) {
        classMap[local] = exported.name
      }
      const tagId = `${packageId}/${basename(file)}`
      return [
        `const css = ${JSON.stringify(result.code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
        "  const tag = document.createElement('style');",
        `  tag.dataset.plugin = ${JSON.stringify(packageId)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }
}

function sourceAssetPath(specifier: string, importer: string): string {
  const emitted = resolve(dirname(importer), specifier)
  if (existsSync(emitted)) return emitted
  const marker = `${resolve('/')}/lib/types/`
  const markerIndex = emitted.indexOf(marker)
  if (markerIndex < 0) return emitted
  return resolve(emitted.slice(0, markerIndex), 'src', emitted.slice(markerIndex + marker.length))
}
