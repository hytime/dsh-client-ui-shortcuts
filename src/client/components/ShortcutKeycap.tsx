import React from 'react'
import { Icon } from '@iconify/react/offline'
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

interface LocalIcon {
  readonly body: string
  readonly width?: number | string
  readonly height?: number | string
}

export interface ShortcutKeycapProps {
  readonly visual: ShortcutKeyVisual
}

const icons: Partial<Record<ShortcutKeyIcon, LocalIcon>> = {
  [ShortcutKeyIcon.Command]: command,
  [ShortcutKeyIcon.Option]: option,
  [ShortcutKeyIcon.Enter]: cornerDownLeft,
  [ShortcutKeyIcon.Space]: chevronDown,
  [ShortcutKeyIcon.ArrowUp]: arrowUp,
  [ShortcutKeyIcon.ArrowDown]: arrowDown,
  [ShortcutKeyIcon.ArrowLeft]: arrowLeft,
  [ShortcutKeyIcon.ArrowRight]: arrowRight,
}

function IconSvg({ icon, label }: { readonly icon: LocalIcon; readonly label: string }): React.ReactElement {
  return <svg className={styles.keycapSvg} role="img" aria-label={label} viewBox={`0 0 ${icon.width ?? 24} ${icon.height ?? 24}`} focusable="false"><path d={icon.body} /></svg>
}

function SvgLabel({ visual }: { readonly visual: ShortcutKeyVisual }): React.ReactElement {
  if (visual.icon === ShortcutKeyIcon.Character) {
    return <svg className={styles.keycapSvg} role="img" aria-label={visual.ariaLabel} viewBox="0 0 24 24" focusable="false"><text x="12" y="16" textAnchor="middle">{visual.label}</text></svg>
  }
  const path = visual.icon === ShortcutKeyIcon.Control
    ? 'M5 5h14v14H5zM9 9h6v6H9z'
    : visual.icon === ShortcutKeyIcon.Shift
      ? 'M12 4l7 7h-4v8H9v-8H5z'
      : 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h6'
  return <svg className={styles.keycapSvg} role="img" aria-label={visual.ariaLabel} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" focusable="false"><path d={path} /></svg>
}

export function ShortcutKeycap({ visual }: ShortcutKeycapProps): React.ReactElement {
  const icon = icons[visual.icon]
  return <kbd className={styles.keycap}>{icon ? <IconSvg icon={icon} label={visual.ariaLabel} /> : <SvgLabel visual={visual} />}</kbd>
}

export function ShortcutKeycapPlus(): React.ReactElement {
  return <Icon className={styles.keycapPlus} icon={plus} width="0.75em" height="0.75em" aria-hidden="true" />
}
