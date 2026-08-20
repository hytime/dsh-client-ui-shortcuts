import z from '@deepseek-ai/schemastery'
import {
  DEFAULT_SHORTCUT_PROFILE_ID,
} from './profile-catalog.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

export { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

/** Persisted shortcut settings for the active profile selection. */
export interface ShortcutSettings {
  readonly activeProfile: string
}

/** Schema and defaults for the shortcut settings namespace. */
export const ShortcutSettingsSchema: z<ShortcutSettings> = z.object({
  activeProfile: z.string().default(DEFAULT_SHORTCUT_PROFILE_ID),
})
