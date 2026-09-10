import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GlobalShortcutCommand } from '../contract/profile.js'
import type { ShortcutOverlayProps } from '../contract/overlay.js'
import { ShortcutManagerPanel } from './ShortcutManagerPanel.js'
import styles from '../styles/ShortcutOverlay.module.css'

/** Frame-wide centered shortcut manager; renders nothing while closed. */
export function ShortcutOverlay({ settings, controller, availableGlobalActions, platform, t, restoreFocus, initialFocusCommand }: ShortcutOverlayProps): React.ReactElement | null {
  const [, setTick] = useState(0)
  const wasOpen = useRef(controller.isOpen())

  useEffect(() => settings.subscribe(() => setTick(value => value + 1)), [settings])
  useEffect(() => controller.subscribe(() => setTick(value => value + 1)), [controller])

  const open = controller.isOpen()
  useEffect(() => {
    if (!open && wasOpen.current) {
      const target = restoreFocus?.()
      if (target !== undefined && target !== null && target.isConnected) target.focus()
    }
    wasOpen.current = open
  }, [open, restoreFocus])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, controller])

  if (!open) return null
  const focusCommand = initialFocusCommand ?? controller.focusCommand?.() as GlobalShortcutCommand | undefined

  if (typeof document === 'undefined' || document.body === null) return null
  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={t('overlay.title')}
      onClick={event => {
        if (event.target === event.currentTarget) controller.close()
      }}
    >
      <div className={styles.panel}>
        <div className={styles.managerArea}>
          <ShortcutManagerPanel
            settings={settings}
            availableGlobalActions={availableGlobalActions}
            platform={platform}
            t={t}
            initialFocusCommand={focusCommand}
            showUnavailableGlobalActions
            onClose={() => controller.close()}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
