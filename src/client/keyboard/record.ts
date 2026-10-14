import type { ShortcutBinding } from '@deepseek-ai/dsh-client-shortcuts/client'

/** The physical-key subset a recorder reads; keeps this helper testable without a DOM. */
export interface RecordedKey {
  readonly code: string
  readonly key: string
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly metaKey: boolean
  readonly isComposing: boolean
  readonly repeat: boolean
  /** AltGr reports Ctrl+Alt but is not a user binding; the official adapter ignores it. */
  readonly altGraph?: boolean
}

const MODIFIER_CODES = /^(Control|Alt|Shift|Meta)(Left|Right)$/u

/**
 * Build the official candidate for one released key.
 * Official recording rules apply: modifier-only presses and IME composition are
 * ignored, and Escape cancels instead of becoming a binding.
 * @param event - physical key facts already filtered for repeat.
 * @returns the candidate to describe, or a control result for the recorder.
 */
export function bindingFromKey(event: RecordedKey): ShortcutBinding | 'cancel' | 'ignore' {
  if (event.isComposing) return 'ignore'
  // AltGr and dead-key sequences must not be persisted as combinations the user cannot replay.
  if (event.altGraph === true || event.key === 'Dead' || event.code === 'Unidentified') return 'ignore'
  if (MODIFIER_CODES.test(event.code)) return 'ignore'
  if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) return 'cancel'
  const modifiers = [
    event.ctrlKey && 'control', event.altKey && 'alt',
    event.shiftKey && 'shift', event.metaKey && 'meta',
  ].filter(Boolean) as ShortcutBinding['modifiers']
  return { code: event.code, modifiers }
}

/** Whether a key event must be consumed while the recorder owns input. */
export function isRecordable(event: Pick<RecordedKey, 'isComposing' | 'repeat' | 'altGraph'>): boolean {
  return !event.isComposing && !event.repeat && event.altGraph !== true
}
