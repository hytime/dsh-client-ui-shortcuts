import z from '@deepseek-ai/schemastery'
import { DEFAULT_SHORTCUT_PROFILE_ID } from './profile-catalog.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

import type { PersistedShortcutBinding } from './shortcut-binding-contract.js'

export type { PersistedShortcutBinding } from './shortcut-binding-contract.js'

export { SHORTCUTS_SETTINGS_NAMESPACE } from './settings-namespace.js'

/** Persisted shortcut settings for the active profile selection and custom bindings. */
export interface ShortcutSettings {
  readonly activeProfile: string
  readonly customBindings: PersistedShortcutBinding[]
  readonly customProfiles?: unknown[]
}

const jsonArray = z.array(z.any())

function defaultGlobalBinding(command: string, key: string, modifiers: readonly string[] = []): PersistedShortcutBinding {
  return {
    command,
    scope: 'global',
    key: { key, modifiers: [...new Set(modifiers)] },
  }
}

const defaultCustomBindings: PersistedShortcutBinding[] = [
  defaultGlobalBinding('openCommandPalette', 'p', ['Meta']),
  defaultGlobalBinding('openSettings', ',', ['Meta']),
  defaultGlobalBinding('startSession', 'n', ['Meta', 'Alt', 'Shift']),
  defaultGlobalBinding('previousSession', 'j', ['Meta', 'Alt', 'Shift']),
  defaultGlobalBinding('nextSession', 'k', ['Meta', 'Alt', 'Shift']),
  defaultGlobalBinding('previousWorkspace', 'h', ['Meta', 'Alt', 'Shift']),
  defaultGlobalBinding('nextWorkspace', 'l', ['Meta', 'Alt', 'Shift']),
  defaultGlobalBinding('forkSession', 'b', ['Meta', 'Alt', 'Shift']),
  defaultGlobalBinding('toggleTheme', 't', ['Meta', 'Alt', 'Shift']),
  { command: 'focusPrevious', scope: 'question', key: { key: 'ArrowUp', modifiers: [] } },
  { command: 'focusNext', scope: 'question', key: { key: 'ArrowDown', modifiers: [] } },
  { command: 'activate', scope: 'question', key: { key: 'Enter', modifiers: [] } },
  { command: 'activate', scope: 'approval', key: { key: 'Enter', modifiers: [] } },
  { command: 'focusPrevious', scope: 'approval', key: { key: 'ArrowUp', modifiers: [] } },
  { command: 'focusNext', scope: 'approval', key: { key: 'ArrowDown', modifiers: [] } },
  { command: 'cancelTask', scope: 'question', key: { key: 'Escape', modifiers: [] } },
  { command: 'cancelTask', scope: 'approval', key: { key: 'Escape', modifiers: [] } },
]

const clonePersistedBindings = (bindings: readonly PersistedShortcutBinding[]): PersistedShortcutBinding[] => (
  bindings.map(binding => ({
    ...binding,
    ...(binding.key !== undefined ? { key: cloneJsonValue(binding.key) } : {}),
    ...(binding.sequence !== undefined ? { sequence: cloneJsonValue(binding.sequence) } : {}),
    ...(binding.sequences !== undefined ? { sequences: cloneJsonValue(binding.sequences) } : {}),
  }))
)

function cloneJsonValue(value: unknown): any {
  if (Array.isArray(value)) return value.map(cloneJsonValue)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]))
  }
  return value
}

/** Schema and defaults for the shortcut settings namespace. */
export const ShortcutSettingsSchema: z<ShortcutSettings> = z.object({
  activeProfile: z.string().default(DEFAULT_SHORTCUT_PROFILE_ID),
  customBindings: jsonArray.default(clonePersistedBindings(defaultCustomBindings)),
  customProfiles: jsonArray,
})

export function defaultShortcutBindings(): readonly PersistedShortcutBinding[] {
  return clonePersistedBindings(defaultCustomBindings)
}
