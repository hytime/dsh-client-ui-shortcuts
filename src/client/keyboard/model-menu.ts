import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'

/**
 * Non-official shortcuts: DSH exposes no command that opens the model /
 * reasoning ("thinking depth") picker, so these commands drive the composer's
 * seat popup through the DOM instead of through an official service.
 *
 * This is a deliberate, documented trade-off. The click targets DSH's own
 * markup (`data-slot="conversation.input.model"`, `aria-haspopup`, the
 * `role="menuitem"` cells). It is best-effort: if a future DSH release renames
 * the slot, the attributes, or the menu structure, the command silently does
 * nothing rather than throwing. See README → "模型与推理" (#model-reasoning) for the caveat.
 */

export const OPEN_MODEL_MENU_COMMAND = 'dsh-shortcuts.openModelMenu' as ShortcutCommandId
export const OPEN_THINKING_DEPTH_COMMAND = 'dsh-shortcuts.openThinkingDepth' as ShortcutCommandId

/** The composer renders the model seat as a button that owns its popup. */
const MODEL_TRIGGER_SELECTOR = '[data-slot="conversation.input.model"] button[aria-haspopup="menu"]'
/** Fallback when the slot attribute is absent; only trusted if unambiguous. */
const FALLBACK_TRIGGER_SELECTOR = 'button[aria-haspopup="menu"]'
/** The model / effort cells inside the open popup. Effort is the second one. */
const MENU_ITEM_SELECTOR = 'button[role="menuitem"]'
/** Total time we are willing to wait for the popup to mount after a click. */
const POPUP_POLL_MS = 600
/** Poll interval between popup-mount checks. */
const POPUP_POLL_STEP_MS = 16

function findModelTrigger(): HTMLButtonElement | null {
  const exact = document.querySelector<HTMLButtonElement>(MODEL_TRIGGER_SELECTOR)
  if (exact !== null) return exact
  const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>(FALLBACK_TRIGGER_SELECTOR))
  // The fallback is only safe when there is exactly one menu-owning button on
  // the page; otherwise we cannot tell which seat the user means.
  return candidates.length === 1 ? candidates[0]! : null
}

function isMenuOpen(trigger: HTMLButtonElement): boolean {
  return trigger.getAttribute('aria-expanded') === 'true'
}

/** Menu cells live under the popup the trigger controls (aria-controls → id). */
function menuItems(trigger: HTMLButtonElement): HTMLButtonElement[] {
  const popupId = trigger.getAttribute('aria-controls')
  const popup = popupId !== null ? document.getElementById(popupId) : null
  const scope: ParentNode = popup ?? document
  return Array.from(scope.querySelectorAll<HTMLButtonElement>(MENU_ITEM_SELECTOR))
}

/**
 * Open the model / reasoning seat popup when it is currently closed. When the
 * popup is already open we leave it untouched (clicking again would close it).
 */
export function openModelMenu(): void {
  const trigger = findModelTrigger()
  if (trigger === null) return
  if (!isMenuOpen(trigger)) trigger.click()
}

/**
 * Drill straight into the reasoning-effort ("thinking depth") cell: open the
 * popup if needed, then click its second menu item. DSH lists the model cell
 * first and the effort cell second; if only one cell exists (no reasoning
 * levels on the current model), this is a no-op.
 */
export function openThinkingDepth(): void {
  const trigger = findModelTrigger()
  if (trigger === null) return
  if (!isMenuOpen(trigger)) trigger.click()
  const deadline = Date.now() + POPUP_POLL_MS
  const probe = (): void => {
    const items = menuItems(trigger)
    if (items.length >= 2) { items[1]!.click(); return }
    if (Date.now() >= deadline) return
    setTimeout(probe, POPUP_POLL_STEP_MS)
  }
  probe()
}

/**
 * `Mod+M` opens the model/reasoning menu on every desktop profile and both web
 * profiles (Linux Web keeps no default — the official allowed set there is
 * narrower). `Mod+M` is free of official DSH bindings; on macOS `Cmd+M` is the
 * OS window-minimize chord, so the README flags that this default may not reach
 * the page there and should be re-recorded per device if needed.
 */
export function createOpenModelMenuCommand(label: () => string, open: () => void = openModelMenu): ShortcutCommand {
  const binding = { code: 'KeyM', modifiers: ['primary'] as const }
  return {
    id: OPEN_MODEL_MENU_COMMAND,
    label,
    aliases: ['model menu', 'reasoning menu', 'open model'],
    defaults: {
      'desktop:macos': binding,
      'desktop:windows': binding,
      'desktop:linux': binding,
      'web:macos': binding,
      'web:windows': binding,
      // Linux Web deliberately has no default: the official allowed set is narrower.
    },
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: open }),
  }
}

/**
 * Unbound by default on every profile. There is no free, universal chord:
 * `Mod+T` is the official `browser.new` binding, and `Mod+Shift+T` is reserved
 * by browsers/OSes for "reopen closed tab". Record a per-device combination in
 * DSH Settings → General → Keyboard shortcuts (or the quick panel).
 */
export function createOpenThinkingDepthCommand(label: () => string, open: () => void = openThinkingDepth): ShortcutCommand {
  return {
    id: OPEN_THINKING_DEPTH_COMMAND,
    label,
    aliases: ['thinking depth', 'reasoning effort', 'effort picker'],
    defaults: {},
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => ({ status: 'handled', run: open }),
  }
}
