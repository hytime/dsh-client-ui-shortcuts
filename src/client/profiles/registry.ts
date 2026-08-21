import type {
  KeyStroke, ShortcutBinding, ShortcutCommand, ShortcutProfile, ShortcutScope,
} from '../contract/profile.js'
import { DEFAULT_SHORTCUT_PROFILE_ID } from '../../profile-catalog.js'
import type { ShortcutProfileRegistry } from './types.js'
import { standardProfile, vimProfile } from './builtins.js'

const COMMANDS: readonly ShortcutCommand[] = [
  'focusPrevious', 'focusNext', 'activate', 'cancelTask', 'openCommandPalette', 'openSettings',
]
const SCOPES: readonly ShortcutScope[] = ['global', 'question', 'approval']

export function canonicalBindingKey(binding: ShortcutBinding): string {
  return sequencesFor(binding).map(sequence => sequence.map(keyStrokeKey).join(' ')).join(' || ')
}

export function createBuiltinProfileRegistry(persistedId?: string): ShortcutProfileRegistry {
  return createProfileRegistry([standardProfile, vimProfile], DEFAULT_SHORTCUT_PROFILE_ID, persistedId)
}

export function createProfileRegistry(
  initialProfiles: readonly ShortcutProfile[], defaultId?: string, persistedId?: string,
): ShortcutProfileRegistry {
  if (initialProfiles.length === 0) throw new Error('shortcut profile registry requires at least one profile')
  const initialIds = new Set<string>()
  const profiles = initialProfiles.map(profile => {
    validateProfile(profile, initialIds)
    initialIds.add(profile.id)
    return freezeProfile(profile)
  })
  const defaultProfileId = defaultId ?? profiles[0]!.id
  if (!initialIds.has(defaultProfileId)) throw new Error(`unknown default shortcut profile: ${defaultProfileId}`)
  let snapshot: readonly ShortcutProfile[] = Object.freeze(profiles)
  let activeId = persistedId !== undefined && initialIds.has(persistedId) ? persistedId : defaultProfileId
  const listeners = new Set<() => void>()
  const notify = (): void => { for (const listener of [...listeners]) listener() }
  const registry: ShortcutProfileRegistry = {
    register(profile) {
      validateProfile(profile, new Set(snapshot.map(entry => entry.id)))
      const frozen = freezeProfile(profile)
      snapshot = Object.freeze([...snapshot, frozen]); notify()
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        const index = snapshot.findIndex(entry => entry.id === profile.id)
        if (index < 0) return
        snapshot = Object.freeze(snapshot.filter(entry => entry.id !== profile.id))
        if (activeId === profile.id) activeId = defaultProfileId
        notify()
      }
    },
    list: () => snapshot,
    get: id => snapshot.find(profile => profile.id === id),
    active: () => {
      const active = snapshot.find(profile => profile.id === activeId)
      if (active === undefined) throw new Error(`active shortcut profile is unavailable: ${activeId}`)
      return active
    },
    setActive(id) {
      if (snapshot.every(profile => profile.id !== id)) throw new Error(`unknown shortcut profile: ${id}`)
      if (activeId === id) return
      activeId = id; notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      let disposed = false
      return () => { if (disposed) return; disposed = true; listeners.delete(listener) }
    },
  }
  return registry
}

function validateProfile(profile: ShortcutProfile, existingIds: ReadonlySet<string>): void {
  if (typeof profile.id !== 'string' || profile.id.length === 0 || profile.id.trim() !== profile.id) throw new Error('shortcut profile id must be a non-empty string')
  if (existingIds.has(profile.id)) throw new Error(`duplicate shortcut profile: ${profile.id}`)
  if (!Array.isArray(profile.bindings) || profile.bindings.length === 0) throw new Error(`shortcut profile ${profile.id} must define bindings`)
  const keys = new Set<string>()
  for (const binding of profile.bindings) {
    if (!COMMANDS.includes(binding.command)) throw new Error(`invalid shortcut command: ${String(binding.command)}`)
    if (!SCOPES.includes(binding.scope)) throw new Error(`invalid shortcut scope: ${String(binding.scope)}`)
    const sequences = sequencesFor(binding)
    if (sequences.length === 0 || sequences.some(sequence => sequence.length < 1 || sequence.length > 2 || sequence.some(key => !isKeyStroke(key)))) throw new Error(`invalid shortcut key in profile: ${profile.id}`)
    for (const sequence of sequences) {
      const canonical = `${binding.scope}|${sequence.map(keyStrokeKey).join(' ')}`
      for (const prior of keys) {
        if (prior === canonical || prior.startsWith(`${canonical} `) || canonical.startsWith(`${prior} `)) throw new Error(`shortcut binding conflict: ${canonical}`)
      }
      keys.add(canonical)
    }
  }
}

function sequencesFor(binding: ShortcutBinding): readonly (readonly KeyStroke[])[] {
  if (binding.sequences) return binding.sequences
  if (binding.sequence) return [binding.sequence]
  if (binding.key) return [[binding.key]]
  return []
}

function keyStrokeKey(key: KeyStroke): string {
  return [key.alt ? 'alt' : '', key.ctrl ? 'ctrl' : '', key.meta ? 'meta' : '', key.shift ? 'shift' : '', key.key === 'Esc' ? 'Escape' : key.key].join('|')
}

function isKeyStroke(value: unknown): value is KeyStroke {
  if (typeof value !== 'object' || value === null) return false
  const key = value as Partial<KeyStroke>
  return typeof key.key === 'string' && key.key.length > 0 && typeof key.alt === 'boolean' && typeof key.ctrl === 'boolean' && typeof key.meta === 'boolean' && typeof key.shift === 'boolean'
}

function freezeProfile(profile: ShortcutProfile): ShortcutProfile {
  const bindings = profile.bindings.map(binding => Object.freeze({
    ...binding,
    ...(binding.key ? { key: Object.freeze({ ...binding.key }) } : {}),
    ...(binding.sequence ? { sequence: Object.freeze(binding.sequence.map(key => Object.freeze({ ...key }))) } : {}),
    ...(binding.sequences ? { sequences: Object.freeze(binding.sequences.map(sequence => Object.freeze(sequence.map(key => Object.freeze({ ...key }))))) } : {}),
  }))
  return Object.freeze({ ...profile, bindings: Object.freeze(bindings) })
}
