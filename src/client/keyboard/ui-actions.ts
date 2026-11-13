import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import { resolveService } from './service-source.js'
import type { ServiceSource } from './service-source.js'
import { recordDiag } from './diag.js'

export const TOGGLE_THEME_COMMAND = 'dsh-shortcuts.toggleTheme' as ShortcutCommandId
export const SCROLL_TOP_COMMAND = 'dsh-shortcuts.scrollTop' as ShortcutCommandId
export const SCROLL_BOTTOM_COMMAND = 'dsh-shortcuts.scrollBottom' as ShortcutCommandId

export interface ThemeFace {
  getTheme(): { preference?: string }
  setTheme(id: string): void
}

/** Toggle between light and dark theme (system preference untouched). */
export function toggleTheme(themeSource: ServiceSource<ThemeFace>): void {
  const theme = resolveService(themeSource)
  recordDiag('theme', { service: theme !== undefined })
  if (theme === undefined) return
  try {
    const pref = theme.getTheme().preference
    theme.setTheme(pref === 'dark' ? 'light' : 'dark')
  } catch (error) {
    recordDiag('theme.error', { error: String(error) })
  }
}

/** Best-effort scroll of the conversation transcript to top/bottom. */
export function scrollTranscript(toEnd: boolean): void {
  const sel = '[data-conversation-scroller],[data-session-scroller],[class*="onversation"] [class*="croll"],main [class*="crollport"]'
  const el = document.querySelector<HTMLElement>(sel)
  if (el === null) return
  el.scrollTo({ top: toEnd ? el.scrollHeight : 0, behavior: 'smooth' })
}

export function createToggleThemeCommand(label: () => string, themeSource: ServiceSource<ThemeFace>): ShortcutCommand {
  return {
    id: TOGGLE_THEME_COMMAND,
    label,
    aliases: ['toggle theme', 'light dark'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { toggleTheme(themeSource) } }),
  }
}

export function createScrollTopCommand(label: () => string): ShortcutCommand {
  return {
    id: SCROLL_TOP_COMMAND,
    label,
    aliases: ['scroll to top'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { scrollTranscript(false) } }),
  }
}

export function createScrollBottomCommand(label: () => string): ShortcutCommand {
  return {
    id: SCROLL_BOTTOM_COMMAND,
    label,
    aliases: ['scroll to bottom'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { scrollTranscript(true) } }),
  }
}