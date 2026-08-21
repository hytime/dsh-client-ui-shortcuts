import type { ShortcutProfile } from '../contract/profile.js'

/** Mutable browser registry face for shortcut profiles. */
export interface ShortcutProfileRegistry {
  /** Register one profile and return its idempotent disposer. */
  register(profile: ShortcutProfile): () => void
  /** Return the current immutable profile snapshot. */
  list(): readonly ShortcutProfile[]
  /** Find one profile by id. */
  get(id: string): ShortcutProfile | undefined
  /** Return the currently active profile. */
  active(): ShortcutProfile
  /** Select an existing profile by id. */
  setActive(id: string): void
  /** Replace the persisted custom profile bindings atomically. */
  replaceCustom(bindings: readonly import('../contract/profile.js').ShortcutBinding[]): void
  /** Return the current custom profile bindings, falling back to standard. */
  custom(): readonly import('../contract/profile.js').ShortcutBinding[]
  /** Subscribe to profile registration, removal, or active changes. */
  subscribe(listener: () => void): () => void
}
