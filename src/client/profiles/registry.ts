import type {
  KeyStroke, ShortcutBinding, ShortcutCommand, ShortcutModifier, ShortcutProfile, ShortcutScope, ShortcutStroke,
} from '../contract/profile.js'
import { LEGACY_CUSTOM_PROFILE_ID, normalizeCustomProfiles } from '../../custom-profile-contract.js'
import type { PersistedCustomShortcutProfile } from '../../custom-profile-contract.js'
import { DEFAULT_SHORTCUT_PROFILE_ID } from '../../profile-catalog.js'
import type { ShortcutProfileRegistry } from './types.js'
import { standardProfile, vimProfile } from './builtins.js'
import { normalizePersistedShortcutResult } from '../../shortcut-binding-contract.js'

const COMMANDS: readonly ShortcutCommand[] = [
  'focusPrevious',
  'focusNext',
  'activate',
  'cancelTask',
  'openCommandPalette',
  'openSettings',
  'startSession',
  'previousSession',
  'nextSession',
  'previousWorkspace',
  'nextWorkspace',
  'forkSession',
  'toggleTheme',
]

const SCOPES: readonly ShortcutScope[] = ['global', 'question', 'approval']
const MODIFIERS: readonly ShortcutModifier[] = ['Alt', 'Ctrl', 'Meta', 'Shift']
const LEGACY_CUSTOM_PROFILE_LABEL = 'profile.custom.label'
const CUSTOM_PROFILE_DESCRIPTION = 'profile.custom.description'

export interface NormalizedSequence {
  readonly strokes: readonly NormalizedStroke[]
}

export interface NormalizedStroke extends KeyStroke {
  readonly modifier?: ShortcutModifier
}

export function canonicalBindingKey(binding: ShortcutBinding): string {
  const sequence = normalizeBindingSequences(binding)[0]
  return sequence.strokes.length === 1 ? canonicalStrokeKey(sequence.strokes[0]!) : canonicalSequenceKey(sequence)
}

export function normalizeBindingSequences(binding: ShortcutBinding): NormalizedSequence[] {
  return normalizeBinding(binding)
}
export function canonicalSequenceKey(sequence: NormalizedSequence): string {
  return sequence.strokes.map(stroke => canonicalStrokeKey(stroke)).join(' ')
}

export function validateShortcutBindings(bindings: readonly ShortcutBinding[]): readonly ShortcutBinding[] {
  const result = normalizePersistedShortcutResult(bindings as unknown as readonly Record<string, unknown>[])
  return result.bindings as unknown as readonly ShortcutBinding[]
}

export function createBuiltinProfileRegistry(persistedId?: string): ShortcutProfileRegistry {
  return createProfileRegistry([standardProfile, vimProfile], DEFAULT_SHORTCUT_PROFILE_ID, persistedId)
}

