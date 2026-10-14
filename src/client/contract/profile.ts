/** Pure shortcut profile and binding data for the optional local interaction cards. */

/** Commands an enabled interaction card may bind locally. */
export type ShortcutCommand = 'focusPrevious' | 'focusNext' | 'activate' | 'cancelTask'
export type ShortcutScope = 'question' | 'approval'

/** Modifier-aware key identity produced from one local key event. */
export interface KeyStroke {
  readonly key: string
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
}

/** Symbolic modifier accepted by profile declarations. */
export type ShortcutModifier = 'Alt' | 'Ctrl' | 'Meta' | 'Shift'

/** Declarative shortcut stroke with symbolic modifiers. */
export interface ShortcutStroke {
  readonly key: string
  readonly modifiers: readonly ShortcutModifier[]
}

/** One local binding: a single stroke inside one interaction scope. */
export interface ShortcutBinding {
  readonly command: ShortcutCommand
  readonly scope: ShortcutScope
  readonly key: KeyStroke | ShortcutStroke
}

/** Local profile consumed by the optional interaction cards. */
export interface ShortcutProfile {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly bindings: readonly ShortcutBinding[]
}
