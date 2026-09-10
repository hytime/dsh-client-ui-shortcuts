import type { ClientLocaleLike, SettingsScope, SessionId } from './versioned-types.js'
import type { ClientContextLike as ClientContext } from './versioned-types.js'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createBuiltinProfileRegistry } from './profiles/registry.js'
import { selectShortcut } from './contract/slots.js'
import { ShortcutComposer } from './components/ShortcutComposer.js'
import { createShortcutSettingsController } from './settings/controller.js'
import type { ShortcutSettingsFace } from './contract/settings.js'
import { createDshCompatibility } from './compatibility.js'
import { NS, en, ja, ko, zh } from './locales.js'
import type { ShortcutSettings } from '../settings.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from '../settings-namespace.js'
import type { ShortcutProfile, GlobalShortcutCommand } from './contract/profile.js'
import { ShortcutLaunchCard } from './components/ShortcutLaunchCard.js'
import { createGlobalActions, type GlobalActionCapabilities } from './actions/global-actions.js'
import { detectShortcutPlatform } from './keyboard/visuals.js'
import { createGlobalKeyboardRouter } from './keyboard/router.js'
import { expandCollapsedWorkspace } from './actions/workspace-expansion.js'
import { OverlayController } from './overlay/controller.js'
import { ShortcutOverlay } from './components/ShortcutOverlay.js'
import type { ShortcutOverlayProps } from './contract/overlay.js'

/** Required browser services; Remote namespaces are probed optionally via `ctx.get`. */
export const inject = ['slots', 'locale', 'settingsScope', 'sessions', 'connection'] as const

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-shortcuts: dictionaries')
  ctx.effect(() => ctx.locale.register(NS, 'ja', ja), 'dsh-shortcuts: ja dictionary')
  ctx.effect(() => ctx.locale.register(NS, 'ko', ko), 'dsh-shortcuts: ko dictionary')
  // Japanese and Korean are not built into DSH, so making them selectable needs
  // `addLanguage`, which 0.1.0-rc.8 and 0.1.1-rc.2 do not expose; there the dictionaries
  // above stay registered but unselectable. Both languages fall back to English, which
  // every lookup chain must reach, and an id another language pack already claimed is
  // left as that pack defined it.
  const locale = ctx.locale as unknown as ClientLocaleLike
  const addLanguage = (id: string, label: string): (() => void) => {
    const add = locale.addLanguage
    if (add === undefined) return () => {}
    if (locale.getSnapshot().locales.some(entry => entry.id === id)) return () => {}
    return add.call(locale, { id, label, fallback: 'en' })
  }
  ctx.effect(() => addLanguage('ja', '日本語'), 'dsh-shortcuts: ja language')
  ctx.effect(() => addLanguage('ko', '한국어'), 'dsh-shortcuts: ko language')
  const t = ctx.locale.bind(NS)
  const scope = ctx.settingsScope.bind<ShortcutSettings>({ namespace: SHORTCUTS_SETTINGS_NAMESPACE }) as SettingsScope<ShortcutSettings>
  const registry = createBuiltinProfileRegistry()
  const compatibility = createDshCompatibility(name => ctx.get(name))
  const controller = createShortcutSettingsController(scope, registry, compatibility.mutateSettings, {
    createId: () => window.crypto.randomUUID(),
    legacyName: () => t('profile.custom.label'),
  })
  ctx.effect(() => () => controller.dispose(), 'dsh-shortcuts: settings controller')
  const overlay = new OverlayController()
  /** Element focused before the overlay opened; captured before autoFocus moves it. */
  let focusBeforeOverlay: HTMLElement | null = null
  const toggleShortcutsOverlay = (): void => {
    if (!overlay.isOpen()) {
      const active = document.activeElement
      focusBeforeOverlay = active instanceof HTMLElement ? active : null
    }
    overlay.toggle()
  }
  const getGlobalActions = () => createGlobalActions({
    sessions: ctx.get('sessions') as GlobalActionCapabilities['sessions'],
    workspaces: ctx.get('workspaces') as GlobalActionCapabilities['workspaces'],
    startSession: compatibility.startSession,
    toggleShortcutsOverlay,
    workspaceView: {
      expandCollapsedWorkspace: title => { expandCollapsedWorkspace(document, title) },
    },
    theme: ctx.get('theme') as GlobalActionCapabilities['theme'],
  })
  const platform = detectShortcutPlatform(window.navigator)
  ctx.effect(() => createGlobalKeyboardRouter(window, {
    getProfile: () => registry.active(),
    getActions: () => getGlobalActions(),
    platform,
    isInteractionPending: compatibility.isInteractionPending,
    overlay: { isOpen: () => overlay.isOpen(), close: () => overlay.close() },
  }), 'dsh-shortcuts: global keyboard router')
  ctx.effect(() => ctx.slots.inject('conversation.composer', () => ctx.slots.register({
    name: 'conversation.composer', select: selectShortcut, priority: -1, locale: NS,
    inject: (sessionId: SessionId): { activeProfile: ShortcutProfile; platform: ReturnType<typeof detectShortcutPlatform>; t: (key: string) => string; cancelTask: () => Promise<void> } => {
      const session = ctx.sessions.scope(sessionId)
      if (session === undefined) throw new Error(`dsh-shortcuts: unknown session "${sessionId}"`)
      const conversation = session.get('conversation')
      if (conversation === undefined) throw new Error(`dsh-shortcuts: conversation unavailable for session "${sessionId}"`)
      return {
        activeProfile: registry.active(),
        platform,
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
    inject: (): { settings: ShortcutSettingsFace; platform: ReturnType<typeof detectShortcutPlatform>; t: (key: string) => string; onOpen: () => void } => ({
      settings: controller,
      platform,
      t: (key: string) => t(key as never),
      onOpen: () => {
        if (!overlay.isOpen()) {
          const active = document.activeElement
          focusBeforeOverlay = active instanceof HTMLElement ? active : null
        }
        overlay.openWithFocus('showShortcuts')
      },
    }),
  }, ShortcutLaunchCard)), 'dsh-shortcuts: settings launch card slot')
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'hytime-shortcuts-overlay', order: 100, locale: NS,
    inject: (): ShortcutOverlayProps => ({
      settings: controller,
      controller: overlay,
      availableGlobalActions: Object.keys(getGlobalActions()) as GlobalShortcutCommand[],
      platform,
      t: (key: string) => t(key as never),
      restoreFocus: () => focusBeforeOverlay,
    }),
  }, ShortcutOverlay)), 'dsh-shortcuts: shortcuts overlay slot')
}
