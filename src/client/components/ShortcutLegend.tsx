import React from 'react'
import type { ShortcutBinding, ShortcutCommand, GlobalShortcutCommand } from '../contract/profile.js'
import type { ShortcutLocaleKey } from '../locales.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import { compatibleBindingSequences, visualizeStroke } from '../keyboard/visuals.js'
import { ShortcutIcon, type ShortcutIconName } from './ShortcutIcon.js'
import { ShortcutKeycap, ShortcutKeycapPlus } from './ShortcutKeycap.js'
import styles from '../styles/Shortcuts.module.css'

export interface ShortcutLegendProps { readonly bindings: readonly ShortcutBinding[]; readonly t: (key: ShortcutLocaleKey | string) => string; readonly availableGlobalActions?: readonly GlobalShortcutCommand[]; readonly platform: ShortcutPlatform }
const COMMAND_ICONS: Partial<Record<ShortcutCommand, ShortcutIconName>> = { focusPrevious: 'arrow-up', focusNext: 'arrow-down', activate: 'check', cancelTask: 'x', openCommandPalette: 'keyboard', openSettings: 'settings-2' }
export function ShortcutLegend({ bindings, t, availableGlobalActions, platform }: ShortcutLegendProps): React.ReactElement {
  return <div className={styles.legend}>{(['question', 'approval', 'global'] as const).map(scope => { const entries = bindings.flatMap((binding, index) => { if (binding.scope !== scope || (scope === 'global' && availableGlobalActions !== undefined && !availableGlobalActions.includes(binding.command as GlobalShortcutCommand))) return []; const sequences = compatibleBindingSequences(binding, platform); return sequences.map((sequence, sequenceIndex) => ({ binding, index, sequence, sequenceIndex })); }); if (entries.length === 0) return null; return <section className={styles.legendGroup} key={scope} aria-labelledby={`shortcut-legend-${scope}`}><h3 id={`shortcut-legend-${scope}`}>{t(`legend.scope.${scope}`)}</h3><div className={styles.legendList} role="list">{entries.map(({ binding, index, sequence, sequenceIndex }) => <div className={styles.legendItem} role="listitem" key={`${binding.command}-${binding.scope}-${index}-${sequenceIndex}`}><span className={styles.legendCommand}><ShortcutIcon name={COMMAND_ICONS[binding.command] ?? 'keyboard'} size={16} /><span>{t(`keyboard.${binding.command}`)}</span></span><span className={styles.legendKeys}>{sequence.flatMap(stroke => visualizeStroke(stroke, platform)).map((visual, keyIndex, visuals) => <React.Fragment key={`${visual.ariaLabel}-${keyIndex}`}><ShortcutKeycap visual={visual} />{keyIndex < visuals.length - 1 ? <ShortcutKeycapPlus /> : null}</React.Fragment>)}</span></div>)}</div></section> })}</div>
}
