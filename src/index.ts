import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

export { SHORTCUTS_SETTINGS_NAMESPACE, ShortcutSettingsSchema, type ShortcutSettings } from './settings.js'

/** DSH discovers settings from the Host entry's Config; there are no volatile fields left. */
export const Config = z.object({})

/** Keep the custom bundle configuration card as the single settings presentation. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
