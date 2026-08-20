import React from 'react'
import { Icon } from '@iconify/react/offline'
import keyboard from '@iconify-icons/lucide/keyboard.js'
import arrowUp from '@iconify-icons/lucide/arrow-up.js'
import arrowDown from '@iconify-icons/lucide/arrow-down.js'
import check from '@iconify-icons/lucide/check.js'
import x from '@iconify-icons/lucide/x.js'
import settings2 from '@iconify-icons/lucide/settings-2.js'

export type ShortcutIconName = 'keyboard' | 'arrow-up' | 'arrow-down' | 'check' | 'x' | 'settings-2'

const icons = { keyboard, 'arrow-up': arrowUp, 'arrow-down': arrowDown, check, x, 'settings-2': settings2 } as const

export interface ShortcutIconProps {
  readonly name: ShortcutIconName
  readonly size?: 14 | 16 | 20
  readonly className?: string
}

export function ShortcutIcon({ name, size = 16, className }: ShortcutIconProps): React.ReactElement {
  return <Icon icon={icons[name]} width={size} height={size} className={className} aria-hidden="true" />
}
