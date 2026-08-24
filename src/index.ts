import type { Context } from '@deepseek-ai/cordis'
import { isBuiltinShortcutProfileId } from './profile-catalog.js'
import { LEGACY_CUSTOM_PROFILE_ID, normalizeCustomProfiles } from './custom-profile-contract.js'
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
export async function apply(ctx: Context): Promise<void> {
  await ctx.inject(['settings'], (settingsCtx) => {
    const scope = settingsCtx.settings.register(SHORTCUTS_SETTINGS_NAMESPACE, ShortcutSettingsSchema, {
      validate(value: ShortcutSettings) {
        normalizePersistedShortcutResult(value.customBindings)
        if (value.customProfiles === undefined) {
          if (!['standard', 'vim', LEGACY_CUSTOM_PROFILE_ID].includes(value.activeProfile)) {
            throw new Error(`unknown shortcut profile "${value.activeProfile}"`)
          }
          return
        }
        const customProfiles = value.customProfiles
        if (!Array.isArray(customProfiles)) {
          normalizeCustomProfiles(customProfiles)
          return
        }
        if (customProfiles.some((profile) => {
          if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) return false
          const bindings = (profile as Record<string, unknown>).bindings
          return Array.isArray(bindings) && bindings.length === 0
        })) {
          throw new Error('custom profile bindings must be a non-empty array')
        }
        const profiles = normalizeCustomProfiles(customProfiles)
        if (!isBuiltinShortcutProfileId(value.activeProfile)
          && profiles.every(profile => profile.id !== value.activeProfile)) {
          throw new Error(`unknown shortcut profile "${value.activeProfile}"`)
        }
      },
    })

    const migrate = async (value: ShortcutSettings): Promise<void> => {
      const normalizedBindings = normalizePersistedShortcutResult(value.customBindings).bindings
      const patch: Record<string, unknown> = {}
      if (JSON.stringify(normalizedBindings) !== JSON.stringify(value.customBindings)) {
        patch.customBindings = normalizedBindings
      }
      if (value.customProfiles === undefined) {
        patch.customProfiles = [{
          id: LEGACY_CUSTOM_PROFILE_ID,
          bindings: normalizedBindings,
        }]
      }
      if (Object.keys(patch).length === 0) return
      try {
        await scope.update(patch)
      } catch (error) {
        ctx.logger.warn(
          `dsh-client-ui-shortcuts: legacy settings migration failed for "${SHORTCUTS_SETTINGS_NAMESPACE}"; continuing with legacy projection`,
          error,
        )
      }
    }

    void migrate(scope.get())
    ctx.effect(() => scope.watch(next => {
      void migrate(next)
    }))
  })
}
