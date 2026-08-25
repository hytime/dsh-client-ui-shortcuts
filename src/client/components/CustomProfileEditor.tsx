import React, { useEffect, useId, useRef, useState } from 'react'
import type { GlobalShortcutCommand, ShortcutBinding } from '../contract/profile.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import type { ShortcutLocaleKey } from '../locales.js'
import { ShortcutBindingEditor } from './ShortcutBindingEditor.js'
import styles from '../styles/Shortcuts.module.css'

export interface EditableCustomProfile {
  readonly id: string
  readonly name: string
  readonly bindings: readonly ShortcutBinding[]
  readonly fingerprint: string
}

export interface CustomProfileEditorProps {
  readonly profile: EditableCustomProfile
  readonly availableGlobalActions?: readonly GlobalShortcutCommand[]
  readonly platform: ShortcutPlatform
  readonly t: (key: ShortcutLocaleKey | string) => string
  readonly disabled?: boolean
  readonly onSave: (id: string, baselineFingerprint: string, name: string, bindings: readonly ShortcutBinding[]) => Promise<EditableCustomProfile>
  readonly onStateChange: (state: { dirty: boolean; saving: boolean; externalChange: boolean }) => void
}

const bindingSnapshot = (bindings: readonly ShortcutBinding[]): string => JSON.stringify(bindings)

export function CustomProfileEditor({ profile, availableGlobalActions, platform, t, disabled = false, onSave, onStateChange }: CustomProfileEditorProps): React.ReactElement {
  const [name, setName] = useState(profile.name)
  const [bindings, setBindings] = useState(profile.bindings)
  const [baseline, setBaseline] = useState(profile)
  const [saving, setSaving] = useState(false)
  const [bindingsValid, setBindingsValid] = useState(true)
  const [externalProfile, setExternalProfile] = useState<EditableCustomProfile>()
  const [message, setMessage] = useState<{ kind: 'status' | 'alert'; text: string }>()
  const latestProfile = useRef(profile)
  latestProfile.current = profile
  const mounted = useRef(false)
  const requestToken = useRef(0)
  const previousProfileId = useRef(profile.id)
  const observedFingerprint = useRef(profile.fingerprint)
  const dirty = name !== baseline.name || bindingSnapshot(bindings) !== bindingSnapshot(baseline.bindings)
  const externalChange = externalProfile !== undefined
  const count = Array.from(name).length
  const nameError = count === 0 ? t('editor.nameRequired') : count > 64 ? t('editor.nameTooLong') : undefined
  const nameErrorId = `shortcut-profile-name-error-${useId()}`

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      requestToken.current += 1
    }
  }, [])
  useEffect(() => {
    if (previousProfileId.current === profile.id) return
    previousProfileId.current = profile.id
    observedFingerprint.current = profile.fingerprint
    requestToken.current += 1
    setName(profile.name)
    setBindings(profile.bindings)
    setBaseline(profile)
    setExternalProfile(undefined)
    setSaving(false)
    setMessage(undefined)
  }, [profile.id])
  useEffect(() => {
    if (profile.fingerprint === observedFingerprint.current) return
    observedFingerprint.current = profile.fingerprint
    if (dirty) {
      setExternalProfile(profile)
      return
    }
    setName(profile.name)
    setBindings(profile.bindings)
    setBaseline(profile)
    setExternalProfile(undefined)
  }, [profile.fingerprint])
  useEffect(() => { onStateChange({ dirty, saving, externalChange }) }, [dirty, externalChange, onStateChange, saving])

  const reset = (next = baseline): void => {
    setName(next.name)
    setBindings(next.bindings)
    setBaseline(next)
    setExternalProfile(undefined)
    setMessage(undefined)
  }
  const save = async (): Promise<void> => {
    if (disabled || saving || !dirty || externalChange || count === 0 || count > 64 || !bindingsValid) return
    const savedProfileId = profile.id
    const currentRequest = ++requestToken.current
    setSaving(true)
    setMessage(undefined)
    try {
      const saved = await onSave(savedProfileId, baseline.fingerprint, name, bindings)
      if (!mounted.current || currentRequest !== requestToken.current || latestProfile.current.id !== savedProfileId || saved.id !== savedProfileId) return
      setName(saved.name)
      setBindings(saved.bindings)
      setBaseline(saved)
      setExternalProfile(undefined)
      setMessage({ kind: 'status', text: t('editor.saveSucceeded') })
    } catch (reason) {
      if (!mounted.current || currentRequest !== requestToken.current || latestProfile.current.id !== savedProfileId) return
      setMessage({ kind: 'alert', text: t('editor.saveFailed').replace('{message}', reason instanceof Error ? reason.message : String(reason)) })
    } finally {
      if (mounted.current && currentRequest === requestToken.current && latestProfile.current.id === savedProfileId) setSaving(false)
    }
  }

  return <div className={styles.customProfileEditor}>
    <label className={styles.profileNameRow}>
      <span>{t('editor.profileName')}</span>
      <input aria-label={t('editor.profileName')} aria-invalid={nameError !== undefined ? true : undefined} aria-describedby={nameError !== undefined ? nameErrorId : undefined} value={name} disabled={disabled || saving} onChange={event => { setName(event.target.value); setMessage(undefined) }} />
      <span className={styles.profileNameCount}>{t('editor.nameCount').replace('{count}', String(count))}</span>
    </label>
    {nameError !== undefined ? <p id={nameErrorId} className={styles.error}>{nameError}</p> : null}
    {externalChange ? <div role="status" className={styles.externalChange}><span>{t('editor.externalChange')}</span><button type="button" disabled={disabled || saving} onClick={() => reset(externalProfile)}>{t('editor.loadLatest')}</button></div> : null}
    <ShortcutBindingEditor bindings={bindings} availableGlobalActions={availableGlobalActions} platform={platform} t={t} onChange={next => { setBindings(next); setMessage(undefined) }} onValidityChange={setBindingsValid} disabled={disabled || saving} />
    {message !== undefined ? <p role={message.kind} className={message.kind === 'alert' ? styles.error : styles.success}>{message.text}</p> : null}
    <div className={styles.editorActions}>
      <button type="button" onClick={() => reset()} disabled={disabled || saving || !dirty}>{t('editor.cancel')}</button>
      <button type="button" onClick={() => void save()} disabled={disabled || saving || !dirty || externalChange || count === 0 || count > 64 || !bindingsValid}>{saving ? t('settings.saving') : t('editor.save')}</button>
    </div>
  </div>
}
