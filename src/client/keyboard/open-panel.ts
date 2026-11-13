import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

export const OPEN_PANEL_COMMAND = 'dsh-shortcuts.open' as ShortcutCommandId
export const PROFILE_SHORTCUT_MODAL = 'dsh-shortcuts-panel'

/** One editable command; DSH owns routing, recording, conflicts and device persistence. */
export function createOpenPanelCommand(label: () => string, toggle: () => void): ShortcutCommand {
  // `primary` is the official logical modifier: it expands to Meta on macOS and
  // Control elsewhere, so one declaration covers every desktop platform.
  const binding = { code: 'KeyS', modifiers: ['primary', 'alt', 'shift'] as const }
  return {
    id: OPEN_PANEL_COMMAND,
    label,
    aliases: ['quick panel', 'hytime shortcuts'],
    defaults: {
      'desktop:macos': binding,
      'desktop:windows': binding,
      'desktop:linux': binding,
      'web:macos': binding,
      'web:windows': binding,
      // Linux Web deliberately has no default: the official allowed set is narrower.
    },
    regions: ['page', 'editable'],
    modals: ['settings', PROFILE_SHORTCUT_MODAL],
    resolve: ({ modal }) => modal !== null && modal !== 'settings' && modal !== PROFILE_SHORTCUT_MODAL
      ? { status: 'blocked', reason: 'modal' }
      : { status: 'handled', run: toggle },
  }
}
