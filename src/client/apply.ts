import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createBuiltinProfileRegistry } from './profiles/registry.js'
import { selectShortcut } from './contract/slots.js'
import { ShortcutComposer } from './components/ShortcutComposer.js'
import { createShortcutSettingsController, type ShortcutSettingsFace } from './settings/controller.js'
import { NS, en, zh } from './locales.js'
import type { ShortcutSettings } from '../settings.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from '../settings-namespace.js'
import type { ShortcutProfile } from './contract/profile.js'
import { ShortcutProfileCard } from './components/ShortcutProfileCard.js'

/** Required browser services. */
export const inject = ['slots', 'locale', 'settingsScope', 'sessions'] as const

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-shortcuts: dictionaries')
  const registry = createBuiltinProfileRegistry()
  const scope = ctx.settingsScope.bind<ShortcutSettings>({ namespace: SHORTCUTS_SETTINGS_NAMESPACE }) as SettingsScope<ShortcutSettings>
  const controller = createShortcutSettingsController(scope, registry)
  ctx.effect(() => () => controller.dispose(), 'dsh-shortcuts: settings controller')
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.slots.inject('conversation.composer', () => ctx.slots.register({
    name: 'conversation.composer', select: selectShortcut, priority: 2, locale: NS,
    inject: (sessionId: SessionId): { activeProfile: ShortcutProfile; t: (key: string) => string; cancelTask: () => Promise<void> } => {
      const session = ctx.sessions.scope(sessionId)
      if (session === undefined) throw new Error(`dsh-shortcuts: unknown session "${sessionId}"`)
      const conversation = session.get('conversation')
      if (conversation === undefined) throw new Error(`dsh-shortcuts: conversation unavailable for session "${sessionId}"`)
      return {
        activeProfile: registry.active(),
        t: (key: string) => t(key as never),
         cancelTask: async () => {
           const currentSession = ctx.sessions.scope(sessionId)
           if (currentSession === undefined) throw new Error(`dsh-shortcuts: unknown session "${sessionId}"`)
           const currentConversation = currentSession.get('conversation')
           if (currentConversation === undefined) throw new Error(`dsh-shortcuts: conversation unavailable for session "${sessionId}"`)
           await currentConversation.cancel()
         },
      }
    },
  }, ShortcutComposer)), 'dsh-shortcuts: composer slot')
  ctx.effect(() => ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item', key: SHORTCUTS_SETTINGS_NAMESPACE, locale: NS,
    inject: (): { settings: ShortcutSettingsFace; profiles: readonly ShortcutProfile[]; t: (key: string) => string } => ({ settings: controller, profiles: registry.list(), t: (key: string) => t(key as never) }),
  }, ShortcutProfileCard)), 'dsh-shortcuts: settings card slot')
}
