import type { Context } from '@deepseek-ai/cordis'
import { isShortcutProfileId } from './profile-catalog.js'
import { validatePersistedShortcutBindings } from './settings-validation.js'
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
    settingsCtx.settings.register(SHORTCUTS_SETTINGS_NAMESPACE, ShortcutSettingsSchema, {
      validate(value: ShortcutSettings) {
        if (!isShortcutProfileId(value.activeProfile)) {
          throw new Error(`unknown shortcut profile "${value.activeProfile}"`)
        }
        validatePersistedShortcutBindings(value.customBindings)
      },
    })
  })
}
