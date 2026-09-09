import React, { useEffect, useRef, useState } from 'react'
import type { ShortcutBinding, ShortcutCommand, GlobalShortcutCommand } from '../contract/profile.js'
import type { ShortcutOverlayProps } from '../contract/overlay.js'
import { compatibleBindingSequences, visualizeStroke } from '../keyboard/visuals.js'
import { ShortcutKeycap, ShortcutKeycapPlus } from './ShortcutKeycap.js'
import styles from '../styles/ShortcutOverlay.module.css'

const SCOPES = ['question', 'approval', 'global'] as const

function isGlobal(command: ShortcutCommand): command is GlobalShortcutCommand {
  return command === 'startSession' || command === 'previousSession' || command === 'nextSession'
    || command === 'previousWorkspace' || command === 'nextWorkspace' || command === 'forkSession'
    || command === 'toggleTheme' || command === 'showShortcuts'
}

function profileChip(profile: { readonly kind: 'builtin' | 'custom'; readonly label: string; readonly displayName: string }, t: (key: string) => string): string {
  return profile.kind === 'custom' ? profile.displayName : t(profile.label)
}

/** Frame-wide centered shortcuts cheatsheet; renders nothing while closed. */
export function ShortcutOverlay({ settings, controller, availableGlobalActions, platform, t }: ShortcutOverlayProps): React.ReactElement | null {
  const [, setTick] = useState(0)
  const [query, setQuery] = useState('')
  const wasOpen = useRef(controller.isOpen())
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => settings.subscribe(() => setTick(value => value + 1)), [settings])
  useEffect(() => controller.subscribe(() => setTick(value => value + 1)), [controller])

  const open = controller.isOpen()
  useEffect(() => {
    if (open && !wasOpen.current) {
      restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setQuery('')
    } else if (!open && wasOpen.current && restoreFocus.current !== null) {
      restoreFocus.current.focus()
      restoreFocus.current = null
    }
    wasOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, controller])

  const activeProfile = settings.profiles().find(candidate => candidate.id === settings.activeProfileId()) ?? settings.profiles()[0]
  if (!open || activeProfile === undefined) return null

  const trimmed = query.trim().toLowerCase()
  const matches = (binding: ShortcutBinding): boolean => {
    if (trimmed === '') return true
    const commandName = t(`keyboard.${binding.command}`)
    const scopeName = t(`legend.scope.${binding.scope}`)
    return commandName.toLowerCase().includes(trimmed) || scopeName.toLowerCase().includes(trimmed) || binding.command.toLowerCase().includes(trimmed)
  }
  const unavailable = (binding: ShortcutBinding): boolean => (
    binding.scope === 'global' && isGlobal(binding.command) && !availableGlobalActions.includes(binding.command)
  )
  const hasRows = activeProfile.bindings.some(matches)

  const renderRow = (binding: ShortcutBinding, index: number): React.ReactElement[] => {
    const sequences = compatibleBindingSequences(binding, platform)
    if (sequences.length === 0) return []
    const disabled = unavailable(binding)
    return sequences.map((sequence, sequenceIndex) => (
      <div
        className={disabled ? `${styles.row} ${styles.rowDisabled}` : styles.row}
        role="listitem"
        key={`${binding.command}-${binding.scope}-${index}-${sequenceIndex}`}
        {...(disabled ? { 'aria-disabled': true as const } : {})}
      >
        <span className={styles.rowCommand}>{t(`keyboard.${binding.command}`)}</span>
        {disabled
          ? <span className={styles.rowReason}>{t('overlay.unavailable')}</span>
          : <span className={styles.rowKeys}>{sequence.flatMap(stroke => visualizeStroke(stroke, platform)).map((visual, keyIndex, visuals) => (
            <React.Fragment key={`${visual.ariaLabel}-${keyIndex}`}>
              <ShortcutKeycap visual={visual} />
              {keyIndex < visuals.length - 1 ? <ShortcutKeycapPlus /> : null}
            </React.Fragment>
          ))}</span>}
      </div>
    ))
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={t('overlay.title')}
      onClick={event => {
        if (event.target === event.currentTarget) controller.close()
      }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>{t('overlay.title')}<span className={styles.chip}> {profileChip(activeProfile, t)}</span></span>
          <span className={styles.closeHint}>{t('overlay.closeHint')}</span>
        </div>
        <input
          className={styles.search}
          type="search"
          role="searchbox"
          aria-label={t('overlay.searchPlaceholder')}
          placeholder={t('overlay.searchPlaceholder')}
          value={query}
          autoFocus
          onChange={event => setQuery(event.target.value)}
        />
        <div className={styles.list}>
          {!hasRows && trimmed !== ''
            ? <p className={styles.empty}>{t('overlay.searchEmpty')}</p>
            : SCOPES.map(scope => {
              const rows = activeProfile.bindings.flatMap((binding, index) => binding.scope === scope && matches(binding) ? renderRow(binding, index) : [])
              if (rows.length === 0) return null
              return (
                <section key={scope} aria-label={t(`legend.scope.${scope}`)}>
                  <div className={styles.groupLabel}>{t(`legend.scope.${scope}`)}</div>
                  <div role="list">{rows}</div>
                </section>
              )
            })}
        </div>
      </div>
    </div>
  )
}
