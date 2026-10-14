import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

type Manifest = {
  name: string
  version: string
  main: string
  exports: Record<string, unknown>
  dsh: { client: { platform: string; inject: string[] }; bundle: { patch: string } }
  files: string[]
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  peerDependencies: Record<string, string>
}

/** The verified release this package builds and typechecks against. */
const DSH_RELEASE = '0.2.0-rc.1'
/**
 * Installed DSH releases the peer range accepts: the verified baseline and anything newer
 * below 1.0.0. DSH validates peers with `includePrerelease`, so a prerelease tuple written
 * into the range is what makes later prereleases of the next minor resolve.
 */
const DSH_PEER_RANGE = '>=0.2.0-rc.1 <1.0.0'

describe('package manifest', () => {
  const root = resolve(import.meta.dirname, '..')
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as Manifest
  const patch = YAML.parse(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8')) as Array<{
    insert?: Array<{ id?: string; name?: string }>
  }>

  it('publishes the DSH Client package and browser entry', () => {
    expect(manifest.name).toBe('@hytime/dsh-client-ui-shortcuts')
    expect(manifest.version).toBe('0.2.0')
    expect(manifest.main).toBe('lib/index.js')
    expect(manifest.exports).toEqual({
      '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
      './invariant': { types: './lib/types/invariant.d.ts', default: './lib/invariant.js' },
      './client': { types: './lib/types/client/index.d.ts', default: './lib/client.js' },
      './src/*': './src/*',
      './package.json': './package.json',
    })
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.inject).toEqual([
      '@deepseek-ai/dsh-api-session-controller',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-shortcuts',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-plugin-manager',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-renderer',
      '@deepseek-ai/dsh-client-ui-settings',
    ])
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.files).toEqual([
      'lib/index.js', 'lib/invariant.js', 'lib/client.js', 'lib/types/**/*.d.ts',
      'cordis.patch.yml', 'README.zh.md', 'CHANGELOG.md', 'CHANGELOG.zh.md',
    ])
    // README screenshots are served from GitHub, so they must not bloat the npm package.
    expect(manifest.files.some(entry => entry.startsWith('docs/'))).toBe(false)
  })

  it('accepts the verified DSH release and newer, while pinning the type baseline exactly', () => {
    for (const packageName of manifest.dsh.client.inject) {
      // Peers admit newer DSH releases; older ones were never adapted and are refused.
      expect(manifest.peerDependencies[packageName], packageName).toBe(DSH_PEER_RANGE)
      // devDependencies are the concrete compile/typecheck baseline, so they stay exact.
      expect(manifest.devDependencies[packageName], packageName).toBe(DSH_RELEASE)
      expect(manifest.dependencies[packageName], packageName).toBeUndefined()
    }
    expect(manifest.peerDependencies['@deepseek-ai/cordis']).toBe('~4.0.4')
    expect(manifest.dependencies['@deepseek-ai/schemastery']).toBe('3.18.4')
    expect(manifest.peerDependencies.react).toBe('>=18.2.0 <19.0.0')
  })

  it('rejects every DSH release below the adapted baseline', () => {
    // A peer range admitting newer releases must still refuse the generations this
    // version deliberately stopped supporting.
    expect(DSH_PEER_RANGE).not.toMatch(/^\*/u)
    for (const older of ['0.1.0-rc.8', '0.1.23', '0.2.0-alpha.1']) {
      expect(older.localeCompare(DSH_RELEASE, undefined, { numeric: true })).toBeLessThan(0)
    }
  })

  it('drops every removed legacy capability and package name', () => {
    const declared = JSON.stringify(manifest)
    for (const removed of [
      'settingsScope', 'dsh-client-runtime', '@deepseek-ai/dsh-client-connection',
      'dsh-client-ui-settings-plugins', 'dsh-client-ui-slots/legacy',
    ]) {
      expect(declared, removed).not.toContain(removed)
    }
  })

  it('keeps the loader row, settings namespace, and locale namespace layered', async () => {
    const { PACKAGE_NAME } = await import('../src/invariant.ts')
    const { SHORTCUTS_SETTINGS_NAMESPACE } = await import('../src/settings.ts')
    const { NS } = await import('../src/client/locales.ts')

    expect(manifest.name).toBe(PACKAGE_NAME)
    const row = patch.flatMap(layer => layer.insert ?? []).find(item => item.id === 'dsh-ui-shortcuts')
    expect(row).toEqual({ id: 'dsh-ui-shortcuts', name: PACKAGE_NAME })
    expect(SHORTCUTS_SETTINGS_NAMESPACE).toBe('dsh-ui-shortcuts')
    expect(NS).toBe('dsh-shortcuts')
  })

  it('builds published entries after a Git source install', () => {
    expect(manifest.scripts.prepare).toBe('pnpm run bundle')
    expect(manifest.scripts.typecheck).toBe('tsc --noEmit')
    expect(manifest.scripts.test).toBe('vitest run')
    // tsdown emits both faces into one directory with clean: false, so the build
    // clears lib/ first; otherwise a deleted module keeps shipping its .d.ts.
    expect(manifest.scripts['build:types']).toBe('pnpm run clean:lib && tsc')
    expect(manifest.scripts['clean:lib']).toBe('node scripts/clean-lib.mjs')
  })

  it('points every README screenshot at GitHub and keeps the file in the repository', () => {
    const base = 'https://raw.githubusercontent.com/hytime/dsh-client-ui-shortcuts/main'
    for (const doc of ['README.md', 'README.zh.md']) {
      const source = readFileSync(resolve(root, doc), 'utf8')
      const images = [...source.matchAll(/!\[[^\]]*\]\((?<url>[^)\s]+\.png)\)/gu)]
        .map(match => match.groups?.url)
        .filter((url): url is string => url !== undefined && !url.includes('shields.io'))
      expect(images.length, `${doc} must show the new UI`).toBeGreaterThan(0)
      for (const url of images) {
        // A relative path would render in neither npm nor GitHub once the asset is committed.
        expect(url.startsWith(`${base}/docs/`), `${doc} -> ${url}`).toBe(true)
        const asset = resolve(root, url.slice(`${base}/`.length))
        expect(existsSync(asset), `missing committed asset for ${url}`).toBe(true)
      }
    }
  })

  it('ships no declaration whose source module was removed', () => {
    const libTypes = resolve(root, 'lib/types')
    const declarations = readdirSync(libTypes, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.d.ts'))
    expect(declarations.length).toBeGreaterThan(0)
    const orphans = declarations
      .map(entry => relative(libTypes, join(entry.parentPath, entry.name)).replace(/\.d\.ts$/u, ''))
      .filter(relative => !existsSync(resolve(root, 'src', `${relative}.ts`))
        && !existsSync(resolve(root, 'src', `${relative}.tsx`)))
    expect(orphans).toEqual([])
  })
})
