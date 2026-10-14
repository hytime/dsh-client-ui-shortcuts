import { describe, expect, it } from 'vitest'
import { standardProfile } from '../src/client/profiles/builtins.js'
import { resolveKey } from '../src/client/keyboard/resolve.js'
import type { KeyInput } from '../src/client/contract/keyboard.js'
import type { ShortcutProfile } from '../src/client/contract/profile.js'

const input = (key: string, options: Partial<KeyInput> = {}): KeyInput => ({
  key, alt: false, ctrl: false, meta: false, shift: false, ...options,
})

describe('local interaction resolution', () => {
  it('resolves arrow navigation, activation, and cancellation in both scopes', () => {
    expect(resolveKey(standardProfile, 'question', input('ArrowUp'))).toEqual({ kind: 'command', command: 'focusPrevious' })
    expect(resolveKey(standardProfile, 'question', input('ArrowDown'))).toEqual({ kind: 'command', command: 'focusNext' })
    expect(resolveKey(standardProfile, 'question', input('Enter'))).toEqual({ kind: 'command', command: 'activate' })
    expect(resolveKey(standardProfile, 'question', input('Escape'))).toEqual({ kind: 'command', command: 'cancelTask' })
    expect(resolveKey(standardProfile, 'approval', input('Enter'))).toEqual({ kind: 'command', command: 'activate' })
    expect(resolveKey(standardProfile, 'approval', input('Escape'))).toEqual({ kind: 'command', command: 'cancelTask' })
  })
  it('normalizes Esc and keeps scope isolation', () => {
    expect(resolveKey(standardProfile, 'question', input('Esc'))).toEqual({ kind: 'command', command: 'cancelTask' })
    const questionOnly: ShortcutProfile = { id: 'q', label: 'q', description: 'q', bindings: [
      { command: 'activate', scope: 'question', key: { key: 'Enter', modifiers: [] } },
    ] }
    expect(resolveKey(questionOnly, 'question', input('Enter'))).toEqual({ kind: 'command', command: 'activate' })
    expect(resolveKey(questionOnly, 'approval', input('Enter'))).toEqual({ kind: 'pass' })
  })
  it('ignores IME, keyCode 229, repeat, and disabled input', () => {
    for (const flag of [{ composing: true }, { keyCode: 229 }, { repeat: true }, { disabled: true }]) {
      expect(resolveKey(standardProfile, 'question', input('Enter', flag))).toEqual({ kind: 'pass' })
    }
  })
  it('does not treat modifier combinations as local bindings', () => {
    expect(resolveKey(standardProfile, 'question', input('ArrowUp', { meta: true }))).toEqual({ kind: 'pass' })
    expect(resolveKey(standardProfile, 'approval', input('Enter', { ctrl: true }))).toEqual({ kind: 'pass' })
  })
})
