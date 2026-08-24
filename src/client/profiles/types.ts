import type { PersistedCustomShortcutProfile } from '../../custom-profile-contract.js'
import type { ShortcutBinding, ShortcutProfile } from '../contract/profile.js'

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
  /** Replace all persisted custom profiles atomically. */
  replaceCustomProfiles(profiles: readonly PersistedCustomShortcutProfile[]): void
  /** Return the current immutable persisted custom profile snapshot. */
  customProfiles(): readonly PersistedCustomShortcutProfile[]
  /** Replace the legacy persisted custom profile bindings atomically. */
  replaceCustom(bindings: readonly ShortcutBinding[]): void
  /** Return the legacy custom profile bindings, falling back to standard. */
  custom(): readonly ShortcutBinding[]
  /** Subscribe to profile registration, removal, or active changes. */
  subscribe(listener: () => void): () => void
}
