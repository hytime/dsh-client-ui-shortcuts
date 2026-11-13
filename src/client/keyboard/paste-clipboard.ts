import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

export const PASTE_CLIPBOARD_COMMAND = 'dsh-shortcuts.pasteClipboard' as ShortcutCommandId

const COMPOSER_SELECTOR = 'textarea[data-phase]'

/**
 * Paste the system clipboard into the composer without manual focusing —
 * the "Paste Clipboard into Current Session" slot from the MochiNek0/dsh-desktop
 * client, as an official shortcut command. Read goes through the async
 * Clipboard API (needs a user gesture: a shortcut press qualifies); the text
 * is appended to the composer's current value at the caret, an input event is
 * dispatched so framework state machines (Lexical/React) pick the change up,
 * and focus lands in the composer ready to send.
 *
 * Failures (denied permission, no clipboard entry, no composer on screen)
 * degrade to a no-op — a shortcut must never throw into the dispatcher.
 *
 * Unbound on every profile by default (an omitted profile is unbound per the
 * official contract); record once in DSH keyboard settings, per-device.
 */
export function createPasteClipboardCommand(label: () => string): ShortcutCommand {
  return {
    id: PASTE_CLIPBOARD_COMMAND,
    label,
    aliases: ['paste clipboard', 'paste into composer'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: () => { void pasteClipboardIntoComposer() } }),
  }
}

/** Async body of the paste: read → append at caret → notify → focus. */
export async function pasteClipboardIntoComposer(): Promise<void> {
  const el = document.querySelector<HTMLTextAreaElement>(COMPOSER_SELECTOR)
  if (el === null) return
  let text: string
  try {
    text = await navigator.clipboard.readText()
  } catch { return } // permission denied / no entry / non-secure context
  if (!text) return
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  el.value = el.value.slice(0, start) + text + el.value.slice(end)
  const caret = start + text.length
  el.setSelectionRange(caret, caret)
  // The composer's state machine listens for input events; a bare value write
  // would desync the framework store from the DOM.
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
}
