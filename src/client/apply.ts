import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { QuickPanel, QuickPanelSettings } from './components/QuickPanel.js'
import { createQuickPanelModel } from './settings/quick-panel.js'
import { createOpenPanelCommand } from './keyboard/open-panel.js'
import { createComposerFocusCommand, focusComposer } from './keyboard/composer-focus.js'
import { createBossHideCommand, bossHideViaBridge } from './keyboard/boss-hide.js'
import { createPrevSessionCommand, createNextSessionCommand } from './keyboard/session-actions.js'
import type { SessionsNavFace, WorkspacesNavFace, UiWorkspaceNavFace } from './keyboard/session-actions.js'
import { createToggleThemeCommand, createScrollTopCommand, createScrollBottomCommand } from './keyboard/ui-actions.js'
import type { ThemeFace } from './keyboard/ui-actions.js'
import { createPasteClipboardCommand } from './keyboard/paste-clipboard.js'
import { NS, en, ja, ko, zh } from './locales.js'
import type { ShortcutSettings } from '../settings.js'
import { SHORTCUTS_SETTINGS_NAMESPACE } from '../settings-namespace.js'
import { PACKAGE_NAME } from '../invariant.js'

/** Current DSH services are required; this version has no legacy routing fallback. */
export const inject = ['slots', 'locale', 'shortcuts', 'configForms'] as const

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

  // The command exists only while its rendering surface exists.
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => {
    const offSlot = ctx.slots.register({ name: 'shell.overlay', id: 'dsh-shortcuts-panel', locale: NS, inject: props }, QuickPanel)
    try {
      const offCommand = ctx.shortcuts.register(createOpenPanelCommand(() => t('quick.open'), model.toggle))
      // Composer focus fills the official catalog's gap; unbound by default,
      // recorded once in DSH keyboard settings, per-device persisted there.
      const offFocus = ctx.shortcuts.register(createComposerFocusCommand(() => t('quick.focusComposer'), focusComposer))
      // Boss-key hide half: unbound by default; hide goes through the
      // official closeWindow bridge (try the official service first, then
      // this plugin's own registry surface if it owns the name). The wake
      // half belongs to the OS-level companion surfaced in BosskeySection.
      const official = ctx.get('shortcuts') as { closeWindow?: () => Promise<unknown> } | undefined
      const offBoss = ctx.shortcuts.register(createBossHideCommand(() => t('quick.bossHide'), () => { bossHideViaBridge([official as never]) }))
      // The blue-a11y action set, translated into official commands: every
      // action now lives in the DSH keyboard settings with per-device
      // persistence. Unbound by default where the old set shipped unbound.
      //
      // Each service is resolved at invoke time, not here: `uiWorkspace`,
      // `workspaces` and `theme` are not declared in this plugin's `inject`, so
      // cordis does not gate activation on them and they may be provided after
      // this plugin activates. Capturing them at activation yielded `undefined`
      // forever, which made the session commands fire and silently do nothing.
      // Only the commands DSH does not already own live here. New session
      // (`Ctrl+N`), session fork (`Ctrl+Alt+F`), the left sidebar
      // (`Ctrl+B`) and the right panel (`Ctrl+Alt+B`) are official commands;
      // duplicating them only cluttered the keyboard settings list.
      const workspaces = () => ctx.get('workspaces') as WorkspacesNavFace | undefined
      const sessions = () => ctx.get('sessions') as SessionsNavFace | undefined
      const uiWorkspace = () => ctx.get('uiWorkspace') as UiWorkspaceNavFace | undefined
      const theme = () => ctx.get('theme') as ThemeFace | undefined
      const disposers = [
        ctx.shortcuts.register(createPrevSessionCommand(() => t('quick.prevSession'), sessions, workspaces, uiWorkspace)),
        ctx.shortcuts.register(createNextSessionCommand(() => t('quick.nextSession'), sessions, workspaces, uiWorkspace)),
        ctx.shortcuts.register(createToggleThemeCommand(() => t('quick.toggleTheme'), theme)),
        ctx.shortcuts.register(createScrollTopCommand(() => t('quick.scrollTop'))),
        ctx.shortcuts.register(createScrollBottomCommand(() => t('quick.scrollBottom'))),
        ctx.shortcuts.register(createPasteClipboardCommand(() => t('quick.pasteClipboard'))),
      ]
      return () => { for (const d of disposers.reverse()) d(); offBoss(); offFocus(); offCommand(); offSlot(); model.close() }
    } catch (error) { offSlot(); throw error }
  }), 'shortcuts: official summon command')
  ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config', key: PACKAGE_NAME, locale: NS, inject: props,
  }, QuickPanelSettings)), 'shortcuts: settings entry')
}
