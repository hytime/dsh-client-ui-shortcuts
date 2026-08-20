import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createBuiltinProfileRegistry } from './profiles/registry.js'
import { selectShortcut } from './contract/slots.js'
import { createShortcutSettingsController, type ShortcutSettingsFace } from './settings/controller.js'
import { NS, en, zh } from './locales.js'
import type { ShortcutSettings } from '../settings.js'

/** Required browser services. */
export const inject = ['slots', 'locale', 'settingsScope'] as const

const NullComposer = (): null => null
const NullProfileCard = (): null => null

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'shortcuts: dictionaries')

  const registry = createBuiltinProfileRegistry()
  const scope = ctx.settingsScope.bind<ShortcutSettings>({ namespace: 'shortcuts' }) as SettingsScope<ShortcutSettings>
  const controller = createShortcutSettingsController(scope, registry)

  ctx.effect(() => {
    const offRegistry = registry.subscribe(() => {})
    return () => offRegistry()
  }, 'shortcuts: registry lifetime')
  ctx.effect(() => () => controller.dispose(), 'shortcuts: settings controller')

  ctx.effect(
    () => ctx.slots.inject('conversation.composer', () => ctx.slots.register({
      name: 'conversation.composer',
      select: selectShortcut,
      locale: NS,
      inject: (): { settings: ShortcutSettingsFace } => ({ settings: controller }),
    }, NullComposer)),
    'shortcuts: composer slot',
  )

  ctx.effect(
    () => ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
      name: 'settings.plugin.item',
      key: 'shortcuts',
      locale: NS,
      inject: (): { settings: ShortcutSettingsFace; profiles: ReturnType<typeof registry.list> } => ({
        settings: controller,
        profiles: registry.list(),
      }),
    }, NullProfileCard)),
    'shortcuts: settings card slot',
  )
}
