import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

export const OPEN_PANEL_COMMAND = 'hytime.shortcuts.open' as ShortcutCommandId
export const PROFILE_SHORTCUT_MODAL = 'hytime-shortcuts'

/** One editable command; DSH owns routing, recording, conflicts and device persistence. */
export function createOpenPanelCommand(label: () => string, toggle: () => void): ShortcutCommand {
  const mac = { code: 'KeyS', modifiers: ['meta', 'alt', 'shift'] as const }
  const other = { code: 'KeyS', modifiers: ['control', 'alt', 'shift'] as const }
  return {
    id: OPEN_PANEL_COMMAND,
    label,
    aliases: ['quick panel', 'hytime shortcuts'],
    defaults: {
      'web:macos': mac,
      'web:windows': other,
      // Linux Web deliberately has no default: the official allowed set is narrower.
    },
    regions: ['page', 'editable'],
    modals: ['settings', PROFILE_SHORTCUT_MODAL],
    resolve: ({ modal }) => modal !== null && modal !== 'settings' && modal !== PROFILE_SHORTCUT_MODAL
      ? { status: 'blocked', reason: 'modal' }
      : { status: 'handled', run: toggle },
  }
}