export function createProfileRegistry(
  initialProfiles: readonly ShortcutProfile[],
  defaultId?: string,
  persistedId?: string,
): ShortcutProfileRegistry {
  if (initialProfiles.length === 0) {
    throw new Error('shortcut profile registry requires at least one profile')
  }

  const initialIds = new Set<string>()
  const normalizedInitialProfiles = initialProfiles.map(profile => {
    const normalized = validateAndNormalizeProfile(profile, initialIds)
    initialIds.add(profile.id)
    return normalized
  })
  const defaultProfileId = defaultId ?? normalizedInitialProfiles[0]!.id
  if (!initialIds.has(defaultProfileId)) {
    throw new Error(`unknown default shortcut profile: ${defaultProfileId}`)
  }

  let registeredProfiles: readonly ShortcutProfile[] = Object.freeze(normalizedInitialProfiles)
  let persistedCustomProfiles: readonly PersistedCustomShortcutProfile[] = Object.freeze([])
  let projectedCustomProfiles: readonly ShortcutProfile[] = Object.freeze([])
  let snapshot: readonly ShortcutProfile[] = registeredProfiles
  const standard = snapshot.find(profile => profile.id === DEFAULT_SHORTCUT_PROFILE_ID) ?? snapshot[0]!
  let activeId = persistedId !== undefined && initialIds.has(persistedId)
    ? persistedId
    : defaultProfileId
  const listeners = new Set<() => void>()
  const publishSnapshot = (): void => {
    snapshot = Object.freeze([...registeredProfiles, ...projectedCustomProfiles])
  }
  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }

  const registry: ShortcutProfileRegistry = {
    register(profile) {
      const normalized = validateAndNormalizeProfile(profile, new Set(snapshot.map(entry => entry.id)))
      registeredProfiles = Object.freeze([...registeredProfiles, normalized])
      publishSnapshot()
      notify()
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        if (!registeredProfiles.some(entry => entry.id === profile.id)) return
        registeredProfiles = Object.freeze(registeredProfiles.filter(entry => entry.id !== profile.id))
        publishSnapshot()
        if (activeId === profile.id) activeId = defaultProfileId
        notify()
      }
    },

    list() {
      return snapshot
    },

    get(id) {
      return snapshot.find(profile => profile.id === id)
    },

    active() {
      const active = snapshot.find(profile => profile.id === activeId)
      if (active === undefined) {
        throw new Error(`active shortcut profile is unavailable: ${activeId}`)
      }
      return active
    },

    setActive(id) {
      if (snapshot.every(profile => profile.id !== id)) {
        throw new Error(`unknown shortcut profile: ${id}`)
      }
      if (activeId === id) return
      activeId = id
      notify()
    },

    replaceCustomProfiles(profiles) {
      const normalized = normalizeCustomProfiles(profiles)
      const nextPersistedProfiles = Object.freeze(normalized.map(freezePersistedCustomProfile))
      const existingIds = new Set(registeredProfiles.map(profile => profile.id))
      const nextProjectedProfiles = Object.freeze(nextPersistedProfiles.map(profile => {
        const projected = validateAndNormalizeProfile({
          id: profile.id,
          label: profile.name ?? LEGACY_CUSTOM_PROFILE_LABEL,
          description: CUSTOM_PROFILE_DESCRIPTION,
          bindings: profile.bindings as unknown as readonly ShortcutBinding[],
        }, existingIds)
        existingIds.add(profile.id)
        return projected
      }))

      persistedCustomProfiles = nextPersistedProfiles
      projectedCustomProfiles = nextProjectedProfiles
      publishSnapshot()
      if (snapshot.every(profile => profile.id !== activeId)) activeId = standard.id
      notify()
    },

    customProfiles() {
      return persistedCustomProfiles
    },

    replaceCustom(bindings) {
      registry.replaceCustomProfiles([{
        id: LEGACY_CUSTOM_PROFILE_ID,
        bindings: bindings as unknown as PersistedCustomShortcutProfile['bindings'],
      }])
    },

    custom() {
      return snapshot.find(profile => profile.id === 'custom')?.bindings ?? standard.bindings
    },

    subscribe(listener) {
      listeners.add(listener)
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        listeners.delete(listener)
      }
    },
  }

  return registry
}

function freezePersistedCustomProfile(profile: PersistedCustomShortcutProfile): PersistedCustomShortcutProfile {
  return freezeJsonValue(profile)
}

function freezeJsonValue<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeJsonValue)) as T
  if (typeof value === 'object' && value !== null) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, freezeJsonValue(child)]),
    )) as T
  }
  return value
}

function validateAndNormalizeProfile(
  profile: ShortcutProfile,
  existingIds: ReadonlySet<string>,
): ShortcutProfile {
  if (typeof profile.id !== 'string' || profile.id.length === 0 || profile.id.trim() !== profile.id) {
    throw new Error('shortcut profile id must be a non-empty string')
  }
  if (existingIds.has(profile.id)) {
    throw new Error(`duplicate shortcut profile: ${profile.id}`)
  }
  if (!Array.isArray(profile.bindings) || profile.bindings.length === 0) {
    throw new Error(`shortcut profile ${profile.id} must define bindings`)
  }

  const bindings = profile.bindings.map(normalizeBinding)
  validateConflicts(profile.bindings)
  return freezeProfile({ ...profile, bindings: normalizeProfileBindings(profile.bindings, bindings) })
}

