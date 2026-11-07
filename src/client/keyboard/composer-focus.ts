import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

export const COMPOSER_FOCUS_COMMAND = 'dsh-shortcuts.composerFocus' as ShortcutCommandId

const COMPOSER_SELECTOR = 'textarea[data-phase]'

/**
 * Focus the conversation composer. Fills the official shortcut catalog's gap
 * (DSH ships no composer-focus command) so the binding is managed in the
 * official keyboard settings like every other DSH command: per-device
 * defaults, official recording, conflict checks and persistence.
 *
 * Default is deliberately empty on every profile (an omitted profile is
 * unbound per the official contract): what "focus the composer" means is a
 * user preference, and an auto-bound modifier chord could surprise people.
 * Record a combination once in DSH Settings → General → Keyboard shortcuts
 * (or the quick panel) and it persists on that device.
 */
export function createComposerFocusCommand(label: () => string, focus: () => void): ShortcutCommand {
  return {
    id: COMPOSER_FOCUS_COMMAND,
    label,
    aliases: ['focus composer', 'focus input', 'composer'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: focus }),
  }
}

/** DOM fallback focus, shared with the command's run(). */
export function focusComposer(): void {
  const el = document.querySelector<HTMLTextAreaElement>(COMPOSER_SELECTOR)
  el?.focus()
}
