import type { Context } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { selectShortcut } from './contract/slots.js'
import type { SessionId } from './contract/slots.js'
import { ShortcutComposer } from './components/ShortcutComposer.js'
import { QuickPanel, QuickPanelSettings } from './components/QuickPanel.js'
import { createQuickPanelModel } from './settings/quick-panel.js'
import { createOpenPanelCommand } from './keyboard/open-panel.js'
import { standardProfile } from './profiles/builtins.js'
import { NS, en, ja, ko, zh } from './locales.js'
import type { ShortcutSettings } from '../settings.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from '../settings-namespace.js'
import { PACKAGE_NAME } from '../invariant.js'

/** Current DSH services are required; this version has no legacy routing fallback. */
export const inject = ['slots', 'locale', 'shortcuts', 'configForms', 'sessions', 'conversation'] as const

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'shortcuts: dictionaries')
  ctx.effect(() => ctx.locale.register(NS, 'ja', ja), 'shortcuts: Japanese')
  ctx.effect(() => ctx.locale.register(NS, 'ko', ko), 'shortcuts: Korean')
  for (const [id, label] of [['ja', '日本語'], ['ko', '한국어']] as const) {
    if (!ctx.locale.getSnapshot().locales.some(language => language.id === id)) {
      ctx.effect(() => ctx.locale.addLanguage({ id, label, fallback: 'en' }), `shortcuts: ${id} language`)
    }
  }
  const t = ctx.locale.bind(NS)
  const form = ctx.configForms.get<ShortcutSettings>(SHORTCUTS_SETTINGS_NAMESPACE)
  const model = createQuickPanelModel(form, ctx.shortcuts)
  ctx.effect(() => () => model.dispose(), 'shortcuts: panel model')
  const props = () => ({ model, t: (key: string) => t(key as never) })
  const sessions = ctx.get('sessions') as ISessions

  // The command exists only while its rendering surface exists.
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => {
    const offSlot = ctx.slots.register({ name: 'shell.overlay', id: 'hytime-shortcuts', locale: NS, inject: props }, QuickPanel)
    try {
      const offCommand = ctx.shortcuts.register(createOpenPanelCommand(() => t('quick.open'), model.toggle))
      return () => { offCommand(); offSlot(); model.close() }
    } catch (error) { offSlot(); throw error }
  }), 'shortcuts: official summon command')
  ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config', key: PACKAGE_NAME, locale: NS, inject: props,
  }, QuickPanelSettings)), 'shortcuts: settings entry')

  // Off means no contribution at all. Re-register only the changed kind so the
  // other interaction keeps its draft when a preference or catalog row changes.
  ctx.effect(() => {
    const mounts = new Map<'question' | 'approval', () => void>()
    const sync = (): void => {
      const state = model.getSnapshot()
      for (const kind of ['question', 'approval'] as const) {
        const enabled = kind === 'question' ? state.questionEnabled : state.approvalEnabled
        if (!enabled) { mounts.get(kind)?.(); mounts.delete(kind); continue }
        if (mounts.has(kind)) continue
        mounts.set(kind, ctx.slots.inject('conversation.composer', () => ctx.slots.register({
          name: 'conversation.composer', priority: -20, locale: NS,
          select: owner => selectShortcut(owner, kind),
          inject: (id: string) => ({
            interactionProfile: standardProfile, t: (key: string) => t(key as never),
            cancelTask: async () => {
              const session = sessions.scope(id as SessionId)
              if (session === undefined) throw new Error(`Unknown session: ${id}`)
              await session.conversation.cancel()
            },
          }),
        }, ShortcutComposer)))
      }
    }
    sync()
    const off = model.subscribe(sync)
    return () => { off(); for (const dispose of mounts.values()) dispose(); mounts.clear() }
  }, 'shortcuts: opt-in interactions')
}