function normalizeBinding(binding: ShortcutBinding): NormalizedSequence[] {
  const legacyModifier = (binding as ShortcutBinding & { readonly modifier?: string }).modifier
  const shapeCount = Number(binding.sequence !== undefined)
    + Number(binding.sequences !== undefined)
  if (shapeCount > 0 && binding.key !== undefined) {
    throw new Error('ambiguous shortcut binding shape')
  }
  if (binding.sequence !== undefined && binding.sequences !== undefined) {
    throw new Error('ambiguous shortcut binding shape')
  }
  if (!COMMANDS.includes(binding.command)) {
    throw new Error(`invalid shortcut command: ${String(binding.command)}`)
  }
  if (!SCOPES.includes(binding.scope)) {
    throw new Error(`invalid shortcut scope: ${String(binding.scope)}`)
  }
  if (legacyModifier !== undefined && !MODIFIERS.includes(legacyModifier as ShortcutModifier)) {
    throw new Error(`invalid shortcut modifier: ${String(legacyModifier)}`)
  }
  const rawSequences = binding.sequences !== undefined
    ? binding.sequences
    : binding.sequence !== undefined
      ? [binding.sequence]
      : binding.key !== undefined
        ? [[binding.key]]
        : []

  if (rawSequences.length === 0 || rawSequences.some(sequence => sequence.length < 1 || sequence.length > 2)) {
    throw new Error(`invalid shortcut key in profile: ${binding.scope}`)
  }
  return rawSequences.map(sequence => ({
    strokes: sequence.map(stroke => normalizeStroke(stroke, legacyModifier as ShortcutModifier | undefined)),
  }))
}

function normalizeProfileBindings(
  source: readonly ShortcutBinding[],
  normalized: readonly NormalizedSequence[][],
): ShortcutBinding[] {
  return source.map((binding, index) => {
    const bindingSequences = normalized[index]!
    const first = bindingSequences[0]!.strokes[0]!
    const normalizeStrokeValue = (original: KeyStroke | ShortcutStroke, stroke: NormalizedStroke): KeyStroke | ShortcutStroke => (
      isShortcutStroke(original)
        ? { key: stroke.key, modifiers: symbolicModifiers(stroke) }
        : { key: stroke.key, alt: stroke.alt, ctrl: stroke.ctrl, meta: stroke.meta, shift: stroke.shift }
    )
    return {
      ...binding,
      ...(binding.key ? { key: normalizeStrokeValue(binding.key, first) } : {}),
      ...(binding.sequence ? { sequence: bindingSequences[0]!.strokes.map((stroke, strokeIndex) => normalizeStrokeValue(binding.sequence![strokeIndex]!, stroke)) } : {}),
      ...(binding.sequences ? {
        sequences: binding.sequences.map((sequence, sequenceIndex) => sequence.map((stroke, strokeIndex) => normalizeStrokeValue(
          stroke,
          normalized[index]![sequenceIndex]!.strokes[strokeIndex]!,
        ))),
      } : {}),
    }
  })
}

function symbolicModifiers(stroke: NormalizedStroke): ShortcutModifier[] {
  return [
    ...(stroke.ctrl ? ['Ctrl' as const] : []),
    ...(stroke.meta ? ['Meta' as const] : []),
    ...(stroke.alt ? ['Alt' as const] : []),
    ...(stroke.shift ? ['Shift' as const] : []),
  ]
}

function normalizeStroke(stroke: KeyStroke | ShortcutStroke, modifier?: ShortcutModifier): NormalizedStroke {
  if (isShortcutStroke(stroke)) {
    const modifiers = normalizeModifiers(stroke.modifiers)
    return {
      key: normalizeKey(stroke.key),
      alt: modifiers.includes('Alt'),
      ctrl: modifiers.includes('Ctrl'),
      meta: modifiers.includes('Meta'),
      shift: modifiers.includes('Shift'),
      ...(modifiers.includes('Ctrl') ? { modifier: 'Ctrl' as const } : modifiers.includes('Meta') ? { modifier: 'Meta' as const } : {}),
    }
  }
  if (!isKeyStroke(stroke)) {
    throw new Error('invalid shortcut key')
  }
  if (modifier === 'Meta' && stroke.ctrl && stroke.meta) {
    throw new Error('invalid shortcut modifier')
  }
  if ((modifier === 'Alt' && (!stroke.alt || stroke.ctrl || stroke.meta || stroke.shift))
    || (modifier === 'Shift' && (!stroke.shift || stroke.ctrl || stroke.meta || stroke.alt))
    || (modifier === 'Ctrl' && (!stroke.ctrl || stroke.meta || stroke.alt || stroke.shift))
    || (modifier === 'Meta' && (!stroke.meta || stroke.ctrl || stroke.alt || stroke.shift))) {
    throw new Error('invalid shortcut modifier')
  }
  return {
    ...stroke,
    key: normalizeKey(stroke.key),
    ...(modifier ? { modifier } : {}),
  }
}

