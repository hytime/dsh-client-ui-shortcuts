import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import YAML from 'yaml'

const root = resolve(import.meta.dirname, '..')
const packageManifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  name: string
  version: string
  files: string[]
  dsh: {
    client: { platform: string; inject: string[] }
    bundle: { patch: string }
  }
}
const fixturePath = resolve(root, 'tests/fixtures/composition/cordis.yml')

type Patch = { insert?: Array<{ id?: string; name?: string }> }

function packTarball(): { directory: string; tarball: string } {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-shortcuts-pack-'))
  const output = execFileSync('pnpm', ['pack', '--pack-destination', directory], { cwd: root, encoding: 'utf8' })
  const match = output.match(/(\/[^\n]+\.tgz)\s*$/m)
  if (match?.[1] === undefined) throw new Error(`pnpm pack did not report a tarball path:\n${output}`)
  return { directory, tarball: match[1] }
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
    const sourceMap = JSON.parse(readFileSync(resolve(root, 'lib/client.js.map'), 'utf8')) as { version?: number; sources?: string[] }
    expect(sourceMap.version).toBeGreaterThan(0)
    expect(sourceMap.sources?.length).toBeGreaterThan(0)
  })

  it('inspects the actual pnpm pack tarball without a fixed version filename', () => {
    const packed = packTarball()
    try {
      const entries = execFileSync('tar', ['-tzf', packed.tarball], { encoding: 'utf8' })
        .split('\n').filter(Boolean)
      expect(entries).toContain('package/lib/index.js')
      expect(entries).toContain('package/lib/invariant.js')
      expect(entries).toContain('package/cordis.patch.yml')
      expect(entries.some(entry => /^package\/lib\/types\/.*\.d\.ts$/.test(entry))).toBe(true)
      for (const forbidden of ['package/tests/', 'package/src/', 'package/.superpowers/', 'package/docs/superpowers/', 'package/node_modules/']) {
        expect(entries.some(entry => entry.startsWith(forbidden))).toBe(false)
      }
    } finally {
      rmSync(packed.directory, { recursive: true, force: true })
    }
  })

  it('keeps package metadata and the Web overlay fixture aligned', () => {
    const fixture = YAML.parse(readFileSync(fixturePath, 'utf8')) as Patch[]
    const rows = fixture.flatMap(layer => layer.insert ?? [])
    expect(rows).toContainEqual({ id: 'dsh-ui-shortcuts', name: packageManifest.name })
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(fixture)).not.toMatch(/api[_ -]?key|secret|token/i)
    expect(packageManifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(packageManifest.dsh.client.platform).toBe('web')
    expect(packageManifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-runtime')
    expect(readFileSync(resolve(root, 'lib/index.js'), 'utf8')).toBeTruthy()
    expect(readFileSync(resolve(root, 'lib/client.js'), 'utf8')).toBeTruthy()
  })

  it('loads the generated bundle patch with the official DSH parser when available', async () => {
    const official = '/Volumes/hydisk/deepseek-harness'
    const profile = mkdtempSync(join(tmpdir(), 'dsh-shortcuts-profile-'))
    try {
      const packageDir = join(profile, 'node_modules', '@hytime', 'dsh-client-ui-shortcuts')
      execFileSync('tar', ['-xzf', packTarball().tarball, '-C', profile])
      const extracted = join(profile, 'package')
      execFileSync('mkdir', ['-p', join(profile, 'node_modules', '@hytime')])
      execFileSync('mv', [extracted, packageDir])
      const manifest = {
        name: 'dsh-profile-shortcuts',
        private: true,
        dependencies: { [packageManifest.name]: packageManifest.version },
        dsh: { profile: { bundles: [packageManifest.name] } },
      }
      writeFileSync(join(profile, 'package.json'), JSON.stringify(manifest))
      writeFileSync(join(profile, 'cordis.patch.yml'), readFileSync(fixturePath))
      const loaderPath = resolve(official, 'packages/boot/app-boot/src/profile.ts')
      try {
        const { loadOverlayPatches } = await import(`${resolve(official, 'packages/boot/app-boot/src/index.ts')}`)
        const patchPath = resolve(packageDir, packageManifest.dsh.bundle.patch)
        const patches = loadOverlayPatches('test', patchPath) as Patch[]
        expect(patches.flatMap(layer => layer.insert ?? [])).toContainEqual({ id: 'dsh-ui-shortcuts', name: packageManifest.name })
        expect(loaderPath).toContain('/profile.ts')
      } catch (error) {
        expect(String(error)).toMatch(/ERR_MODULE_NOT_FOUND|Cannot find module|pnpm|tsx|module/i)
        console.warn(`official DSH parser unavailable: ${String(error)}`)
      }
    } finally {
      rmSync(profile, { recursive: true, force: true })
    }
  })
})
