/** Shared profile ids used by the Host settings namespace and browser registry. */
export const SHORTCUT_PROFILE_IDS = ['standard', 'vim'] as const

/** Built-in shortcut profile id. */
export type ShortcutProfileId = (typeof SHORTCUT_PROFILE_IDS)[number]

/** Profile selected when no persisted value exists. */
export const DEFAULT_SHORTCUT_PROFILE_ID: ShortcutProfileId = 'standard'

/**
 * Check whether a persisted value names one of the built-in profiles.
 * @param value - persisted profile id.
 * @returns true when value is a built-in profile id.
 */
export function isShortcutProfileId(value: string): value is ShortcutProfileId {
  return (SHORTCUT_PROFILE_IDS as readonly string[]).includes(value)
}
