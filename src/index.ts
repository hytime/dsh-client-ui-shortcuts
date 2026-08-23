import type { Context } from '@deepseek-ai/cordis'
import { isShortcutProfileId } from './profile-catalog.js'
import { normalizePersistedShortcutResult } from './settings-validation.js'
import {
  SHORTCUTS_SETTINGS_NAMESPACE,
  ShortcutSettingsSchema,
  type ShortcutSettings,
} from './settings.js'

export {
  SHORTCUTS_SETTINGS_NAMESPACE,
  ShortcutSettingsSchema,
  type ShortcutSettings,
} from './settings.js'
export {
  DEFAULT_SHORTCUT_PROFILE_ID,
  SHORTCUT_PROFILE_IDS,
  isShortcutProfileId,
  type ShortcutProfileId,
} from './profile-catalog.js'

/** Register the optional Host settings namespace when a provider is composed. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(SHORTCUTS_SETTINGS_NAMESPACE, ShortcutSettingsSchema, {
      validate(value: ShortcutSettings) {
        if (!isShortcutProfileId(value.activeProfile)) {
          throw new Error(`unknown shortcut profile "${value.activeProfile}"`)
        }
        normalizePersistedShortcutResult(value.customBindings)
      },
    })
    let migrating = false
    ctx.on('settings/updated', (namespace, next) => {
      if (namespace !== SHORTCUTS_SETTINGS_NAMESPACE || migrating) return
      const resolved = next as ShortcutSettings
      const normalized = normalizePersistedShortcutResult(resolved.customBindings)
      if (JSON.stringify(normalized.bindings) === JSON.stringify(resolved.customBindings)) return
      migrating = true
      void scope.update({ customBindings: normalized.bindings })
        .finally(() => {
          migrating = false
        })
    })
  })
}
