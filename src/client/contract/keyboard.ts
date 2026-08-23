/** Pure keyboard input, focus, and resolver decision contracts. */
import type { ShortcutCommand, ShortcutScope } from './profile.js'

/** Normalized browser key input consumed by a profile-aware resolver. */
export interface KeyInput {
  readonly key: string
  readonly code?: string
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
  readonly composing?: boolean
  readonly repeat?: boolean
  readonly disabled?: boolean
  readonly keyCode?: number
}

/** Resolver result; pass leaves the host composer in control. */
export type ShortcutDecision =
  | { readonly kind: 'command'; readonly command: ShortcutCommand }
  | { readonly kind: 'pass' }

/** Surface on which a normalized shortcut is resolved. */
export type ShortcutSurface = ShortcutScope

/** Focusable control category used by question and approval flows. */
export type FocusItem =
  | { readonly kind: 'option'; readonly id: string; readonly disabled?: boolean }
  | { readonly kind: 'custom'; readonly id: string; readonly disabled?: boolean }
  | { readonly kind: 'action'; readonly id: string; readonly disabled?: boolean }
