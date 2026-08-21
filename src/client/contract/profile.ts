/** Pure shortcut profile and binding data shared by keyboard and settings code. */

/** Commands a profile may bind to a focused interaction surface. */
export type ShortcutCommand =
  | 'focusPrevious'
  | 'focusNext'
  | 'activate'
  | 'cancelTask'
  | 'openCommandPalette'
  | 'openSettings'
  | 'startSession'
  | 'previousSession'
  | 'nextSession'
  | 'previousWorkspace'
  | 'nextWorkspace'
  | 'forkSession'
  | 'toggleTheme'

/** Interaction surface whose controls receive a shortcut. */
export type ShortcutScope = 'global' | 'question' | 'approval'

/** Modifier-aware browser key identity. */
export interface KeyStroke {
  readonly key: string
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
}

/** Symbolic modifier accepted by profile declarations. */
export type ShortcutModifier = 'Mod' | 'Alt' | 'Ctrl' | 'Meta' | 'Shift'

/** Declarative shortcut stroke with symbolic modifiers. */
export interface ShortcutStroke {
  readonly key: string
  readonly modifiers: readonly ShortcutModifier[]
}


export interface ShortcutBinding {
  readonly command: ShortcutCommand
  readonly scope: ShortcutScope
  readonly key: KeyStroke | ShortcutStroke
  readonly sequence?: readonly (KeyStroke | ShortcutStroke)[]
  readonly sequences?: readonly (readonly (KeyStroke | ShortcutStroke)[])[]
}


/** User-visible profile metadata and its keyboard bindings. */
export interface ShortcutProfile {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly bindings: readonly ShortcutBinding[]
}
