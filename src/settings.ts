import z from '@deepseek-ai/schemastery'

/** Only opt-in presentation preferences belong to this plugin. Keybindings belong to DSH. */
export interface ShortcutSettings {
  readonly questionEnabled: boolean
  readonly approvalEnabled: boolean
}

export const ShortcutSettingsSchema = z.object({
  questionEnabled: z.boolean().default(false),
  approvalEnabled: z.boolean().default(false),
})

export { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'
