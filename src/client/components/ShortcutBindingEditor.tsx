import React, { useEffect, useMemo, useState } from 'react'
import type { ShortcutBinding, ShortcutCommand, GlobalShortcutCommand, ShortcutModifier, ShortcutScope, ShortcutStroke } from '../contract/profile.js'
import type { ShortcutLocaleKey } from '../locales.js'
import { validateShortcutBindings } from '../profiles/registry.js'
import { ShortcutIcon, type ShortcutIconName } from './ShortcutIcon.js'
import styles from '../styles/Shortcuts.module.css'

export interface ShortcutBindingEditorProps {
  readonly bindings: readonly ShortcutBinding[]
  readonly availableGlobalActions?: readonly GlobalShortcutCommand[]
  readonly t: (key: ShortcutLocaleKey | string) => string
  readonly onSave: (bindings: readonly ShortcutBinding[]) => Promise<void>
  readonly onCancel?: () => void
}

const scopes: readonly ShortcutScope[] = ['question', 'approval', 'global']
const modifiers: readonly ShortcutModifier[] = ['Mod', 'Ctrl', 'Alt', 'Meta', 'Shift']
const icons: Partial<Record<ShortcutCommand, ShortcutIconName>> = {
  focusPrevious: 'arrow-up', focusNext: 'arrow-down', activate: 'check', cancelTask: 'x', openCommandPalette: 'keyboard', openSettings: 'settings-2',
}
const isSymbolic = (stroke: ShortcutBinding['key']): stroke is ShortcutStroke => 'modifiers' in stroke
const strokeValue = (binding: ShortcutBinding): ShortcutStroke => {
  const source = binding.key ?? binding.sequence?.[0] ?? { key: '', modifiers: [] }
  return isSymbolic(source) ? { key: source.key, modifiers: [...source.modifiers] } : {
    key: source.key,
    modifiers: [source.ctrl && 'Ctrl', source.meta && 'Meta', source.alt && 'Alt', source.shift && 'Shift'].filter(Boolean) as ShortcutModifier[],
  }
}
const keyText = (stroke: ShortcutStroke): string[] => [...stroke.modifiers, stroke.key === ' ' ? 'Space' : stroke.key]

export function ShortcutBindingEditor({ bindings, availableGlobalActions, t, onSave, onCancel }: ShortcutBindingEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<readonly ShortcutBinding[]>(bindings)
  const [recording, setRecording] = useState<number>()
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraft(bindings); setError(undefined) }, [bindings])
  const visible = useMemo(() => draft.filter(binding => binding.scope !== 'global' || availableGlobalActions === undefined || availableGlobalActions.includes(binding.command as GlobalShortcutCommand)), [draft, availableGlobalActions])
  const conflict = useMemo(() => {
    try { validateShortcutBindings(visible); return undefined } catch (reason) { return reason instanceof Error ? reason.message : String(reason) }
  }, [visible])
  const update = (index: number, stroke: ShortcutStroke): void => setDraft(current => current.map((binding, position) => position === index ? { ...binding, key: stroke, ...(binding.sequence !== undefined ? { sequence: undefined } : {}), ...(binding.sequences !== undefined ? { sequences: undefined } : {}) } : binding))
  const capture = (event: React.KeyboardEvent, index: number): void => {
    event.preventDefault()
    if (event.key === 'Escape') { setRecording(undefined); return }
    if (event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta' || event.key === 'Shift') return
    const pressed: ShortcutModifier[] = []
    if (event.ctrlKey && !event.metaKey) pressed.push('Ctrl')
    if (event.metaKey) pressed.push('Meta')
    if (event.altKey) pressed.push('Alt')
    if (event.shiftKey) pressed.push('Shift')
    update(index, { key: event.key, modifiers: pressed })
    setRecording(undefined)
  }
  const save = async (): Promise<void> => {
    if (conflict !== undefined) return
    setSaving(true); setError(undefined)
    try { await onSave(visible) } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } finally { setSaving(false) }
  }
  return <div className={styles.editor}>
    {scopes.map(scope => {
      const entries = visible.map((binding, index) => ({ binding, index })).filter(entry => entry.binding.scope === scope)
      if (entries.length === 0) return null
      return <section className={styles.editorGroup} key={scope} aria-labelledby={`shortcut-editor-${scope}`}>
        <h3 id={`shortcut-editor-${scope}`}>{t(`legend.scope.${scope}`)}</h3>
        <div className={styles.editorList}>
          {entries.map(({ binding, index }) => {
            const stroke = strokeValue(binding)
            return <div className={styles.editorRow} key={`${binding.command}-${scope}`}>
              <span className={styles.legendCommand}><ShortcutIcon name={icons[binding.command] ?? 'keyboard'} size={16} /><span>{t(`keyboard.${binding.command}`)}</span></span>
              <span className={styles.modifierToggles}>{modifiers.map(modifier => <label key={modifier}><input type="checkbox" checked={stroke.modifiers.includes(modifier)} disabled={recording === index} onChange={event => update(index, { ...stroke, modifiers: event.target.checked ? [...stroke.modifiers, modifier] : stroke.modifiers.filter(value => value !== modifier) })} /><span>{t(`modifier.${modifier}`)}</span></label>)}</span>
              <button type="button" className={styles.recordButton} onClick={() => setRecording(index)} onKeyDown={event => { if (recording === index) capture(event, index) }}>{recording === index ? t('editor.recording') : keyText(stroke).map(value => <kbd className={styles.keycap} key={value}>{value}</kbd>)}</button>
            </div>
          })}
        </div>
      </section>
    })}
    {conflict !== undefined ? <p role="alert" className={styles.error}>{t('editor.conflict')}</p> : null}
    {error !== undefined ? <p role="alert" className={styles.error}>{t('editor.saveFailed').replace('{message}', error)}</p> : null}
    <div className={styles.editorActions}><button type="button" onClick={onCancel} disabled={saving}>{t('editor.cancel')}</button><button type="button" onClick={() => void save()} disabled={saving || conflict !== undefined}>{t('editor.save')}</button></div>
  </div>
}
