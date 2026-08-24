import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

type Manifest = {
  name: string
  main: string
  exports: {
    '.': { types: string; default: string }
    './invariant': { types: string; default: string }
    './client': { types: string; default: string }
    './src/*': string
    './package.json': string
  }
  dsh: {
    client: { platform: string; inject: string[] }
    bundle: { patch: string }
  }
  files: string[]
  scripts: Record<string, string>
  repository?: { type: string; url: string }
  homepage?: string
  bugs?: { url: string }
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  peerDependencies: Record<string, string>
}

describe('package manifest', () => {
  const root = resolve(import.meta.dirname, '..')
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as Manifest
  const patch = YAML.parse(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8')) as Array<{
    insert?: Array<{ id?: string; name?: string }>
  }>

  it('publishes the DSH Client package and browser entry', () => {
    expect(manifest.name).toBe('@hytime/dsh-client-ui-shortcuts')
    expect(manifest.main).toBe('lib/index.js')
    expect(manifest.exports).toEqual({
      '.': {
        types: './lib/types/index.d.ts',
        default: './lib/index.js',
      },
      './invariant': {
        types: './lib/types/invariant.d.ts',
        default: './lib/invariant.js',
      },
      './client': {
        types: './lib/types/client/index.d.ts',
        default: './lib/client.js',
      },
      './src/*': './src/*',
      './package.json': './package.json',
    })
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.inject).toEqual([
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-ui-settings-plugins',
      '@deepseek-ai/dsh-client-ui-slots',
    ])
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.files).toEqual([
      'lib/index.js',
      'lib/invariant.js',
      'lib/client.js',
      'lib/types/**/*.d.ts',
      'cordis.patch.yml',
      'README.zh.md',
      'CHANGELOG.md',
      'CHANGELOG.zh.md',
    ])
    expect(manifest.dependencies).toEqual({
      '@iconify-icons/lucide': '1.2.136',
      '@iconify/react': '6.0.2',
      clsx: '2.1.1',
    })
    expect(manifest.peerDependencies.react).toBe('>=18.2.0 <19.0.0')
    expect(manifest.devDependencies.react).toBe('18.3.1')
    expect(manifest.scripts).toMatchObject({
      'build:types': 'tsc',
      bundle: 'pnpm run build:types && tsdown',
      watch: 'tsdown --watch',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
    })
    for (const packageName of manifest.dsh.client.inject) {
      expect(manifest.peerDependencies[packageName]).toBe('>=0.1.0-rc.8 <1.0.0')
      expect(manifest.dependencies[packageName]).toBeUndefined()
    }
  })

  it('builds published entry points after a Git source install', () => {
    expect(manifest.scripts.prepare).toBe('pnpm run bundle')
  })

  it('maps the npm package to its canonical GitHub repository', () => {
    expect(manifest.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/hytime/dsh-client-ui-shortcuts.git',
    })
    expect(manifest.homepage).toBe('https://github.com/hytime/dsh-client-ui-shortcuts#readme')
    expect(manifest.bugs).toEqual({
      url: 'https://github.com/hytime/dsh-client-ui-shortcuts/issues',
    })
  })

  it('keeps package, roster, settings, locale and profile identifiers layered', async () => {
    const { PACKAGE_NAME } = await import('../src/invariant.ts')
    const { SHORTCUTS_SETTINGS_NAMESPACE } = await import('../src/settings.ts')
    const { NS } = await import('../src/client/locales.ts')
    const { SHORTCUT_PROFILE_IDS } = await import('../src/profile-catalog.ts')

    expect(manifest.name).toBe(PACKAGE_NAME)
    const row = patch.flatMap(layer => layer.insert ?? []).find(item => item.id === 'dsh-ui-shortcuts')
    expect(row).toEqual({ id: 'dsh-ui-shortcuts', name: PACKAGE_NAME })
    expect(SHORTCUTS_SETTINGS_NAMESPACE).toBe('dsh-ui-shortcuts')
    expect(NS).toBe('dsh-shortcuts')
    expect(SHORTCUT_PROFILE_IDS).toEqual(['standard', 'vim', 'custom'])
  })

})
