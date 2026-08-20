import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import {
  DEFAULT_SHORTCUT_PROFILE_ID,
} from './profile-catalog.js'

export const SHORTCUTS_SETTINGS_NAMESPACE = settingsNamespace('dsh-ui-shortcuts')

/** Persisted shortcut settings for the active profile selection. */
export interface ShortcutSettings {
  readonly activeProfile: string
}

/** Schema and defaults for the shortcut settings namespace. */
export const ShortcutSettingsSchema: z<ShortcutSettings> = z.object({
  activeProfile: z.string().default(DEFAULT_SHORTCUT_PROFILE_ID),
})
