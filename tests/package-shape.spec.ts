import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

type Manifest = {
  name: string
  exports: Record<string, { default?: string }>
  dsh: {
    client: { platform: string; inject: string[] }
    bundle: { patch: string }
  }
  files: string[]
  scripts: Record<string, string>
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
    expect(manifest.exports['./client']?.default).toBe('./lib/client.js')
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

  it('inserts the stable Web roster row', () => {
    const row = patch.flatMap(layer => layer.insert ?? []).find(item => item.id === 'ui-shortcuts')
    expect(row?.name).toBe('@hytime/dsh-client-ui-shortcuts')
  })
})
