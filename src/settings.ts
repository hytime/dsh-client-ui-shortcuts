import z from '@deepseek-ai/schemastery'
import { DEFAULT_SHORTCUT_PROFILE_ID } from './profile-catalog.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

export { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

/** One lossless persisted binding before semantic validation. */
export type PersistedShortcutBinding = { readonly [key: string]: unknown }

/** Persisted shortcut settings for the active profile selection and custom bindings. */
export interface ShortcutSettings {
  readonly activeProfile: string
  readonly customBindings: PersistedShortcutBinding[]
}

const jsonObject = z.dict(z.any())

const defaultCustomBindings: PersistedShortcutBinding[] = [
  { command: 'openCommandPalette', scope: 'global', key: { key: 'p', modifiers: ['Mod'] } },
  { command: 'openSettings', scope: 'global', key: { key: ',', modifiers: ['Mod'] } },
  { command: 'focusPrevious', scope: 'question', key: { key: 'ArrowUp', modifiers: [] } },
  { command: 'focusNext', scope: 'question', key: { key: 'ArrowDown', modifiers: [] } },
  { command: 'activate', scope: 'question', key: { key: 'Enter', modifiers: [] } },
  { command: 'activate', scope: 'approval', key: { key: 'Enter', modifiers: [] } },
  { command: 'focusPrevious', scope: 'approval', key: { key: 'ArrowUp', modifiers: [] } },
  { command: 'focusNext', scope: 'approval', key: { key: 'ArrowDown', modifiers: [] } },
  { command: 'cancelTask', scope: 'question', key: { key: 'Escape', modifiers: [] } },
  { command: 'cancelTask', scope: 'approval', key: { key: 'Escape', modifiers: [] } },
]

/** Schema and defaults for the shortcut settings namespace. */
export const ShortcutSettingsSchema: z<ShortcutSettings> = z.object({
  activeProfile: z.string().default(DEFAULT_SHORTCUT_PROFILE_ID),
  customBindings: z.array(jsonObject).default(defaultCustomBindings),
})

export function defaultShortcutBindings(): readonly PersistedShortcutBinding[] {
  return defaultCustomBindings
}
