import React from 'react'
import { Icon } from '@iconify/react/offline'
import check from '@iconify-icons/lucide/check.js'

/** Local inline check icon used by the optional question card; no runtime network provider. */
export function ShortcutIcon({ size = 16, className }: { readonly size?: 14 | 16 | 20; readonly className?: string }): React.ReactElement {
  return <Icon icon={check} width={size} height={size} className={className} aria-hidden="true" />
}
