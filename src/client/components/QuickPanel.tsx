import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Button, Modal, ShortcutKeys, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { QuickPanelCommand, QuickPanelMessage, QuickPanelProps } from '../contract/quick-panel.js'
import { bindingFromKey, isRecordable } from '../keyboard/record.js'
import { PROFILE_SHORTCUT_MODAL } from '../keyboard/open-panel.js'
import styles from '../styles/QuickPanel.module.css'

function messageText(message: QuickPanelMessage, t: (key: string) => string): string {
  if (message.code === 'conflict') return t('quick.conflict').replace('{commands}', (message.detail ?? []).join(', '))
  if (message.code === 'import-partial') return t('quick.import-partial').replace('{commands}', (message.detail ?? []).join(', '))
  return t(`quick.${message.code}`)
}

const CONFIG_FILE_NAME = 'dsh-shortcuts-config.json'

/** Download one exported document through a temporary object URL; revoked after the click. */
function downloadConfig(raw: string): void {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = CONFIG_FILE_NAME
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** One official command row: current keycaps plus per-command record, reset, and clear. */
function CommandRow({ command, state, model, t }: {
  readonly command: QuickPanelCommand
  readonly state: { readonly recordingCommand: string | null; readonly officialWritable: boolean; readonly saving: boolean }
  readonly model: QuickPanelProps['model']
  readonly t: (key: string) => string
}): React.ReactElement {
  const recording = state.recordingCommand === command.id
  const blocked = !state.officialWritable || state.saving
  const issue = command.issue !== null || command.conflicts.length > 0
  return <div className={styles.commandRow} data-recording={recording ? 'true' : undefined}>
    <span className={styles.commandLabel} title={command.label}>{command.label}</span>
    <span className={styles.commandKeys}>
      {command.keys.length > 0
        ? <ShortcutKeys keys={command.keys} />
        : <span className={styles.unbound}>{t('quick.unbound')}</span>}
    </span>
    <span className={styles.commandActions}>
      <button type="button" className={styles.commandAction} disabled={blocked} aria-pressed={recording}
        aria-label={`${recording ? t('quick.recording') : t('quick.record')} ${command.label}`}
        data-recording={recording ? 'true' : undefined}
        onClick={() => { if (recording) model.stopRecording(); else void model.startRecording(command.id) }}>
        {recording ? t('quick.recording') : t('quick.record')}
      </button>
      <button type="button" className={styles.commandAction} disabled={blocked}
        aria-label={`${t('quick.reset')} ${command.label}`}
        onClick={() => { void model.resetCommand(command.id) }}>{t('quick.reset')}</button>
      {command.keys.length > 0
        ? <button type="button" className={styles.commandAction} disabled={blocked}
          aria-label={`${t('quick.clear')} ${command.label}`}
          onClick={() => { void model.clearCommand(command.id) }}>{t('quick.clear')}</button>
        : null}
    </span>
    {issue ? <span role="status" className={styles.commandIssue}>{t('quick.shortcutIssue')}</span> : null}
  </div>
}

function PanelContent({ model, t }: QuickPanelProps): React.ReactElement {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot)
  const recorder = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  // Desktop suppresses native accelerators for the whole window while recording, so the last
  // surface to unmount must release it; otherwise the user's own shortcuts stay disabled.
  useEffect(() => () => { model.releaseSurface() }, [model])
  useEffect(() => {
    if (state.recordingCommand === null) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (document.activeElement !== recorder.current || !isRecordable(event)) return
      const candidate = bindingFromKey(event)
      if (candidate === 'ignore') return
      // Consuming stops the recorded combination from also reaching official dispatch.
      event.preventDefault()
      event.stopPropagation()
      if (candidate === 'cancel') { model.stopRecording(); return }
      void model.finishRecording(candidate)
    }
    document.addEventListener('keydown', onKeyDown, true)
    recorder.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [model, state.recordingCommand])

  const summon = state.commands.find(command => command.id === 'hytime.shortcuts.open')
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return state.commands
    return state.commands.filter(command =>
      command.label.toLowerCase().includes(needle)
      || command.id.toLowerCase().includes(needle)
      || command.keys.join('').toLowerCase().includes(needle))
  }, [query, state.commands])

  return <div className={styles.content}>
    <div className={styles.binding}>
      <span id="quick-binding-label">{t('quick.binding')}</span>
      {summon !== undefined && summon.keys.length > 0
        ? <ShortcutKeys keys={summon.keys} />
        : <span className={styles.unbound}>{t('quick.unbound')}</span>}
    </div>
    <div className={styles.row}>
      <span>{t('quick.config')}</span>
      <span className={styles.configActions}>
        <Button variant="ghost" disabled={state.saving} onClick={() => {
          try { downloadConfig(model.exportConfig()) }
          catch { /* A blocked download must not leave the panel without feedback. */ }
        }}>{t('quick.export')}</Button>
        <label className={styles.importLabel}>
          <input type="file" accept="application/json,.json" disabled={state.saving} className={styles.fileInput}
            aria-label={t('quick.import')}
            onChange={event => {
              const file = event.target.files?.[0]
              // Reset so choosing the same file again still fires a change event.
              event.target.value = ''
              if (file === undefined) return
              void file.text().then(text => model.importConfig(text), () => model.importConfig(null))
            }} />
          <span className={styles.importButton} aria-hidden="true">{t('quick.import')}</span>
        </label>
      </span>
    </div>
    <p className={styles.hint}>{t('quick.officialHint')}</p>
    {state.message !== null ? <p role="alert" className={styles.error}>{messageText(state.message, t)}</p> : null}
    {!state.officialWritable ? <p role="status" className={styles.hint}>{t('quick.officialReadOnly')}</p> : null}

    <section className={styles.commands} aria-label={t('quick.commands')}>
      <div className={styles.commandsHeader}>
        <span>{t('quick.commands')}</span>
        <span className={styles.commandsHint}>{t('quick.commandsHint')}</span>
      </div>
      {/* The official Modal captures the invoking control, so it must own initial focus:
          React's `autoFocus` would run first and leave the return-focus target detached. */}
      <input type="search" className={styles.search} value={query} placeholder={t('quick.search')}
        aria-label={t('quick.search')} data-modal-autofocus
        onChange={event => { setQuery(event.target.value) }} />
      <div ref={scrollRef} className={styles.commandScroll} tabIndex={0} role="group" aria-label={t('quick.commands')}>
        {visible.length === 0
          ? <p className={styles.hint}>{state.commands.length === 0 ? t('quick.commandsEmpty') : t('quick.searchEmpty')}</p>
          : visible.map(command => (
            <CommandRow key={command.id} command={command} state={state} model={model} t={t} />
          ))}
      </div>
      {/* Focusable recorder target: while a command row is armed, this node owns the captured key. */}
      <button ref={recorder} type="button" className={styles.srOnlyRecorder} tabIndex={-1}
        aria-hidden="true" aria-label={t('quick.recording')} />
    </section>

    <div className={styles.settingRow}>
      <strong className={styles.settingTitle}>{t('quick.question')}</strong>
      <Switch label={t('quick.question')} checked={state.questionEnabled} disabled={!state.writable || state.saving}
        onChange={enabled => { void model.setEnabled('questionEnabled', enabled) }} />
      <p className={styles.settingHint}>{t('quick.questionHint')}</p>
    </div>
    <div className={styles.settingRow}>
      <strong className={styles.settingTitle}>{t('quick.approval')}</strong>
      <Switch label={t('quick.approval')} checked={state.approvalEnabled} disabled={!state.writable || state.saving}
        onChange={enabled => { void model.setEnabled('approvalEnabled', enabled) }} />
      <p className={styles.settingHint}>{t('quick.approvalHint')}</p>
    </div>
    {!state.writable ? <p role="status" className={styles.hint}>{t('quick.unavailable')}</p> : null}
    {state.saving ? <p role="status" className={styles.hint}>{t('quick.saving')}</p> : null}
  </div>
}

export function QuickPanel({ model, t }: QuickPanelProps): React.ReactElement {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot)
  return <Modal open={state.open} onClose={model.close} title={t('quick.title')} closeLabel={t('quick.close')}
    shortcutModal={PROFILE_SHORTCUT_MODAL} className={styles.panel}>
    <PanelContent model={model} t={t} />
  </Modal>
}

/** Click access survives an unbound or conflicting official command. */
export function QuickPanelSettings({ model, t, view }: QuickPanelProps & { readonly view: 'summary' | 'page' }): React.ReactElement {
  if (view === 'summary') return <>{t('quick.summary')}</>
  return <section aria-label={t('quick.title')} className={styles.settings}>
    <Button onClick={model.open}>{t('quick.open')}</Button>
    <PanelContent model={model} t={t} />
  </section>
}
