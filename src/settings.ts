import z from '@deepseek-ai/schemastery'

/** No plugin-owned settings remain: keybindings and every preference belong to DSH. */
export interface ShortcutSettings {}

export const ShortcutSettingsSchema = z.object({})

export { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'
