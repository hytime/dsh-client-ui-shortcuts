import React from 'react'
import type { ShortcutBinding } from '../contract/profile.js'
import type { ShortcutLocaleKey } from '../locales.js'
import styles from '../styles/Shortcuts.module.css'

export interface ShortcutLegendProps {
  readonly bindings: readonly ShortcutBinding[]
  readonly t: (key: ShortcutLocaleKey | string) => string
}

function keyLabel(binding: ShortcutBinding): string[] {
  const { key } = binding
  const modifiers = [key.ctrl && 'Ctrl', key.alt && 'Alt', key.meta && 'Meta', key.shift && 'Shift'].filter(Boolean) as string[]
  const value = key.key === ' ' ? 'Space' : key.key
  return [...modifiers, value]
}

export function ShortcutLegend({ bindings, t }: ShortcutLegendProps): React.ReactElement {
  const grouped = ['question', 'approval'] as const
  return <div className={styles.legend}>
    {grouped.map(scope => {
      const entries = bindings.filter(binding => binding.scope === scope)
      if (entries.length === 0) return null
      return <section className={styles.legendGroup} key={scope} aria-labelledby={`shortcut-legend-${scope}`}>
        <h3 id={`shortcut-legend-${scope}`}>{t(`legend.scope.${scope}`)}</h3>
        <dl>
          {entries.map((binding, index) => <div className={styles.legendRow} key={`${binding.command}-${binding.scope}-${index}`}>
            <dt>{t(`keyboard.${binding.command}`)}</dt>
            <dd>{keyLabel(binding).map((key, keyIndex) => <React.Fragment key={`${key}-${keyIndex}`}><kbd className={styles.keycap}>{key}</kbd>{keyIndex < keyLabel(binding).length - 1 ? ' + ' : null}</React.Fragment>)}</dd>
          </div>)}
        </dl>
      </section>
    })}
  </div>
}
