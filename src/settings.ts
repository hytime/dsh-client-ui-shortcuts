import z from '@deepseek-ai/schemastery'
import {
  DEFAULT_SHORTCUT_PROFILE_ID,
} from './profile-catalog.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'
import type { ShortcutBinding } from './client/contract/profile.js'

export { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

/** Persisted shortcut settings for the active profile selection and custom bindings. */
export interface ShortcutSettings {
  readonly activeProfile: string
  readonly customBindings: readonly ShortcutBinding[]
}

const modifier = z.union(['Mod', 'Alt', 'Ctrl', 'Meta', 'Shift'])
const jsonValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.never(),
  z.array(z.never()),
  z.object({}),
])
const binding = z.object({
  command: jsonValue,
  scope: jsonValue,
  key: z.object({}),
  sequence: z.array(z.object({})),
  sequences: z.array(z.array(z.object({}))),
})
const defaultCustomBindings: readonly ShortcutBinding[] = [
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
  customBindings: z.array(binding).default(defaultCustomBindings as unknown as never[]),
}) as unknown as z<ShortcutSettings>

export function defaultShortcutBindings(): readonly ShortcutBinding[] {
  return defaultCustomBindings
}
