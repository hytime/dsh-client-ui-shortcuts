import React, { useEffect, useRef, useState } from 'react'
import type { GlobalShortcutCommand, ShortcutBinding } from '../contract/profile.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import type { ShortcutLocaleKey } from '../locales.js'
import { ShortcutBindingEditor } from './ShortcutBindingEditor.js'
import styles from '../styles/Shortcuts.module.css'

export interface CustomProfileEditorProps {
  readonly profile: { id: string; name: string; bindings: readonly ShortcutBinding[]; fingerprint: string }
  readonly availableGlobalActions?: readonly GlobalShortcutCommand[]
  readonly platform: ShortcutPlatform
  readonly t: (key: ShortcutLocaleKey | string) => string
  readonly disabled?: boolean
  readonly onSave: (id: string, baselineFingerprint: string, name: string, bindings: readonly ShortcutBinding[]) => Promise<void>
  readonly onStateChange: (state: { dirty: boolean; saving: boolean; externalChange: boolean }) => void
}

const bindingSnapshot = (bindings: readonly ShortcutBinding[]): string => JSON.stringify(bindings)

export function CustomProfileEditor({ profile, availableGlobalActions, platform, t, disabled = false, onSave, onStateChange }: CustomProfileEditorProps): React.ReactElement {
  const [name, setName] = useState(profile.name)
  const [bindings, setBindings] = useState(profile.bindings)
  const [baseline, setBaseline] = useState(profile)
  const [saving, setSaving] = useState(false)
  const [bindingsValid, setBindingsValid] = useState(true)
  const [message, setMessage] = useState<{ kind: 'status' | 'alert'; text: string }>()
  const latestProfile = useRef(profile)
  latestProfile.current = profile
  const dirty = name !== baseline.name || bindingSnapshot(bindings) !== bindingSnapshot(baseline.bindings)
  const incomingChanged = profile.fingerprint !== baseline.fingerprint
  const cleanIncomingUpdate = incomingChanged && !dirty
  const externalChange = incomingChanged && dirty
  const count = Array.from(name).length

  useEffect(() => {
    if (cleanIncomingUpdate) {
      setName(profile.name)
      setBindings(profile.bindings)
      setBaseline(profile)
    }
  }, [baseline, cleanIncomingUpdate, profile])
  useEffect(() => { onStateChange({ dirty, saving, externalChange }) }, [dirty, externalChange, onStateChange, saving])

  const reset = (next = baseline): void => {
    setName(next.name)
    setBindings(next.bindings)
    setBaseline(next)
    setMessage(undefined)
  }
  const save = async (): Promise<void> => {
    if (disabled || saving || !dirty || externalChange || count === 0 || count > 64 || !bindingsValid) return
    setSaving(true)
    setMessage(undefined)
    try {
      await onSave(profile.id, baseline.fingerprint, name, bindings)
      setBaseline({ id: profile.id, name, bindings, fingerprint: profile.fingerprint })
      setMessage({ kind: 'status', text: t('editor.saveSucceeded') })
    } catch (reason) {
      setMessage({ kind: 'alert', text: t('editor.saveFailed').replace('{message}', reason instanceof Error ? reason.message : String(reason)) })
    } finally {
      setSaving(false)
    }
  }

  return <div className={styles.customProfileEditor}>
    <label className={styles.profileNameRow}>
      <span>{t('editor.profileName')}</span>
      <input aria-label={t('editor.profileName')} value={name} disabled={disabled || saving} onChange={event => { setName(event.target.value); setMessage(undefined) }} />
      <span className={styles.profileNameCount}>{t('editor.nameCount').replace('{count}', String(count))}</span>
    </label>
    {externalChange ? <div className={styles.externalChange}><span>{t('editor.externalChange')}</span><button type="button" disabled={disabled || saving} onClick={() => reset(latestProfile.current)}>{t('editor.loadLatest')}</button></div> : null}
    <ShortcutBindingEditor bindings={bindings} availableGlobalActions={availableGlobalActions} platform={platform} t={t} onChange={next => { setBindings(next); setMessage(undefined) }} onValidityChange={setBindingsValid} disabled={disabled || saving} />
    {message !== undefined ? <p role={message.kind} className={message.kind === 'alert' ? styles.error : styles.success}>{message.text}</p> : null}
    <div className={styles.editorActions}>
      <button type="button" onClick={() => reset()} disabled={disabled || saving || !dirty}>{t('editor.cancel')}</button>
      <button type="button" onClick={() => void save()} disabled={disabled || saving || !dirty || externalChange || count === 0 || count > 64 || !bindingsValid}>{saving ? t('settings.saving') : t('editor.save')}</button>
    </div>
  </div>
}
