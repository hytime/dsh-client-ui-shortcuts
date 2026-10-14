import React from 'react'
import clsx from 'clsx'
import styles from '../styles/InteractionSurface.module.css'

/** A pending interaction must not focus controls behind a foreground dialog or editor. */
export function focusInteraction(target: HTMLElement | null): void {
  if (target === null) return
  const doc = target.ownerDocument
  const modal = [...doc.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="menu"]')].at(-1)
  if (modal !== undefined && !modal.contains(target)) return
  const active = doc.activeElement
  const ownsActive = target.closest('[data-interaction-kind]')?.contains(active) === true
  if (!ownsActive && active instanceof HTMLElement
    && (active.matches('input, textarea') || active.isContentEditable)) return
  target.focus()
}

export interface InteractionSurfaceProps extends React.ComponentPropsWithoutRef<'section'> {
  readonly kind: 'question' | 'approval'
}

export function InteractionSurface({ kind, ...props }: InteractionSurfaceProps): React.ReactElement {
  return (
    <section
      {...props}
      data-testid="interaction-surface"
      data-interaction-kind={kind}
      className={clsx(styles.root, props.className)}
    />
  )
}
