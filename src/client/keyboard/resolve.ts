import type { KeyInput, ShortcutDecision } from '../contract/keyboard.js'
import type { ShortcutProfile, ShortcutScope } from '../contract/profile.js'

export function resolveKey(profile: ShortcutProfile, scope: ShortcutScope, input: KeyInput): ShortcutDecision {
  if (input.disabled || input.composing || input.keyCode === 229 || input.repeat) return { kind: 'pass' }
  const key = input.key === 'Esc' ? 'Escape' : input.key
  const binding = profile.bindings.find(entry => entry.scope === scope
    && entry.key.key === key
    && entry.key.alt === input.alt
    && entry.key.ctrl === input.ctrl
    && entry.key.meta === input.meta
    && entry.key.shift === input.shift)
  return binding ? { kind: 'command', command: binding.command } : { kind: 'pass' }
}