function normalizeModifiers(modifiers: readonly ShortcutModifier[]): ShortcutModifier[] {
  if (!Array.isArray(modifiers) || modifiers.length === 0) throw new Error('invalid shortcut modifier')
  const normalized = modifiers.map(modifier => modifier as ShortcutModifier)
  if (normalized.some(modifier => !MODIFIERS.includes(modifier))) throw new Error('invalid shortcut modifier')
  if (new Set(normalized).size !== normalized.length) throw new Error('invalid shortcut modifier')
  return normalized
}

function normalizeKey(key: string): string {
  if (key === 'Esc') return 'Escape'
  return key.length === 1 ? key.toLowerCase() : key
}

function isShortcutStroke(value: unknown): value is ShortcutStroke {
  return typeof value === 'object' && value !== null && 'modifiers' in value
}

function validateConflicts(bindings: readonly ShortcutBinding[]): void {
  const entries = bindings.flatMap(binding => normalizeBinding(binding).map(sequence => ({ binding, sequence })))
  for (let index = 0; index < entries.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
      const first = entries[index]!
      const second = entries[otherIndex]!
      if (first.binding.scope !== second.binding.scope) continue
      if (isPrefixConflict(first.sequence, second.sequence)) {
        throw new Error(`shortcut binding conflict: ${canonicalSequenceKey(first.sequence)}`)
      }
    }
  }
}

function isPrefixConflict(first: NormalizedSequence, second: NormalizedSequence): boolean {
  const shorter = first.strokes.length <= second.strokes.length ? first : second
  const longer = shorter === first ? second : first
  return shorter.strokes.every((stroke, index) => equivalentStroke(stroke, longer.strokes[index]!))
}

function equivalentStroke(first: NormalizedStroke, second: NormalizedStroke): boolean {
  return first.key === second.key
    && first.alt === second.alt
    && first.shift === second.shift
    && equivalentModifier(first, second)
}

function equivalentModifier(first: NormalizedStroke, second: NormalizedStroke): boolean {
  return first.ctrl === second.ctrl && first.meta === second.meta
}

function canonicalStrokeKey(stroke: NormalizedStroke): string {
  const modifier = [stroke.ctrl ? 'ctrl' : '', stroke.meta ? 'meta' : ''].join('|')
  return [stroke.alt ? 'alt' : '', modifier, stroke.shift ? 'shift' : '', stroke.key].join('|')
}

function isKeyStroke(value: unknown): value is KeyStroke {
  if (typeof value !== 'object' || value === null) return false
  const stroke = value as Partial<KeyStroke>
  return typeof stroke.key === 'string'
    && stroke.key.length > 0
    && typeof stroke.alt === 'boolean'
    && typeof stroke.ctrl === 'boolean'
    && typeof stroke.meta === 'boolean'
    && typeof stroke.shift === 'boolean'
}

function freezeProfile(profile: ShortcutProfile): ShortcutProfile {
  const bindings = profile.bindings.map(binding => Object.freeze({
    ...binding,
    ...(binding.key ? { key: Object.freeze({ ...binding.key }) } : {}),
    ...(binding.sequence ? {
      sequence: Object.freeze(binding.sequence.map(stroke => Object.freeze({ ...stroke }))),
    } : {}),
    ...(binding.sequences ? {
      sequences: Object.freeze(binding.sequences.map(sequence => Object.freeze(
        sequence.map(stroke => Object.freeze({ ...stroke })),
      ))),
    } : {}),
  }))
  return Object.freeze({ ...profile, bindings: Object.freeze(bindings) })
}
