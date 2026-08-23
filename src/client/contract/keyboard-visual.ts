import type { KeyStroke, ShortcutModifier, ShortcutStroke } from './profile.js'

export type ShortcutPlatform = 'mac' | 'windows' | 'linux'

export enum ShortcutKeyIcon {
  Command = 'command',
  Windows = 'windows',
  Control = 'control',
  Option = 'option',
  Shift = 'shift',
  Enter = 'enter',
  Escape = 'escape',
  Space = 'space',
  ArrowUp = 'arrow-up',
  ArrowDown = 'arrow-down',
  ArrowLeft = 'arrow-left',
  ArrowRight = 'arrow-right',
  Character = 'character',
}

export interface ShortcutKeyVisual {
  readonly icon: ShortcutKeyIcon
  readonly label: string
  readonly ariaLabel: string
}

export type VisualStroke = KeyStroke | ShortcutStroke
