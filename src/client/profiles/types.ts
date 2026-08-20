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
  /** Subscribe to profile registration, removal, or active changes. */
  subscribe(listener: () => void): () => void
}
