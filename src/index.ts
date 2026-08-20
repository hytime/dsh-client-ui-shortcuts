/** Host entry for the shortcuts package; settings registration is added in task 4. */

/** Settings namespace reserved by the browser profile card. */
export const SHORTCUTS_SETTINGS_NAMESPACE = 'shortcuts' as const

/**
 * Empty Host plugin until the settings service is wired.
 * @returns nothing because task 1 has no Host side effect.
 */
export function apply(): void {}
