import React, { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import { customProfileFilename } from '../../custom-profile-contract.js'
import type { ShortcutLocaleKey } from '../locales.js'
import type { ShortcutProfile, GlobalShortcutCommand } from '../contract/profile.js'
import type { ShortcutPlatform } from '../contract/keyboard-visual.js'
import type { ShortcutProfileCardProps as SlotShortcutProfileCardProps } from '../contract/slots.js'
import { decodeCustomProfileJson, encodeCustomProfileJson } from '../settings/custom-profile-json.js'
import { downloadCustomProfileJson, readCustomProfileFile } from '../settings/custom-profile-files.js'
import { ShortcutIcon, type ShortcutIconName } from './ShortcutIcon.js'
import { CustomProfileEditor, type EditableCustomProfile } from './CustomProfileEditor.js'
import { ShortcutLegend } from './ShortcutLegend.js'
import styles from '../styles/Shortcuts.module.css'

export type ShortcutProfileCardProps = Omit<SlotShortcutProfileCardProps, keyof import('@deepseek-ai/dsh-client-ui-settings-plugins/client').SettingsPluginItemOwnerProps> & {
  readonly t?: (key: ShortcutLocaleKey | string) => string
  readonly platform: ShortcutPlatform
}

type EditorState = { dirty: boolean; saving: boolean; externalChange: boolean }
type Message = { kind: 'status' | 'alert'; text: string }

const fallbackT = (key: string): string => key
const idleEditor: EditorState = { dirty: false, saving: false, externalChange: false }

function IconButton({ name, label, disabled, describedBy, onClick }: {
  readonly name: ShortcutIconName
  readonly label: string
  readonly disabled?: boolean
  readonly describedBy?: string
  readonly onClick: () => void
}): React.ReactElement {
  return <button type="button" className={styles.iconButton} title={label} aria-label={label} aria-describedby={describedBy} disabled={disabled} onClick={onClick}>
    <ShortcutIcon name={name} size={16} />
  </button>
}

/** Settings UI uses the latest runtime snapshot as authoritative after every save attempt. */
export function ShortcutProfileCard({ settings, availableGlobalActions, platform, t = fallbackT }: ShortcutProfileCardProps): React.ReactElement {
  const [, refresh] = useState(0)
  const [open, setOpen] = useState(false)
  const [operation, setOperation] = useState<string>()
  const [selection, setSelection] = useState(() => settings.activeProfileId())
  const [message, setMessage] = useState<Message>()
  const [editor, setEditor] = useState<EditorState>(idleEditor)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const requestId = useRef(0)
  const pendingRef = useRef<string>()
  const fileInput = useRef<HTMLInputElement>(null)
  const id = useId()
  const titleId = `shortcut-settings-title-${id}`
  const bodyId = `shortcut-settings-body-${id}`
  const fileInputId = `shortcut-profile-file-${id}`
  const exportReasonId = `shortcut-profile-export-reason-${id}`
  const registryProfiles = settings.profiles()
  const currentProfile = registryProfiles.find(profile => profile.id === selection)
    ?? registryProfiles.find(profile => profile.id === settings.activeProfileId())
  const currentCustom = currentProfile?.kind === 'custom' ? currentProfile : undefined
  const settingsFailure = settings.error()
  const busy = operation !== undefined || editor.saving
  const persistenceDisabled = busy || !settings.writable()
  const exportReason = editor.externalChange ? t('settings.externalExport') : editor.dirty ? t('settings.unsavedExport') : undefined

  const saveCustomProfile = async (profileId: string, baselineFingerprint: string, name: string, bindings: readonly ShortcutProfile['bindings'][number][]): Promise<EditableCustomProfile> => {
    await settings.saveCustomProfile(profileId, baselineFingerprint, name, bindings)
    const saved = settings.profiles().find(profile => profile.id === profileId && profile.kind === 'custom')
    if (saved === undefined) throw new Error(`custom shortcut profile is unavailable: ${profileId}`)
    return { id: saved.id, name: saved.persistedName ?? saved.displayName, bindings: saved.bindings, fingerprint: saved.fingerprint }
  }

  useEffect(() => settings.subscribe(() => {
    setSelection(settings.activeProfileId())
    refresh(value => value + 1)
  }), [settings])
  const choose = async (profileId: string): Promise<void> => {
    if (busy || pendingRef.current !== undefined || profileId === settings.activeProfileId()) return
    const currentRequest = ++requestId.current
    pendingRef.current = profileId
    setSelection(profileId)
    setOperation('select')
    setMessage(undefined)
    try {
      await settings.setActiveProfile(profileId)
    } catch (reason) {
      if (currentRequest === requestId.current) setMessage({ kind: 'alert', text: t('settings.error').replace('{message}', errorText(reason)) })
    } finally {
      if (currentRequest !== requestId.current) return
      pendingRef.current = undefined
      setOperation(undefined)
      setSelection(settings.activeProfileId())
    }
  }

  const createProfile = async (): Promise<void> => {
    if (persistenceDisabled) return
    setOperation('create')
    setMessage(undefined)
    try {
      const profileId = await settings.createCustomProfile()
      await settings.setActiveProfile(profileId)
    } catch (reason) {
      setMessage({ kind: 'alert', text: t('settings.error').replace('{message}', errorText(reason)) })
    } finally {
      setSelection(settings.activeProfileId())
      setOperation(undefined)
    }
  }

  const importFile = async (file: File): Promise<void> => {
    if (persistenceDisabled) return
    setOperation('import')
    setMessage(undefined)
    try {
      const source = await readCustomProfileFile(file)
      const profile = decodeCustomProfileJson(source.text, source.bytes)
      const profileId = await settings.importCustomProfile(profile)
      await settings.setActiveProfile(profileId)
      setMessage({ kind: 'status', text: t('settings.importSucceeded') })
    } catch (reason) {
      const failure = settings.error()
      if (failure?.operation === 'import' && failure.partial === 'profile-saved') {
        setMessage({ kind: 'status', text: t('settings.importPartial') })
      } else {
        setMessage({ kind: 'alert', text: t('settings.importError').replace('{message}', errorText(reason)) })
      }
    } finally {
      if (fileInput.current !== null) fileInput.current.value = ''
      setSelection(settings.activeProfileId())
      setOperation(undefined)
    }
  }

  const exportProfile = (): void => {
    if (currentCustom === undefined || busy || exportReason !== undefined) return
    setMessage(undefined)
    try {
      const profile = settings.exportActiveCustomProfile()
      downloadCustomProfileJson(document, URL, customProfileFilename(profile.name), encodeCustomProfileJson(profile))
      setMessage({ kind: 'status', text: t('settings.exportSucceeded') })
    } catch (reason) {
      setMessage({ kind: 'alert', text: t('settings.exportError').replace('{message}', errorText(reason)) })
    }
  }

  const deleteProfile = async (): Promise<void> => {
    if (currentCustom === undefined || persistenceDisabled || editor.externalChange) return
    setOperation('delete')
    setMessage(undefined)
    try {
      await settings.deleteCustomProfile(currentCustom.id)
      setConfirmDelete(false)
      setMessage({ kind: 'status', text: t('settings.deleteSucceeded') })
    } catch (reason) {
      const failure = settings.error()
      if (failure?.operation === 'delete' && failure.partial === 'selection-changed') {
        setMessage({ kind: 'status', text: t('settings.deletePartial') })
      } else {
        setMessage({ kind: 'alert', text: t('settings.deleteError').replace('{message}', errorText(reason)) })
      }
    } finally {
      setSelection(settings.activeProfileId())
      setOperation(undefined)
    }
  }

  const toolbar = <div className={styles.profileToolbar} aria-label={t('settings.profileActions')}>
    <IconButton name="plus" label={t('settings.new')} disabled={persistenceDisabled} onClick={() => void createProfile()} />
    <IconButton name="upload" label={t('settings.upload')} disabled={persistenceDisabled} onClick={() => fileInput.current?.click()} />
    <label htmlFor={fileInputId} className={styles.visuallyHidden}>{t('settings.fileInput')}</label>
    <input ref={fileInput} id={fileInputId} className={styles.visuallyHidden} type="file" accept="application/json,.json" disabled={persistenceDisabled} onChange={event => {
      const file = event.target.files?.[0]
      if (file !== undefined) void importFile(file)
    }} />
    {currentCustom !== undefined ? <>
      <IconButton name="download" label={t('settings.download')} describedBy={exportReason === undefined ? undefined : exportReasonId} disabled={busy || exportReason !== undefined} onClick={exportProfile} />
      <IconButton name="trash-2" label={t('settings.delete')} disabled={persistenceDisabled || editor.externalChange} onClick={() => setConfirmDelete(true)} />
    </> : null}
  </div>

  const body = registryProfiles.length === 0
    ? <p role="status" className={styles.empty}>{t('settings.empty')}</p>
    : <>
      <fieldset className={styles.profileSelectGroup} disabled={busy}>
        <legend>{t('settings.profile')}</legend>
        <div className={styles.profileSelectRow}>
          <label className={styles.profileSelect}>
            <span>{t('settings.currentProfile')}</span>
            <select aria-label={t('settings.profile')} value={selection} onChange={event => void choose(event.target.value)}>
              {registryProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.kind === 'custom' ? profile.displayName : t(profile.label)}</option>)}
            </select>
          </label>
          {toolbar}
          {busy ? <span role="status" className={styles.operationStatus}>{t('settings.saving')}</span> : null}
        </div>
      </fieldset>
      {exportReason !== undefined ? <p id={exportReasonId} className={styles.operationReason}>{exportReason}</p> : null}
      {confirmDelete && currentCustom !== undefined ? <div className={styles.deleteConfirm}>
        <span>{t('settings.deleteConfirm')}</span>
        <button type="button" disabled={busy} onClick={() => { setConfirmDelete(false); setMessage(undefined) }}>{t('settings.deleteCancel')}</button>
        <button type="button" disabled={busy} onClick={() => void deleteProfile()}>{t('settings.deleteConfirmAction')}</button>
      </div> : null}
      {message !== undefined ? <p role={message.kind} className={message.kind === 'alert' ? styles.error : styles.success}>{message.text}</p> : settingsFailure !== undefined ? <p role="alert" className={styles.error}>{t('settings.error').replace('{message}', settingsFailure.message)}</p> : null}
      {currentProfile === undefined ? <p role="status" className={styles.empty}>{t('settings.conflict')}</p> : currentCustom !== undefined ? <CustomProfileEditor key={currentCustom.id} profile={{ id: currentCustom.id, name: currentCustom.persistedName ?? currentCustom.displayName, bindings: currentCustom.bindings, fingerprint: currentCustom.fingerprint }} availableGlobalActions={availableGlobalActions as readonly GlobalShortcutCommand[] | undefined} platform={platform} t={t} disabled={busy || !settings.writable()} onSave={saveCustomProfile} onStateChange={setEditor} /> : <>
        <p className={styles.summary}>{currentProfile.description ? t(currentProfile.description) : ''}</p>
        <ShortcutLegend bindings={currentProfile.bindings} availableGlobalActions={availableGlobalActions as readonly GlobalShortcutCommand[] | undefined} platform={platform} t={t} />
      </>}
    </>

  const expandedLabel = t(open ? 'settings.collapse' : 'settings.expand')
  return <section className={clsx(styles.card, open && styles.cardOpen)} aria-labelledby={titleId}>
    <button type="button" className={styles.header} aria-expanded={open} aria-controls={bodyId} aria-label={`${expandedLabel}: ${t('settings.title')}`} onClick={() => setOpen(value => !value)}>
      <ShortcutIcon name={registryProfiles.length === 0 ? 'settings-2' : 'keyboard'} size={20} />
      <span className={styles.headerText}>
        <span id={titleId} className={styles.title}>{t('settings.title')}</span>
        <span className={styles.description}>{t('settings.description')}</span>
      </span>
      {busy ? <span role="status" className={styles.pending}>{t('settings.saving')}</span> : null}
      <ShortcutIcon name="chevron-down" size={14} className={clsx(styles.chevron, open && styles.chevronOpen)} />
    </button>
    {open ? <div id={bodyId} className={styles.body}>{body}</div> : null}
  </section>
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

export { ShortcutProfileCard as ProfileCard }
