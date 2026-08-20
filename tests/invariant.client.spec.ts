import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PACKAGE_NAME, name } from '../src/invariant.js'
import { createProfileRegistry } from '../src/client/profiles/registry.js'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { name: string }

const profile = {
  id: 'alpha',
  label: 'shortcut.alpha.label',
  description: 'shortcut.alpha.description',
  bindings: [{
    command: 'activate' as const,
    scope: 'question' as const,
    key: { key: 'Enter', alt: false, ctrl: false, meta: false, shift: false },
  }],
}

describe('shortcuts package invariant', () => {
  it('uses the manifest name for the invariant registration', () => {
    expect(PACKAGE_NAME).toBe(manifest.name)
    expect(name).toBe('client-ui-shortcuts-invariant')
  })

  it('documents the UI-only runtime observation boundary', () => {
    const source = readFileSync(resolve(root, 'src/invariant.ts'), 'utf8')
    expect(source).toContain('No runtime invariant: shortcuts is UI-only')
  })

  it('keeps exactly one active profile and falls back after disposal', () => {
    const registry = createProfileRegistry([profile])
    const dispose = registry.register({ ...profile, id: 'beta' })

    registry.setActive('beta')
    expect(registry.active().id).toBe('beta')
    expect(registry.list().filter((entry) => entry.id === registry.active().id)).toHaveLength(1)

    dispose()
    expect(registry.active().id).toBe('alpha')
    expect(registry.get('beta')).toBeUndefined()
  })

  it('makes owned profile observations disappear after disposal', () => {
    const registry = createProfileRegistry([profile])
    const dispose = registry.register({ ...profile, id: 'owned' })

    expect(registry.get('owned')).toBeDefined()
    dispose()
    expect(registry.get('owned')).toBeUndefined()
    expect(registry.list().map((entry) => entry.id)).toEqual(['alpha'])
  })

  it('models registry, slot, and locale disposal without test-only cleanup', () => {
    const owned = new Set(['profile', 'slot', 'locale'])
    const disposers = [
      () => owned.delete('profile'),
      () => owned.delete('slot'),
      () => owned.delete('locale'),
    ]

    for (const dispose of disposers) dispose()
    expect([...owned]).toEqual([])
  })

  it('keeps superpowers material ignored without ignoring package sources', () => {
    const ignore = readFileSync(resolve(root, '.gitignore'), 'utf8')
    expect(ignore).toMatch(/\.superpowers\//)
    expect(ignore).toMatch(/docs\/superpowers\//)
    expect(ignore).not.toMatch(/(?:^|\n)src\//)
    expect(ignore).not.toMatch(/(?:^|\n)tests\//)
    expect(ignore).not.toMatch(/(?:^|\n)README\.md/)
    expect(ignore).not.toMatch(/(?:^|\n)AGENTS\.md/)
  })
})
