import type { PersistedShortcutBinding } from './settings.js'

const COMMANDS = new Set(['focusPrevious', 'focusNext', 'activate', 'cancelTask', 'openCommandPalette', 'openSettings'])
const SCOPES = new Set(['global', 'question', 'approval'])
const MODIFIERS = new Set(['Mod', 'Alt', 'Ctrl', 'Meta', 'Shift'])
const MODIFIER_ORDER = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'] as const

type Modifier = (typeof MODIFIER_ORDER)[number]
type RecordValue = Record<string, unknown>
type CanonicalStroke = { readonly key: string; readonly modifiers: readonly Modifier[] }
type CanonicalSequence = readonly CanonicalStroke[]

/** Validate persisted shortcut JSON without importing Client modules. */
export function validatePersistedShortcutBindings(bindings: readonly PersistedShortcutBinding[]): void {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new Error('customBindings must be a non-empty array')
  }
  const entries: Array<{ scope: string; sequence: CanonicalSequence }> = []
  for (const bindingValue of bindings) {
    const binding = recordOf(bindingValue, 'invalid custom shortcut binding')
    if (typeof binding.command !== 'string' || !COMMANDS.has(binding.command)) {
      throw new Error('invalid custom shortcut command')
    }
    if (typeof binding.scope !== 'string' || !SCOPES.has(binding.scope)) {
      throw new Error('invalid custom shortcut scope')
    }
    for (const sequence of sequencesOf(binding)) {
      if (sequence.length < 1 || sequence.length > 2) {
        throw new Error('custom shortcut sequences must contain one or two strokes')
      }
      entries.push({ scope: binding.scope, sequence: sequence.map(normalizeStroke) })
    }
  }

  for (let index = 0; index < entries.length; index += 1) {
    for (let other = index + 1; other < entries.length; other += 1) {
      const first = entries[index]!
      const second = entries[other]!
      if (first.scope === second.scope && isPrefix(first.sequence, second.sequence)) {
        throw new Error(`shortcut conflict in scope: ${first.scope}`)
      }
    }
  }
}

function sequencesOf(binding: RecordValue): readonly (readonly unknown[])[] {
  const present = ['key', 'sequence', 'sequences'].filter(name => binding[name] !== undefined)
  if (present.length !== 1) throw new Error('shortcut binding must define exactly one key, sequence, or sequences')
  const field = present[0]!
  if (field === 'key') return [[binding.key]]
  if (!Array.isArray(binding[field])) throw new Error('invalid custom shortcut sequence')
  if (field === 'sequence') return [binding.sequence as readonly unknown[]]
  const alternatives = binding.sequences as readonly unknown[]
  if (alternatives.length === 0 || alternatives.some(sequence => !Array.isArray(sequence))) {
    throw new Error('invalid custom shortcut alternatives')
  }
  return alternatives as readonly (readonly unknown[])[]
}

function normalizeStroke(value: unknown): CanonicalStroke {
  const stroke = recordOf(value, 'invalid custom shortcut key')
  if (typeof stroke.key !== 'string' || stroke.key.length === 0) throw new Error('invalid custom shortcut key')
  const key = normalizeKey(stroke.key)
  if (stroke.modifiers !== undefined) {
    if (!Array.isArray(stroke.modifiers)) throw new Error('invalid custom shortcut modifiers')
    if (['alt', 'ctrl', 'meta', 'shift'].some(name => name in stroke)) {
      throw new Error('declarative stroke cannot contain physical modifier flags')
    }
    const modifiers = stroke.modifiers.map(modifier => {
      if (typeof modifier !== 'string' || !MODIFIERS.has(modifier)) throw new Error('invalid custom shortcut modifier')
      return modifier as Modifier
    })
    if (new Set(modifiers).size !== modifiers.length) throw new Error('duplicate custom shortcut modifier')
    if (modifiers.includes('Ctrl') && modifiers.includes('Meta')) throw new Error('invalid custom shortcut modifier')
    if (modifiers.includes('Mod') && modifiers.some(modifier => modifier === 'Ctrl' || modifier === 'Meta')) {
      throw new Error('invalid custom shortcut modifier')
    }
    return { key, modifiers: sortModifiers(modifiers) }
  }

  if (!isPhysicalStroke(stroke)) throw new Error('invalid custom shortcut modifiers')
  if (stroke.ctrl && stroke.meta) throw new Error('invalid custom shortcut modifier')
  return {
    key,
    modifiers: sortModifiers([
      ...(stroke.ctrl ? ['Ctrl' as const] : []),
      ...(stroke.meta ? ['Meta' as const] : []),
      ...(stroke.alt ? ['Alt' as const] : []),
      ...(stroke.shift ? ['Shift' as const] : []),
    ]),
  }
}

function sortModifiers(modifiers: readonly Modifier[]): Modifier[] {
  return [...modifiers].sort((left, right) => MODIFIER_ORDER.indexOf(left) - MODIFIER_ORDER.indexOf(right))
}

function normalizeKey(key: string): string {
  const lower = key.toLowerCase()
  const aliases: Record<string, string> = {
    esc: 'Escape', escape: 'Escape', return: 'Enter', enter: 'Enter',
    spacebar: 'Space', space: 'Space', pageup: 'PageUp', pgup: 'PageUp',
    pagedown: 'PageDown', pgdn: 'PageDown', del: 'Delete', delete: 'Delete',
  }
  if (aliases[lower] !== undefined) return aliases[lower]
  return key.length === 1 ? lower : key
}

function isPrefix(first: CanonicalSequence, second: CanonicalSequence): boolean {
  const shorter = first.length <= second.length ? first : second
  const longer = shorter === first ? second : first
  return shorter.every((stroke, index) => stroke.key === longer[index]!.key
    && stroke.modifiers.length === longer[index]!.modifiers.length
    && stroke.modifiers.every((modifier, modifierIndex) => modifier === longer[index]!.modifiers[modifierIndex]))
}

function isPhysicalStroke(value: RecordValue): value is RecordValue & { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean } {
  return ['alt', 'ctrl', 'meta', 'shift'].every(field => typeof value[field] === 'boolean')
}

function recordOf(value: unknown, message: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message)
  return value as RecordValue
}
