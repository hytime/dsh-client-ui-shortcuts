import type { ShortcutBinding, ShortcutModifier } from './client/contract/profile.js'

const COMMANDS = new Set(['focusPrevious', 'focusNext', 'activate', 'cancelTask', 'openCommandPalette', 'openSettings'])
const SCOPES = new Set(['global', 'question', 'approval'])
const MODIFIERS = new Set<ShortcutModifier>(['Mod', 'Alt', 'Ctrl', 'Meta', 'Shift'])

/** Validate persisted shortcut JSON without importing Client runtime modules. */
export function validatePersistedShortcutBindings(bindings: readonly ShortcutBinding[]): void {
  if (!Array.isArray(bindings) || bindings.length === 0) throw new Error('customBindings must be a non-empty array')
  const seen = new Set<string>()
  for (const binding of bindings) {
    if (!isRecord(binding) || !COMMANDS.has(binding.command) || !SCOPES.has(binding.scope)) {
      throw new Error('invalid custom shortcut binding')
    }
    const stroke = binding.key
    if (!isRecord(stroke) || typeof stroke.key !== 'string' || stroke.key.length === 0) {
      throw new Error('invalid custom shortcut key')
    }
    const modifiers = Array.isArray(stroke.modifiers)
      ? stroke.modifiers
      : isPhysicalStroke(stroke)
        ? physicalModifiers(stroke)
        : undefined
    if (modifiers === undefined) throw new Error('invalid custom shortcut modifiers')
    if (modifiers.some(modifier => !MODIFIERS.has(modifier))) {
      throw new Error('invalid custom shortcut modifiers')
    }
    if (new Set(modifiers).size !== modifiers.length || (modifiers.includes('Mod') && modifiers.length > 1)) {
      throw new Error('invalid custom shortcut modifiers')
    }
    const identity = `${binding.scope}:${stroke.key}:${[...modifiers].sort().join(',')}`
    if (seen.has(identity)) throw new Error(`shortcut conflict in scope: ${binding.scope}`)
    seen.add(identity)
  }
}

function isPhysicalStroke(value: Record<string, any>): boolean {
  return ['alt', 'ctrl', 'meta', 'shift'].every(field => typeof value[field] === 'boolean')
}

function physicalModifiers(stroke: Record<string, any>): ShortcutModifier[] {
  return [
    ...(stroke.alt ? ['Alt' as const] : []),
    ...(stroke.ctrl ? ['Ctrl' as const] : []),
    ...(stroke.meta ? ['Meta' as const] : []),
    ...(stroke.shift ? ['Shift' as const] : []),
  ]
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
