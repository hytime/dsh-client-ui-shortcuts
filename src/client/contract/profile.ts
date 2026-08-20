/** Pure shortcut profile and binding data shared by keyboard and settings code. */

/** Commands a profile may bind to a focused interaction surface. */
export type ShortcutCommand = 'focusPrevious' | 'focusNext' | 'activate' | 'cancelTask'

/** Interaction surface whose controls receive a shortcut. */
export type ShortcutScope = 'question' | 'approval'

/** Modifier-aware browser key identity. */
export interface KeyStroke {
  readonly key: string
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
}

/** One command binding in a named shortcut profile. */
export interface ShortcutBinding {
  readonly command: ShortcutCommand
  readonly scope: ShortcutScope
  readonly key: KeyStroke
}

/** User-visible profile metadata and its keyboard bindings. */
export interface ShortcutProfile {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly bindings: readonly ShortcutBinding[]
}
