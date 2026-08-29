import type { ClientContext, SettingsScope, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createBuiltinProfileRegistry } from './profiles/registry.js'
import { selectShortcut } from './contract/slots.js'
import { ShortcutComposer } from './components/ShortcutComposer.js'
import { createShortcutSettingsController } from './settings/controller.js'
import type { MutateShortcutSettings, ShortcutSettingsFace } from './contract/settings.js'
import { NS, en, zh } from './locales.js'
import type { ShortcutSettings } from '../settings.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from '../settings-namespace.js'
import type { ShortcutProfile, GlobalShortcutCommand } from './contract/profile.js'
import { ShortcutProfileCard } from './components/ShortcutProfileCard.js'
import { createGlobalActions, type GlobalActionCapabilities } from './actions/global-actions.js'
import { detectShortcutPlatform } from './keyboard/visuals.js'
import { createGlobalKeyboardRouter } from './keyboard/router.js'
import { expandCollapsedWorkspace } from './actions/workspace-expansion.js'

type SettingsMutationRemote = {
  readonly settings: {
    mutate: (
      namespace: string,
      ops: readonly [{ op: 'set'; path: readonly [string]; value: unknown }],
      expectedRevision: number,
    ) => Promise<SettingsMutationResponse>
  }
}

type SettingsMutationResponse =
  | { readonly ok: true; readonly value: SettingsMutationView }
  | {
    readonly ok: false
    readonly error: {
      readonly code: string
      readonly message: string
      readonly details?: unknown
    }
  }

type SettingsMutationView = {
  readonly value: unknown
  readonly base?: unknown
  readonly user?: unknown
  readonly revision: number
}

export function createSettingsMutationAdapter(remote: SettingsMutationRemote): MutateShortcutSettings {
  return async ({ field, value, expectedRevision }) => {
    try {
      const response = await remote.settings.mutate(
        SHORTCUTS_SETTINGS_NAMESPACE,
        [{ op: 'set', path: [field], value }],
        expectedRevision,
      )
      if (!response.ok) {
        const actualRevision = numericConflictRevision(response.error.details)
        return {
          ok: false,
          kind: response.error.code === 'settings-conflict' ? 'conflict' : 'rejected',
          message: response.error.message,
          ...(actualRevision === undefined ? {} : { actualRevision }),
        }
      }
      return { ok: true, view: response.value }
    } catch (error) {
      return {
        ok: false,
        kind: 'transport',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

function numericConflictRevision(details: unknown): number | undefined {
  if (typeof details !== 'object' || details === null || Array.isArray(details)) return undefined
  const actual = Reflect.get(details, 'actual')
  return typeof actual === 'number' && Number.isFinite(actual) ? actual : undefined
}

/** Required browser services. */
export const inject = ['slots', 'locale', 'settingsScope', 'sessions', 'remote', 'remote.settings'] as const

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-shortcuts: dictionaries')
  const t = ctx.locale.bind(NS)
  const scope = ctx.settingsScope.bind<ShortcutSettings>({ namespace: SHORTCUTS_SETTINGS_NAMESPACE }) as SettingsScope<ShortcutSettings>
  const remote = ctx.get('remote') as unknown as SettingsMutationRemote
  const registry = createBuiltinProfileRegistry()
  const mutate = createSettingsMutationAdapter(remote)
  const controller = createShortcutSettingsController(scope, registry, mutate, {
    createId: () => window.crypto.randomUUID(),
    legacyName: () => t('profile.custom.label'),
  })
  ctx.effect(() => () => controller.dispose(), 'dsh-shortcuts: settings controller')
  const getGlobalActions = () => createGlobalActions({
    sessions: ctx.get('sessions') as GlobalActionCapabilities['sessions'],
    workspaces: ctx.get('workspaces') as GlobalActionCapabilities['workspaces'],
    workspaceView: {
      expandCollapsedWorkspace: title => { expandCollapsedWorkspace(document, title) },
    },
    theme: ctx.get('theme') as GlobalActionCapabilities['theme'],
  })
  const platform = detectShortcutPlatform(window.navigator)
  const pending = ctx.get('interactions') as { readonly current?: () => unknown } | undefined
  ctx.effect(() => createGlobalKeyboardRouter(window, {
    getProfile: () => registry.active(),
    getActions: () => getGlobalActions(),
    platform,
    isInteractionPending: () => pending?.current?.() !== undefined,
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
    inject: (): { settings: ShortcutSettingsFace; availableGlobalActions: readonly string[]; platform: ReturnType<typeof detectShortcutPlatform>; t: (key: string) => string } => ({ settings: controller, availableGlobalActions: Object.keys(getGlobalActions()) as GlobalShortcutCommand[], platform, t: (key: string) => t(key as never) }),
  }, ShortcutProfileCard)), 'dsh-shortcuts: settings card slot')
}
