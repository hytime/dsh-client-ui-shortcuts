import type {
  KeyStroke, ShortcutBinding, ShortcutCommand, ShortcutProfile, ShortcutScope,
} from '../contract/profile.js'
import type { ShortcutProfileRegistry } from './types.js'

const COMMANDS: readonly ShortcutCommand[] = [
  'focusPrevious',
  'focusNext',
  'activate',
  'cancelTask',
]
const SCOPES: readonly ShortcutScope[] = ['question', 'approval']

/**
 * Build one stable canonical key for conflict checks.
 * @param binding - binding to identify.
 * @returns scope-qualified modifier/key identity.
 */
export function canonicalBindingKey(binding: ShortcutBinding): string {
  const { key } = binding
  return [
    binding.scope,
    key.alt ? 'alt' : '',
    key.ctrl ? 'ctrl' : '',
    key.meta ? 'meta' : '',
    key.shift ? 'shift' : '',
    key.key,
  ].join('|')
}

/**
 * Create a profile registry with immutable snapshots and one active profile.
 * @param initialProfiles - profiles available at construction time.
 * @param defaultId - optional profile id used for active fallback.
 * @returns an isolated profile registry.
 */
export function createProfileRegistry(
  initialProfiles: readonly ShortcutProfile[],
  defaultId?: string,
): ShortcutProfileRegistry {
  if (initialProfiles.length === 0) {
    throw new Error('shortcut profile registry requires at least one profile')
  }

  const initialIds = new Set<string>()
  const profiles = initialProfiles.map((profile) => {
    validateProfile(profile, initialIds)
    initialIds.add(profile.id)
    return freezeProfile(profile)
  })
  const defaultProfileId = defaultId ?? profiles[0]!.id
  if (!initialIds.has(defaultProfileId)) {
    throw new Error(`unknown default shortcut profile: ${defaultProfileId}`)
  }

  let snapshot: readonly ShortcutProfile[] = Object.freeze(profiles)
  let activeId = defaultProfileId
  const listeners = new Set<() => void>()

  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }

  const registry: ShortcutProfileRegistry = {
    register(profile) {
      validateProfile(profile, new Set(snapshot.map(entry => entry.id)))
      const frozen = freezeProfile(profile)
      snapshot = Object.freeze([...snapshot, frozen])
      notify()
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

function validateProfile(profile: ShortcutProfile, existingIds: ReadonlySet<string>): void {
  if (typeof profile.id !== 'string' || profile.id.length === 0 || profile.id.trim() !== profile.id) {
    throw new Error('shortcut profile id must be a non-empty string')
  }
  if (existingIds.has(profile.id)) {
    throw new Error(`duplicate shortcut profile: ${profile.id}`)
  }
  if (!Array.isArray(profile.bindings) || profile.bindings.length === 0) {
    throw new Error(`shortcut profile ${profile.id} must define bindings`)
  }

  const keys = new Set<string>()
  for (const binding of profile.bindings) {
    if (!isCommand(binding.command)) throw new Error(`invalid shortcut command: ${String(binding.command)}`)
    if (!isScope(binding.scope)) throw new Error(`invalid shortcut scope: ${String(binding.scope)}`)
    if (!isKeyStroke(binding.key)) throw new Error(`invalid shortcut key in profile: ${profile.id}`)
    const canonical = canonicalBindingKey(binding)
    if (keys.has(canonical)) throw new Error(`shortcut binding conflict: ${canonical}`)
    keys.add(canonical)
  }
}

function isCommand(value: unknown): value is ShortcutCommand {
  return typeof value === 'string' && COMMANDS.includes(value as ShortcutCommand)
}

function isScope(value: unknown): value is ShortcutScope {
  return typeof value === 'string' && SCOPES.includes(value as ShortcutScope)
}

function isKeyStroke(value: unknown): value is KeyStroke {
  if (typeof value !== 'object' || value === null) return false
  const key = value as Partial<KeyStroke>
  return typeof key.key === 'string'
    && key.key.length > 0
    && typeof key.alt === 'boolean'
    && typeof key.ctrl === 'boolean'
    && typeof key.meta === 'boolean'
    && typeof key.shift === 'boolean'
}

function freezeProfile(profile: ShortcutProfile): ShortcutProfile {
  const bindings = profile.bindings.map(binding => Object.freeze({
    ...binding,
    key: Object.freeze({ ...binding.key }),
  }))
  return Object.freeze({ ...profile, bindings: Object.freeze(bindings) })
}
