import { describe, expect, it } from 'vitest'
import { canonicalBindingKey, createBuiltinProfileRegistry, createProfileRegistry } from '../src/client/profiles/registry.js'
import type { ShortcutProfile, ShortcutStroke } from '../src/client/contract/profile.js'

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

  it('retains built-in question and approval bindings and adds recommended global bindings', () => {
    const registry = createBuiltinProfileRegistry()
    expect(registry.get('standard')).toBeDefined()
    const standard = registry.get('standard')!

    expect(standard.bindings).toEqual(expect.arrayContaining([
      { command: 'activate', scope: 'question', key: stroke('Enter') },
      { command: 'activate', scope: 'approval', key: stroke('Enter') },
      {
        command: 'openCommandPalette',
        scope: 'global',
        sequences: [
          [{ key: 'p', modifiers: ['Meta', 'Alt'] }],
          [{ key: 'p', modifiers: ['Ctrl'] }],
        ],
      },
    ]))
  })

  it('includes every capability-backed global action in built-in profiles', () => {
    const registry = createBuiltinProfileRegistry()
    const standard = registry.get('standard')!
    expect(standard.bindings).toEqual(expect.arrayContaining([
      { command: 'startSession', scope: 'global', sequences: [[{ key: 'n', modifiers: ['Meta', 'Alt'] }], [{ key: 'n', modifiers: ['Ctrl'] }]] },
      { command: 'previousSession', scope: 'global', sequences: [[{ key: 'ArrowUp', modifiers: ['Meta', 'Alt'] }], [{ key: 'ArrowUp', modifiers: ['Ctrl', 'Alt'] }]] },
      { command: 'nextSession', scope: 'global', sequences: [[{ key: 'ArrowDown', modifiers: ['Meta', 'Alt'] }], [{ key: 'ArrowDown', modifiers: ['Ctrl', 'Alt'] }]] },
      { command: 'previousWorkspace', scope: 'global', sequences: [[{ key: 'ArrowLeft', modifiers: ['Meta', 'Alt', 'Shift'] }], [{ key: 'ArrowLeft', modifiers: ['Ctrl', 'Shift'] }]] },
      { command: 'nextWorkspace', scope: 'global', sequences: [[{ key: 'ArrowRight', modifiers: ['Meta', 'Alt', 'Shift'] }], [{ key: 'ArrowRight', modifiers: ['Ctrl', 'Shift'] }]] },
      { command: 'forkSession', scope: 'global', sequences: [[{ key: 'b', modifiers: ['Meta', 'Alt', 'Shift'] }], [{ key: 'b', modifiers: ['Ctrl', 'Shift'] }]] },
      { command: 'toggleTheme', scope: 'global', sequences: [[{ key: 'l', modifiers: ['Meta', 'Alt', 'Shift'] }], [{ key: 'l', modifiers: ['Ctrl', 'Shift'] }]] },
    ]))
  })

  it('replaces a custom profile while keeping the registry snapshot isolated', () => {
    const registry = createBuiltinProfileRegistry()
    const dispose = registry.register({
      ...alphaProfile,
      id: 'custom',
      bindings: [{ command: 'openCommandPalette', scope: 'global', key: stroke('p', { meta: true }) }],
    })

    expect(registry.get('custom')?.bindings).toHaveLength(1)
    dispose()
    expect(registry.get('custom')).toBeUndefined()
  })

  it('normalizes declarative symbolic strokes and rejects contradictory shapes', () => {
    const declarative: ShortcutStroke = { key: 'p', modifiers: ['Mod', 'Alt'] }
    const registry = createProfileRegistry([{
      ...alphaProfile,
      id: 'declarative',
      bindings: [{ command: 'openCommandPalette', scope: 'global', key: declarative }],
    }])

    expect(registry.get('declarative')?.bindings[0]?.key).toEqual(declarative)
    expect(Object.isFrozen(registry.get('declarative')?.bindings[0]?.key)).toBe(true)
    expect(() => createProfileRegistry([{
      ...alphaProfile,
      id: 'unknown-modifier',
      bindings: [{ command: 'openSettings', scope: 'global', key: { key: 's', modifiers: ['Nope' as never] } }],
    }])).toThrow('modifier')
  })
  it('rejects ambiguous binding shapes and deep-freezes normalized sequences', () => {
    expect(() => createProfileRegistry([{
      ...alphaProfile,
      id: 'ambiguous',
      bindings: [{ command: 'openSettings', scope: 'global', key: stroke('s'), sequence: [stroke('s')] }],
    }])).toThrow('ambiguous')

    const registry = createProfileRegistry([{
      ...alphaProfile,
      id: 'sequence',
      bindings: [{ command: 'openSettings', scope: 'global', sequences: [[stroke('g'), stroke('s')]] }],
    }])
    const binding = registry.get('sequence')!.bindings[0]!
    expect(Object.isFrozen(binding.sequences)).toBe(true)
    expect(Object.isFrozen(binding.sequences?.[0])).toBe(true)
    expect(Object.isFrozen(binding.sequences?.[0]?.[0])).toBe(true)
  })


  it('rejects contradictory modifier declarations and dual-platform conflicts', () => {
    expect(() => createProfileRegistry([{
      ...alphaProfile,
      id: 'contradictory-modifier',
      bindings: [{ command: 'openSettings', scope: 'global', key: stroke('p', { ctrl: true }), modifier: 'Alt' }],
    }])).toThrow('modifier')

    expect(() => createProfileRegistry([{
      ...alphaProfile,
      id: 'dual-platform',
      bindings: [{ command: 'openSettings', scope: 'global', key: stroke('p', { ctrl: true, meta: true }), modifier: 'Mod' }],
    }])).toThrow('modifier')

    expect(() => createProfileRegistry([{
      ...alphaProfile,
      id: 'symbolic-dual-platform',
      bindings: [{ command: 'openSettings', scope: 'global', key: { key: 'p', modifiers: ['Mod', 'Ctrl'] } }],
    }])).toThrow('modifier')
  })

  it('stores normalized frozen bindings instead of caller-owned objects', () => {
    const binding = { command: 'openSettings' as const, scope: 'global' as const, sequences: [[stroke('Esc')]] }
    const profile = { ...alphaProfile, id: 'owned-sequence', bindings: [binding] }
    const registry = createProfileRegistry([profile])
    binding.sequences[0]![0]!.key = 'mutated'

    const stored = registry.get('owned-sequence')!.bindings[0]!
    expect(stored.sequences?.[0]?.[0]?.key).toBe('Escape')
    expect(Object.isFrozen(stored.sequences)).toBe(true)
  })

  it('preserves legacy canonical slots for declarative Mod bindings without internal labels', () => {
    expect(canonicalBindingKey({
      command: 'openSettings',
      scope: 'global',
      key: stroke('p', { ctrl: true }),
    })).toBe('|ctrl|||p')

    const symbolicKey = canonicalBindingKey({
      command: 'openCommandPalette',
      scope: 'global',
      key: { key: 'p', modifiers: ['Mod'] },
    })
    expect(symbolicKey).toBe('|ctrl||p')
    expect(symbolicKey).not.toContain('modifier')
  })

  it('owns declarative representations without internal modifier fields', () => {
    const registry = createProfileRegistry([{
      ...alphaProfile,
      id: 'owned-declarative',
      bindings: [{ command: 'openSettings', scope: 'global', key: { key: 'Esc', modifiers: ['Mod', 'Alt'] } }],
    }])
    const key = registry.get('owned-declarative')!.bindings[0]!.key
    expect(key).toEqual({ key: 'Escape', modifiers: ['Mod', 'Alt'] })
    expect(key).not.toHaveProperty('modifier')
    expect(Object.isFrozen(key)).toBe(true)
  })

})
