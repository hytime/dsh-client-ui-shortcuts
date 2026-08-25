import React, { useEffect, useMemo, useState } from 'react'
import type { ShortcutBinding, ShortcutCommand, GlobalShortcutCommand, ShortcutModifier, ShortcutScope, ShortcutStroke, KeyStroke } from '../contract/profile.js'
import type { ShortcutLocaleKey } from '../locales.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import { compatibleBindingSequences, visualizeStroke } from '../keyboard/visuals.js'
import { findNewShortcutConflicts } from '../keyboard/conflicts.js'
import { browserReservedDiagnostics } from '../keyboard/browser-reserved.js'
import { validateShortcutBindings } from '../profiles/registry.js'
import { ShortcutIcon, type ShortcutIconName } from './ShortcutIcon.js'
import { ShortcutKeycap, ShortcutKeycapPlus } from './ShortcutKeycap.js'
import styles from '../styles/Shortcuts.module.css'

export interface ShortcutBindingEditorProps {
  readonly bindings: readonly ShortcutBinding[]
  readonly availableGlobalActions?: readonly GlobalShortcutCommand[]
  readonly platform: ShortcutPlatform
  readonly t: (key: ShortcutLocaleKey | string) => string
  readonly onChange: (bindings: readonly ShortcutBinding[]) => void
  readonly disabled?: boolean
  readonly onValidityChange?: (valid: boolean) => void
}

const scopes: readonly ShortcutScope[] = ['question', 'approval', 'global']
const modifiers: readonly ShortcutModifier[] = ['Meta', 'Ctrl', 'Alt', 'Shift']
const icons: Partial<Record<ShortcutCommand, ShortcutIconName>> = { focusPrevious: 'arrow-up', focusNext: 'arrow-down', activate: 'check', cancelTask: 'x', openCommandPalette: 'keyboard', openSettings: 'settings-2' }
const isSymbolic = (stroke: KeyStroke | ShortcutStroke): stroke is ShortcutStroke => 'modifiers' in stroke
const toStroke = (stroke: KeyStroke | ShortcutStroke): ShortcutStroke => isSymbolic(stroke) ? { key: stroke.key, modifiers: [...stroke.modifiers] } : { key: stroke.key, modifiers: [stroke.ctrl && 'Ctrl', stroke.meta && 'Meta', stroke.alt && 'Alt', stroke.shift && 'Shift'].filter(Boolean) as ShortcutModifier[] }
const bindingPlatformCompatible = (binding: ShortcutBinding, platform: ShortcutPlatform): boolean => compatibleBindingSequences(binding, platform).length > 0
const editableSequence = (binding: ShortcutBinding): readonly (readonly (KeyStroke | ShortcutStroke)[])[] => binding.sequences ?? (binding.sequence !== undefined ? [binding.sequence] : binding.key !== undefined ? [[binding.key]] : [])

export function ShortcutBindingEditor({ bindings, availableGlobalActions, t, onChange, platform, disabled = false, onValidityChange }: ShortcutBindingEditorProps): React.ReactElement {
  const [recording, setRecording] = useState<number>()
  const visible = useMemo(() => bindings.map((binding, index) => ({ binding, index })).filter(({ binding }) => bindingPlatformCompatible(binding, platform) && (binding.scope !== 'global' || availableGlobalActions === undefined || availableGlobalActions.includes(binding.command as GlobalShortcutCommand))), [bindings, availableGlobalActions, platform])
  const conflict = useMemo(() => { try { validateShortcutBindings(bindings); if (findNewShortcutConflicts(bindings, visible).length > 0) return 'cross-scope'; if (visible.some(entry => browserReservedDiagnostics(entry.binding, platform).length > 0)) return 'browser-reserved'; return undefined } catch (reason) { return reason instanceof Error ? reason.message : String(reason) } }, [bindings, visible, platform])
  useEffect(() => { onValidityChange?.(conflict === undefined) }, [conflict, onValidityChange])
  const update = (index: number, stroke: ShortcutStroke): void => onChange(bindings.map((binding, position) => {
    if (position !== index) return binding
    const sequences = editableSequence(binding)
    const active = compatibleBindingSequences(binding, platform)[0]
    const activeIndex = active === undefined ? 0 : sequences.findIndex(sequence => sequence === active)
    if (binding.sequences !== undefined) return { ...binding, sequences: sequences.map((sequence, sequenceIndex) => sequenceIndex === Math.max(0, activeIndex) ? [stroke, ...sequence.slice(1)] : [...sequence]) }
    if (binding.sequence !== undefined) return { ...binding, sequence: [stroke, ...binding.sequence.slice(1)] }
    return { ...binding, key: stroke }
  }))
  const capture = (event: React.KeyboardEvent, index: number): void => { event.preventDefault(); if (event.key === 'Escape') { setRecording(undefined); return }; if (['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) return; const pressed: ShortcutModifier[] = []; if (event.ctrlKey && !event.metaKey) pressed.push('Ctrl'); if (event.metaKey) pressed.push('Meta'); if (event.altKey) pressed.push('Alt'); if (event.shiftKey) pressed.push('Shift'); update(index, { key: event.key, modifiers: pressed }); setRecording(undefined) }
  return <div className={styles.editor} data-invalid={conflict !== undefined ? '' : undefined}>
    {scopes.map(scope => { const entries = visible.filter(entry => entry.binding.scope === scope); if (entries.length === 0) return null; return <section className={styles.editorGroup} key={scope} aria-labelledby={`shortcut-editor-${scope}`}><h3 id={`shortcut-editor-${scope}`}>{t(`legend.scope.${scope}`)}</h3><div className={styles.editorList}>{entries.map(({ binding, index }) => { const sequence = compatibleBindingSequences(binding, platform)[0] ?? []; const stroke = toStroke(sequence[0] ?? { key: '', modifiers: [] }); const visuals = visualizeStroke(stroke, platform); return <div className={styles.editorRow} key={`${binding.command}-${scope}`}><span className={styles.legendCommand}><ShortcutIcon name={icons[binding.command] ?? 'keyboard'} size={16} /><span>{t(`keyboard.${binding.command}`)}</span></span><span className={styles.modifierToggles}>{modifiers.map(modifier => <label key={modifier}><input type="checkbox" checked={stroke.modifiers.includes(modifier)} disabled={disabled || recording === index} onChange={event => update(index, { ...stroke, modifiers: event.target.checked ? [...stroke.modifiers, modifier] : stroke.modifiers.filter(value => value !== modifier) })} /><span>{modifier === 'Alt' && platform === 'mac' ? t('modifier.Option') : t(`modifier.${modifier}`)}</span></label>)}</span><button type="button" className={styles.recordButton} disabled={disabled} onClick={() => setRecording(index)} onKeyDown={event => { if (recording === index) capture(event, index) }}>{recording === index ? t('editor.recording') : visuals.map((visual, visualIndex) => <React.Fragment key={`${visual.ariaLabel}-${visualIndex}`}><ShortcutKeycap visual={visual} />{visualIndex < visuals.length - 1 ? <ShortcutKeycapPlus /> : null}</React.Fragment>)}</button></div> })}</div></section> })}
    {conflict !== undefined ? <p role="alert" className={styles.error}>{conflict === 'browser-reserved' ? t('editor.browserReserved') : t('editor.conflict')}</p> : null}
  </div>
}
