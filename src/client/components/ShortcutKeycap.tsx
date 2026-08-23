import React from 'react'
import { Icon, type IconifyIcon } from '@iconify/react/offline'
import arrowDown from '@iconify-icons/lucide/arrow-down.js'
import arrowLeft from '@iconify-icons/lucide/arrow-left.js'
import arrowRight from '@iconify-icons/lucide/arrow-right.js'
import arrowUp from '@iconify-icons/lucide/arrow-up.js'
import chevronDown from '@iconify-icons/lucide/chevron-down.js'
import cornerDownLeft from '@iconify-icons/lucide/corner-down-left.js'
import option from '@iconify-icons/lucide/option.js'
import plus from '@iconify-icons/lucide/plus.js'
import command from '@iconify-icons/lucide/command.js'
import { ShortcutKeyIcon, type ShortcutKeyVisual } from '../contract/keyboard-visual.js'
import styles from '../styles/Shortcuts.module.css'

type LocalIcon = IconifyIcon

type KeyRenderer = (visual: ShortcutKeyVisual) => React.ReactElement

export interface ShortcutKeycapProps {
  readonly visual: ShortcutKeyVisual
}

function IconSvg({ icon, label }: { readonly icon: LocalIcon; readonly label: string }): React.ReactElement {
  return <Icon className={styles.keycapSvg} icon={icon} role="img" aria-label={label} aria-hidden={false} focusable="false" />
}

function PathSvg({ visual, path }: { readonly visual: ShortcutKeyVisual; readonly path: string }): React.ReactElement {
  return <svg className={styles.keycapSvg} role="img" aria-label={visual.ariaLabel} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" focusable="false"><path d={path} /></svg>
}

function CharacterSvg(visual: ShortcutKeyVisual): React.ReactElement {
  return <svg className={styles.keycapSvg} role="img" aria-label={visual.ariaLabel} viewBox="0 0 24 24" focusable="false"><text x="12" y="16" textAnchor="middle">{visual.label}</text></svg>
}

const iconRenderer = (icon: LocalIcon): KeyRenderer => visual => <IconSvg icon={icon} label={visual.ariaLabel} />
const pathRenderer = (path: string): KeyRenderer => visual => <PathSvg visual={visual} path={path} />

export const shortcutKeyIconRenderers: Record<ShortcutKeyIcon, KeyRenderer> = {
  [ShortcutKeyIcon.Command]: iconRenderer(command),
  [ShortcutKeyIcon.Windows]: pathRenderer('M3 4l8-1v8H3zM13 3l8-1v9h-8zM3 13h8v8l-8-1zM13 13h8v9l-8-1z'),
  [ShortcutKeyIcon.Control]: pathRenderer('M5 5h14v14H5zM9 9h6v6H9z'),
  [ShortcutKeyIcon.Option]: iconRenderer(option),
  [ShortcutKeyIcon.Shift]: pathRenderer('M12 4l7 7h-4v8H9v-8H5z'),
  [ShortcutKeyIcon.Enter]: iconRenderer(cornerDownLeft),
  [ShortcutKeyIcon.Escape]: pathRenderer('M6 4h12v16H6zM9 8h6M9 12h6M9 16h6'),
  [ShortcutKeyIcon.Space]: iconRenderer(chevronDown),
  [ShortcutKeyIcon.ArrowUp]: iconRenderer(arrowUp),
  [ShortcutKeyIcon.ArrowDown]: iconRenderer(arrowDown),
  [ShortcutKeyIcon.ArrowLeft]: iconRenderer(arrowLeft),
  [ShortcutKeyIcon.ArrowRight]: iconRenderer(arrowRight),
  [ShortcutKeyIcon.Character]: CharacterSvg,
}

export function ShortcutKeycap({ visual }: ShortcutKeycapProps): React.ReactElement {
  return <kbd className={styles.keycap}>{shortcutKeyIconRenderers[visual.icon](visual)}</kbd>
}

export function ShortcutKeycapPlus(): React.ReactElement {
  return <Icon className={styles.keycapPlus} icon={plus} role="presentation" aria-hidden="true" focusable="false" />
}
