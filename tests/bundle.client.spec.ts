import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  name: string
  files: string[]
  dsh: { client: { inject: string[] } }
}

describe('client bundle and package artifact', () => {
  it('emits the lazy loader, source map, inline icons, and no network provider', () => {
    const clientSource = readFileSync(resolve(root, 'lib/client.js'), 'utf8')
    expect(clientSource).toContain('window.__ModuleLoader__.load')
    expect(clientSource).toContain('@hytime/dsh-client-ui-shortcuts')
    expect(clientSource).toContain('data-plugin')
    expect(clientSource).not.toContain('api.iconify.design')
    expect(clientSource).not.toContain('github.com/iconify')
    expect(clientSource).not.toContain('@deepseek-ai/dsh-settings')
    expect(() => readFileSync(resolve(root, 'lib/client.js.map'), 'utf8')).not.toThrow()
  })

  it('publishes only the declared runtime and type artifacts', () => {
    expect(manifest.name).toBe('@hytime/dsh-client-ui-shortcuts')
    expect(manifest.files).toEqual([
      'lib/index.js',
      'lib/invariant.js',
      'lib/client.js',
      'lib/types/**/*.d.ts',
    ])
    for (const forbidden of ['tests/', 'src/', '.superpowers/', 'docs/superpowers/', 'node_modules/']) {
      expect(manifest.files.join('\n')).not.toContain(forbidden)
    }
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-runtime')
  })
})
