import React from 'react'
import type { ShortcutBinding, ShortcutCommand } from '../contract/profile.js'
import type { ShortcutLocaleKey } from '../locales.js'
import { ShortcutIcon, type ShortcutIconName } from './ShortcutIcon.js'
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

const COMMAND_ICONS: Record<ShortcutCommand, ShortcutIconName> = {
  focusPrevious: 'arrow-up',
  focusNext: 'arrow-down',
  activate: 'check',
  cancelTask: 'x',
  openCommandPalette: 'keyboard',
  openSettings: 'settings-2',
}

export function ShortcutLegend({ bindings, t }: ShortcutLegendProps): React.ReactElement {
  const grouped = ['question', 'approval'] as const
  return <div className={styles.legend}>
    {grouped.map(scope => {
      const entries = bindings.filter(binding => binding.scope === scope)
      if (entries.length === 0) return null
      return <section className={styles.legendGroup} key={scope} aria-labelledby={`shortcut-legend-${scope}`}>
        <h3 id={`shortcut-legend-${scope}`}>{t(`legend.scope.${scope}`)}</h3>
        <div className={styles.legendList} role="list">
          {entries.map((binding, index) => {
            const keys = keyLabel(binding)
            return <div className={styles.legendItem} role="listitem" key={`${binding.command}-${binding.scope}-${index}`}>
              <span className={styles.legendCommand}>
                <ShortcutIcon name={COMMAND_ICONS[binding.command]} size={16} />
                <span>{t(`keyboard.${binding.command}`)}</span>
              </span>
              <span className={styles.legendKeys}>
                {keys.map((key, keyIndex) => <React.Fragment key={`${key}-${keyIndex}`}><kbd className={styles.keycap}>{key}</kbd>{keyIndex < keys.length - 1 ? ' + ' : null}</React.Fragment>)}
              </span>
            </div>
          })}
        </div>
      </section>
    })}
  </div>
}
