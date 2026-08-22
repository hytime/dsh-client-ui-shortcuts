import React from 'react'
import type { ShortcutBinding, ShortcutCommand, GlobalShortcutCommand } from '../contract/profile.js'
import type { ShortcutLocaleKey } from '../locales.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import { isBindingPlatformCompatible, visualizeStroke } from '../keyboard/visuals.js'
import { ShortcutIcon, type ShortcutIconName } from './ShortcutIcon.js'
import { ShortcutKeycap, ShortcutKeycapPlus } from './ShortcutKeycap.js'
import styles from '../styles/Shortcuts.module.css'

export interface ShortcutLegendProps { readonly bindings: readonly ShortcutBinding[]; readonly t: (key: ShortcutLocaleKey | string) => string; readonly availableGlobalActions?: readonly GlobalShortcutCommand[]; readonly platform: ShortcutPlatform }
const COMMAND_ICONS: Partial<Record<ShortcutCommand, ShortcutIconName>> = { focusPrevious: 'arrow-up', focusNext: 'arrow-down', activate: 'check', cancelTask: 'x', openCommandPalette: 'keyboard', openSettings: 'settings-2' }
export function ShortcutLegend({ bindings, t, availableGlobalActions, platform }: ShortcutLegendProps): React.ReactElement {
  const grouped = ['question', 'approval', 'global'] as const
  return <div className={styles.legend}>{grouped.map(scope => { const entries = bindings.filter(binding => binding.scope === scope && isBindingPlatformCompatible(binding.key, platform) && (scope !== 'global' || availableGlobalActions === undefined || availableGlobalActions.includes(binding.command as GlobalShortcutCommand))); if (entries.length === 0) return null; return <section className={styles.legendGroup} key={scope} aria-labelledby={`shortcut-legend-${scope}`}><h3 id={`shortcut-legend-${scope}`}>{t(`legend.scope.${scope}`)}</h3><div className={styles.legendList} role="list">{entries.map((binding, index) => { const visuals = visualizeStroke(binding.key, platform); return <div className={styles.legendItem} role="listitem" key={`${binding.command}-${binding.scope}-${index}`}><span className={styles.legendCommand}><ShortcutIcon name={COMMAND_ICONS[binding.command] ?? 'keyboard'} size={16} /><span>{t(`keyboard.${binding.command}`)}</span></span><span className={styles.legendKeys}>{visuals.map((visual, keyIndex) => <React.Fragment key={`${visual.ariaLabel}-${keyIndex}`}><ShortcutKeycap visual={visual} />{keyIndex < visuals.length - 1 ? <ShortcutKeycapPlus /> : null}</React.Fragment>)}</span></div> })}</div></section> })}</div>
}
