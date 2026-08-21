export const SHORTCUT_COMMANDS = ['focusPrevious', 'focusNext', 'activate', 'cancelTask', 'openCommandPalette', 'openSettings'] as const
export const SHORTCUT_SCOPES = ['global', 'question', 'approval'] as const
export const SHORTCUT_MODIFIERS = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'] as const

export type PersistedShortcutBinding = { readonly [key: string]: unknown }
export type ShortcutModifier = (typeof SHORTCUT_MODIFIERS)[number]
export type CanonicalShortcutStroke = { readonly key: string; readonly modifiers: readonly ShortcutModifier[] }
export type CanonicalShortcutSequence = readonly CanonicalShortcutStroke[]
export type CanonicalShortcutBinding = {
  readonly command: (typeof SHORTCUT_COMMANDS)[number]
  readonly scope: (typeof SHORTCUT_SCOPES)[number]
  readonly sequences: readonly CanonicalShortcutSequence[]
}

const MODIFIER_ORDER: readonly ShortcutModifier[] = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift']

/** Normalize and validate persisted bindings at the Host/Client contract boundary. */
export function normalizePersistedShortcutBindings(bindings: readonly PersistedShortcutBinding[]): readonly CanonicalShortcutBinding[] {
  if (!Array.isArray(bindings) || bindings.length === 0) throw new Error('customBindings must be a non-empty array')
  const normalized: CanonicalShortcutBinding[] = []
  for (const value of bindings) {
    assertJsonSafe(value)
    const binding = recordOf(value, 'invalid custom shortcut binding')
    if (typeof binding.command !== 'string' || !SHORTCUT_COMMANDS.includes(binding.command as never)) {
      throw new Error('invalid custom shortcut command')
    }
    if (typeof binding.scope !== 'string' || !SHORTCUT_SCOPES.includes(binding.scope as never)) {
      throw new Error('invalid custom shortcut scope')
    }
    const sequences = sequencesOf(binding).map(sequence => {
      if (sequence.length < 1 || sequence.length > 2) throw new Error('custom shortcut sequences must contain one or two strokes')
      return sequence.map(normalizePersistedStroke)
    })
    normalized.push({
      command: binding.command as CanonicalShortcutBinding['command'],
      scope: binding.scope as CanonicalShortcutBinding['scope'],
      sequences,
    })
  }
  for (let index = 0; index < normalized.length; index += 1) {
    for (let other = index + 1; other < normalized.length; other += 1) {
      const first = normalized[index]!
      const second = normalized[other]!
      if (first.scope !== second.scope) continue
      for (const left of first.sequences) {
        for (const right of second.sequences) {
          if (isPrefix(left, right)) throw new Error(`shortcut conflict in scope: ${first.scope}`)
        }
      }
    }
  }
  return normalized
}

export interface NormalizedPersistedShortcutResult {
  readonly canonical: readonly CanonicalShortcutBinding[]
  readonly bindings: readonly PersistedShortcutBinding[]
}

export function normalizePersistedShortcutResult(bindings: readonly PersistedShortcutBinding[]): NormalizedPersistedShortcutResult {
  const canonical = normalizePersistedShortcutBindings(bindings)
  return { canonical, bindings: canonical.map((binding, index) => preserveBindingShape(bindings[index]!, binding)) }
}

export function validatePersistedShortcutBindings(bindings: readonly PersistedShortcutBinding[]): void {
  normalizePersistedShortcutBindings(bindings)
}

function preserveBindingShape(source: PersistedShortcutBinding, canonical: CanonicalShortcutBinding): PersistedShortcutBinding {
  const sourceSequences = source.key !== undefined
    ? [[source.key]]
    : source.sequence !== undefined
      ? [source.sequence as readonly unknown[]]
      : source.sequences as readonly (readonly unknown[])[]
  const normalizeStroke = (original: unknown, stroke: CanonicalShortcutStroke): Record<string, unknown> => {
    const physical = typeof original === 'object' && original !== null && 'alt' in original
    return physical
      ? { key: stroke.key, alt: stroke.modifiers.includes('Alt'), ctrl: stroke.modifiers.includes('Ctrl'), meta: stroke.modifiers.includes('Meta'), shift: stroke.modifiers.includes('Shift') }
      : { key: stroke.key, modifiers: stroke.modifiers }
  }
  const normalizedSequences = canonical.sequences.map((sequence, sequenceIndex) => sequence.map((stroke, strokeIndex) => (
    normalizeStroke(sourceSequences[sequenceIndex]![strokeIndex], stroke)
  )))
  if (source.key !== undefined) return { ...source, key: normalizedSequences[0]![0] }
  if (source.sequence !== undefined) return { ...source, sequence: normalizedSequences[0] }
  return { ...source, sequences: normalizedSequences }
}

function sequencesOf(binding: Record<string, unknown>): readonly (readonly unknown[])[] {
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

function normalizePersistedStroke(value: unknown): CanonicalShortcutStroke {
  const stroke = recordOf(value, 'invalid custom shortcut key')
  if (typeof stroke.key !== 'string' || stroke.key.length === 0) throw new Error('invalid custom shortcut key')
  const key = normalizeKey(stroke.key)
  if (stroke.modifiers !== undefined) {
    if (!Array.isArray(stroke.modifiers)) throw new Error('invalid custom shortcut modifiers')
    if (['alt', 'ctrl', 'meta', 'shift'].some(name => name in stroke)) {
      throw new Error('declarative stroke cannot contain physical modifier flags')
    }
    const modifiers = stroke.modifiers.map(modifier => {
      if (typeof modifier !== 'string' || !SHORTCUT_MODIFIERS.includes(modifier as never)) throw new Error('invalid custom shortcut modifier')
      return modifier as ShortcutModifier
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

function sortModifiers(modifiers: readonly ShortcutModifier[]): ShortcutModifier[] {
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

function isPrefix(first: CanonicalShortcutSequence, second: CanonicalShortcutSequence): boolean {
  const shorter = first.length <= second.length ? first : second
  const longer = shorter === first ? second : first
  return shorter.every((stroke, index) => stroke.key === longer[index]!.key
    && stroke.modifiers.length === longer[index]!.modifiers.length
    && stroke.modifiers.every((modifier, modifierIndex) => modifier === longer[index]!.modifiers[modifierIndex]))
}

function isPhysicalStroke(value: Record<string, unknown>): value is Record<string, unknown> & { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean } {
  return ['alt', 'ctrl', 'meta', 'shift'].every(field => typeof value[field] === 'boolean')
}

function assertJsonSafe(value: unknown, seen = new Set<object>()): void {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new Error('custom shortcut bindings must contain JSON values')
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('custom shortcut bindings must contain JSON values')
  if (typeof value !== 'object' || value === null) return
  if (seen.has(value)) throw new Error('custom shortcut bindings must contain JSON values')
  if (Array.isArray(value)) {
    seen.add(value)
    for (const item of value) assertJsonSafe(item, seen)
    seen.delete(value)
    return
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error('custom shortcut bindings must contain plain JSON objects')
  }
  seen.add(value)
  for (const child of Object.values(value)) assertJsonSafe(child, seen)
  seen.delete(value)
}

function recordOf(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message)
  return value as Record<string, unknown>
}
