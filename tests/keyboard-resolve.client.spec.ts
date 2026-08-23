import { describe, expect, it } from 'vitest'
import { standardProfile, vimProfile } from '../src/client/profiles/builtins.js'
import { findShortcutConflicts } from '../src/client/keyboard/conflicts.js'
import { normalizeKeyboardEvent } from '../src/client/keyboard/normalize.js'
import { createKeyResolver, resolveKey } from '../src/client/keyboard/resolve.js'
import { createBuiltinProfileRegistry, canonicalBindingKey, canonicalSequenceKey } from '../src/client/profiles/registry.js'
import type { KeyInput } from '../src/client/contract/keyboard.js'
import type { ShortcutProfile, ShortcutStroke } from '../src/client/contract/profile.js'

const input = (key: string, options: Partial<KeyInput> = {}): KeyInput => ({
  key, alt: false, ctrl: false, meta: false, shift: false, ...options,
})

describe('profile-aware keyboard resolver', () => {
  it('resolves standard and vim navigation and actions', () => {
    expect(resolveKey(standardProfile, 'question', input('ArrowDown'), 'linux')).toEqual({ kind: 'command', command: 'focusNext' })
    expect(resolveKey(standardProfile, 'approval', input('Enter'), 'linux')).toEqual({ kind: 'command', command: 'activate' })
    expect(resolveKey(vimProfile, 'question', input('j'), 'linux')).toEqual({ kind: 'command', command: 'focusNext' })
    expect(resolveKey(vimProfile, 'question', input('k'), 'linux')).toEqual({ kind: 'command', command: 'focusPrevious' })
  })

  it('resolves Escape cancellation on both surfaces', () => {
    expect(resolveKey(standardProfile, 'question', input('Escape'), 'linux')).toEqual({ kind: 'command', command: 'cancelTask' })
    expect(resolveKey(standardProfile, 'approval', input('Escape'), 'linux')).toEqual({ kind: 'command', command: 'cancelTask' })
  })

  it.each([
    ['composing', { composing: true }],
    ['ime key code', { keyCode: 229 }],
    ['repeat', { repeat: true }],
    ['disabled', { disabled: true }],
  ])('passes Enter when %s', (_name, options) => {
    expect(resolveKey(standardProfile, 'approval', input('Enter', options), 'linux')).toEqual({ kind: 'pass' })
  })

  it('normalizes Esc without reading DOM', () => {
    const event = { key: 'Esc', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false, repeat: false, keyCode: 27 }
    expect(normalizeKeyboardEvent(event).key).toBe('Escape')
    expect(normalizeKeyboardEvent(event)).toEqual(expect.objectContaining({ alt: false, ctrl: false, meta: false, shift: false }))
  })

  it('uses stable modifier ordering without scope in canonical keys', () => {
    expect(canonicalBindingKey({ command: 'activate', scope: 'approval', key: input('Enter', { alt: true, ctrl: true, meta: true, shift: true }) })).toBe('alt|ctrl|meta|shift|Enter')
  })

  it('reports same-scope conflicts while allowing cross-scope reuse', () => {
    const first = { command: 'activate' as const, scope: 'question' as const, key: input('Enter') }
    const second = { command: 'cancelTask' as const, scope: 'question' as const, key: input('Enter') }
    const third = { command: 'activate' as const, scope: 'approval' as const, key: input('Enter') }
    const profile: ShortcutProfile = { ...standardProfile, id: 'conflicts', bindings: [first, second, third] }
    const conflicts = findShortcutConflicts(profile)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toEqual({ scope: 'question', key: '||||Enter', first, second })
  })

  it('resolves global commands with Mod on the active platform modifier', () => {
    const profile: ShortcutProfile = {
      ...standardProfile,
      id: 'global',
      bindings: [{ command: 'openCommandPalette', scope: 'global', key: input('p'), modifier: 'Mod' }],
    }

    expect(resolveKey(profile, 'global', input('p', { meta: true }), 'mac')).toEqual({ kind: 'command', command: 'openCommandPalette' })
    expect(resolveKey(profile, 'global', input('p', { ctrl: true }), 'linux')).toEqual({ kind: 'command', command: 'openCommandPalette' })
  })

  it('uses browser-safe platform alternatives for global defaults', () => {
    const start = standardProfile.bindings.find(binding => binding.command === 'startSession' && binding.scope === 'global')
    expect(start).toEqual({
      command: 'startSession',
      scope: 'global',
      sequences: [
        [{ key: 'n', modifiers: ['Meta', 'Alt'] }],
        [{ key: 'n', modifiers: ['Ctrl'] }],
      ],
    })
    expect(resolveKey(standardProfile, 'global', input('n', { meta: true, alt: true }), 'mac')).toEqual({ kind: 'command', command: 'startSession' })
    expect(resolveKey(standardProfile, 'global', input('n', { ctrl: true }), 'windows')).toEqual({ kind: 'command', command: 'startSession' })
    expect(resolveKey(standardProfile, 'global', input('n', { ctrl: true }), 'mac')).toEqual({ kind: 'pass' })
  })

  it('resolves shifted global defaults with browser key casing', () => {
    expect(resolveKey(standardProfile, 'global', input('B', { ctrl: true, shift: true }), 'windows')).toEqual({ kind: 'command', command: 'forkSession' })
    expect(resolveKey(standardProfile, 'global', input('L', { meta: true, alt: true, shift: true }), 'mac')).toEqual({ kind: 'command', command: 'toggleTheme' })
  })

  it('resolves declarative Mod and Alt combinations', () => {
    const stroke: ShortcutStroke = { key: 'p', modifiers: ['Mod', 'Alt'] }
    const profile: ShortcutProfile = {
      ...standardProfile,
      id: 'declarative-mod',
      bindings: [{ command: 'openSettings', scope: 'global', key: stroke }],
    }

    expect(resolveKey(profile, 'global', input('p', { ctrl: true, alt: true }), 'linux')).toEqual({ kind: 'command', command: 'openSettings' })
    expect(resolveKey(profile, 'global', input('p', { meta: true, alt: true }), 'mac')).toEqual({ kind: 'command', command: 'openSettings' })
    expect(resolveKey(profile, 'global', input('p', { ctrl: true, meta: true, alt: true }), 'linux')).toEqual({ kind: 'pass' })
  })
  it('resolves two-stroke sequences and alternative sequences', () => {
    const profile: ShortcutProfile = {
      ...standardProfile,
      id: 'sequence',
      bindings: [{
        command: 'openSettings',
        scope: 'global',
        sequences: [[input('g'), input('s')], [input('s')]],
      }],
    }

    expect(resolveKey(profile, 'global', input('g'), 'linux')).toEqual({ kind: 'pass' })
    expect(resolveKey(profile, 'global', input('s'), 'linux')).toEqual({ kind: 'command', command: 'openSettings' })
  })


  it('does not share partial sequence state between resolver instances', () => {
    const profile: ShortcutProfile = {
      ...standardProfile,
      id: 'isolated',
      bindings: [{ command: 'openSettings', scope: 'global', sequences: [[input('g'), input('s')]] }],
    }
    const first = createKeyResolver()
    const second = createKeyResolver()

    expect(first.resolve(profile, 'global', input('g'), 'linux')).toEqual({ kind: 'pass' })
    expect(second.resolve(profile, 'global', input('s'), 'linux')).toEqual({ kind: 'pass' })
    expect(first.resolve(profile, 'global', input('s'), 'linux')).toEqual({ kind: 'command', command: 'openSettings' })
  })

  it('matches Mod equivalence but keeps explicit Ctrl and Meta exact', () => {
    const modProfile: ShortcutProfile = {
      ...standardProfile,
      id: 'mod',
      bindings: [{ command: 'openSettings', scope: 'global', key: input('p'), modifier: 'Mod' }],
    }
    const ctrlProfile: ShortcutProfile = {
      ...standardProfile,
      id: 'ctrl',
      bindings: [{ command: 'openSettings', scope: 'global', key: input('p', { ctrl: true }) }],
    }

    expect(resolveKey(modProfile, 'global', input('p', { ctrl: true }), 'linux')).toEqual({ kind: 'command', command: 'openSettings' })
    expect(resolveKey(modProfile, 'global', input('p', { meta: true }), 'mac')).toEqual({ kind: 'command', command: 'openSettings' })
    expect(resolveKey(ctrlProfile, 'global', input('p', { meta: true }), 'mac')).toEqual({ kind: 'pass' })
  })

  it('does not match Mod against a dual-platform modifier event', () => {
    const profile: ShortcutProfile = {
      ...standardProfile,
      id: 'dual-mod',
      bindings: [{ command: 'openSettings', scope: 'global', key: input('p'), modifier: 'Mod' }],
    }
    expect(resolveKey(profile, 'global', input('p', { ctrl: true, meta: true }), 'linux')).toEqual({ kind: 'pass' })
  })

  it('preserves the legacy single-stroke key and exposes sequence canonicalization separately', () => {
    const binding = { command: 'activate' as const, scope: 'approval' as const, key: input('Enter') }
    expect(canonicalBindingKey(binding)).toBe('||||Enter')
    expect(canonicalSequenceKey({ strokes: [input('g'), input('s')] })).toBe('||||g ||||s')
  })

  it('selects persisted built-in profiles and falls back when missing', () => {
    expect(createBuiltinProfileRegistry('missing').active().id).toBe('standard')
    expect(createBuiltinProfileRegistry('vim').active().id).toBe('vim')
  })
})
