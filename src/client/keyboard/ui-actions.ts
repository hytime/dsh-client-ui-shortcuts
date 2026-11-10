import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

export const TOGGLE_SIDEBAR_COMMAND = 'dsh-shortcuts.toggleSidebar' as ShortcutCommandId
export const TOGGLE_DETAILS_COMMAND = 'dsh-shortcuts.toggleDetails' as ShortcutCommandId
export const TOGGLE_THEME_COMMAND = 'dsh-shortcuts.toggleTheme' as ShortcutCommandId
export const SCROLL_TOP_COMMAND = 'dsh-shortcuts.scrollTop' as ShortcutCommandId
export const SCROLL_BOTTOM_COMMAND = 'dsh-shortcuts.scrollBottom' as ShortcutCommandId

export interface LayoutFace {
  toggleSidebar(): void
  /** Official right-panel controls; both verified on the shipped layout service. */
  openRightbar?(track: boolean, fullscreen: boolean): void
  closeRightbar?(): void
}

export interface ThemeFace {
  getTheme(): { preference?: string }
  setTheme(id: string): void
}

/** Toggle between light and dark theme (system preference untouched). */
export function toggleTheme(theme: ThemeFace | undefined): void {
  if (theme === undefined) return
  try {
    const pref = theme.getTheme().preference
    theme.setTheme(pref === 'dark' ? 'light' : 'dark')
  } catch { /* getTheme/setTheme shape divergence: silently no-op */ }
}

/**
 * Toggle the details (right) panel. The shipped layout service exposes
 * `openRightbar(track, fullscreen)` / `closeRightbar()` — there is no
 * `openDetails`/`closeDetails`. Closed detection mirrors the old DOM probe
 * (`data-details-collapsed` exists exactly while the column is closed), but
 * falls back to assuming open when the probe finds nothing and the panel
 * has never been used.
 */
export function toggleDetails(layout: LayoutFace | undefined): void {
  const frame = document.querySelector<HTMLDivElement>('div[style*="minmax"]')
  const collapsed = frame === null || frame.hasAttribute('data-details-collapsed')
  if (collapsed) layout?.openRightbar?.(false, false)
  else layout?.closeRightbar?.()
}

/** Best-effort scroll of the conversation transcript to top/bottom. */
export function scrollTranscript(toEnd: boolean): void {
  const sel = '[data-conversation-scroller],[data-session-scroller],[class*="onversation"] [class*="croll"],main [class*="crollport"]'
  const el = document.querySelector<HTMLElement>(sel)
  if (el === null) return
  el.scrollTo({ top: toEnd ? el.scrollHeight : 0, behavior: 'smooth' })
}

export function createToggleSidebarCommand(label: () => string, layout: LayoutFace | undefined): ShortcutCommand {
  return {
    id: TOGGLE_SIDEBAR_COMMAND,
    label,
    aliases: ['toggle sidebar'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { layout?.toggleSidebar() } }),
  }
}

export function createToggleDetailsCommand(label: () => string, layout: LayoutFace | undefined): ShortcutCommand {
  return {
    id: TOGGLE_DETAILS_COMMAND,
    label,
    aliases: ['toggle details'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { toggleDetails(layout) } }),
  }
}

export function createToggleThemeCommand(label: () => string, theme: ThemeFace | undefined): ShortcutCommand {
  return {
    id: TOGGLE_THEME_COMMAND,
    label,
    aliases: ['toggle theme', 'light dark'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { toggleTheme(theme) } }),
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
