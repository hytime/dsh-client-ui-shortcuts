import React from 'react'
import clsx from 'clsx'
import styles from '../styles/InteractionSurface.module.css'

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
