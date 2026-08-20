import { describe, expect, it } from 'vitest'
import { createProfileRegistry } from '../src/client/profiles/registry.js'
import type { ShortcutProfile } from '../src/client/contract/profile.js'

const stroke = (key: string, modifiers: Partial<ShortcutProfile['bindings'][number]['key']> = {}) => ({
  key,
  alt: false,
  ctrl: false,
  meta: false,
  shift: false,
  ...modifiers,
})

const alphaProfile: ShortcutProfile = {
  id: 'alpha',
  label: 'shortcut.alpha.label',
  description: 'shortcut.alpha.description',
  bindings: [
    { command: 'focusPrevious', scope: 'question', key: stroke('ArrowUp') },
    { command: 'focusNext', scope: 'question', key: stroke('ArrowDown') },
  ],
}

const betaProfile: ShortcutProfile = {
  id: 'beta',
  label: 'shortcut.beta.label',
  description: 'shortcut.beta.description',
  bindings: [{ command: 'activate', scope: 'approval', key: stroke('Enter') }],
}

describe('shortcut profile registry', () => {
  it('lists profiles and switches the active profile', () => {
    const registry = createProfileRegistry([alphaProfile, betaProfile])

    expect(registry.list().map((profile) => profile.id)).toEqual(['alpha', 'beta'])
    expect(registry.active().id).toBe('alpha')

    registry.setActive('beta')
    expect(registry.active().id).toBe('beta')
  })

  it('rejects an unknown active profile without changing state', () => {
    const registry = createProfileRegistry([alphaProfile, betaProfile])

    expect(() => registry.setActive('missing')).toThrow('unknown shortcut profile')
    expect(registry.active().id).toBe('alpha')
  })

  it.each([
    ['duplicate id', { ...betaProfile, id: 'alpha' }, 'duplicate shortcut profile'],
    ['empty bindings', { ...betaProfile, id: 'empty', bindings: [] }, 'bindings'],
    ['invalid scope', { ...betaProfile, id: 'scope', bindings: [{ ...betaProfile.bindings[0], scope: 'other' as never }] }, 'scope'],
    ['invalid command', { ...betaProfile, id: 'command', bindings: [{ ...betaProfile.bindings[0], command: 'other' as never }] }, 'command'],
    ['invalid key', { ...betaProfile, id: 'key', bindings: [{ ...betaProfile.bindings[0], key: { ...stroke(''), key: '' } }] }, 'key'],
    ['same-scope conflict', {
      ...betaProfile,
      id: 'conflict',
      bindings: [
        betaProfile.bindings[0],
        { command: 'cancelTask', scope: 'approval', key: stroke('Enter') },
      ],
    }, 'conflict'],
  ])('rejects %s', (_name, profile, message) => {
    const registry = createProfileRegistry([alphaProfile, betaProfile])
    expect(() => registry.register(profile)).toThrow(message)
  })

  it('allows the same keystroke in different scopes', () => {
    const registry = createProfileRegistry([alphaProfile])
    const dispose = registry.register({
      ...betaProfile,
      id: 'reuse',
      bindings: [{ ...betaProfile.bindings[0], scope: 'question' }],
    })

    expect(registry.get('reuse')?.bindings[0].key.key).toBe('Enter')
    dispose()
  })

  it('falls back to the default when the active profile is removed', () => {
    const registry = createProfileRegistry([alphaProfile, betaProfile], 'alpha')
    const dispose = registry.register({ ...betaProfile, id: 'gamma' })
    registry.setActive('gamma')

    dispose()
    expect(registry.active().id).toBe('alpha')
  })

  it('honors an explicit default profile id', () => {
    const registry = createProfileRegistry([alphaProfile, betaProfile], 'beta')
    expect(registry.active().id).toBe('beta')
  })

  it('rejects invalid initial profiles before publishing a registry', () => {
    expect(() => createProfileRegistry([alphaProfile, { ...alphaProfile, id: 'alpha' }])).toThrow('duplicate shortcut profile')
    expect(() => createProfileRegistry([alphaProfile, {
      ...betaProfile,
      id: 'initial-conflict',
      bindings: [
        betaProfile.bindings[0],
        { command: 'cancelTask', scope: 'approval', key: stroke('Enter') },
      ],
    }])).toThrow('conflict')
  })

  it('freezes snapshots and distinguishes modifier combinations', () => {
    const registry = createProfileRegistry([alphaProfile])
    expect(Object.isFrozen(registry.list())).toBe(true)
    expect(Object.isFrozen(registry.list()[0])).toBe(true)
    expect(Object.isFrozen(registry.list()[0]?.bindings)).toBe(true)
    expect(Object.isFrozen(registry.list()[0]?.bindings[0]?.key)).toBe(true)

    const dispose = registry.register({
      ...betaProfile,
      id: 'modifier',
      bindings: [
        betaProfile.bindings[0],
        { ...betaProfile.bindings[0], command: 'cancelTask', key: stroke('Enter', { ctrl: true }) },
      ],
    })
    expect(registry.get('modifier')?.bindings).toHaveLength(2)
    dispose()
  })

  it('makes profile disposers idempotent', () => {
    const registry = createProfileRegistry([alphaProfile])
    let calls = 0
    registry.subscribe(() => calls++)
    const dispose = registry.register(betaProfile)
    expect(calls).toBe(1)
    dispose()
    dispose()
    expect(calls).toBe(2)
  })

  it('notifies subscribers only after real changes', () => {
    const registry = createProfileRegistry([alphaProfile])
    let calls = 0
    const unsubscribe = registry.subscribe(() => calls++)

    registry.setActive('alpha')
    expect(calls).toBe(0)

    const dispose = registry.register(betaProfile)
    expect(calls).toBe(1)
    registry.setActive('beta')
    expect(calls).toBe(2)
    dispose()
    expect(calls).toBe(3)

    unsubscribe()
    registry.setActive('alpha')
    expect(calls).toBe(3)
  })
})
