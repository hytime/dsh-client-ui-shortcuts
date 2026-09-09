import React, { useEffect, useRef, useState } from 'react'
import type { ShortcutBinding, GlobalShortcutCommand } from '../contract/profile.js'
import type { ShortcutOverlayProps } from '../contract/overlay.js'
import { compatibleBindingSequences, visualizeStroke } from '../keyboard/visuals.js'
import { ShortcutKeycap, ShortcutKeycapPlus } from './ShortcutKeycap.js'
import { ShortcutManagerPanel } from './ShortcutManagerPanel.js'
import styles from '../styles/ShortcutOverlay.module.css'

const SCOPES = ['question', 'approval', 'global'] as const

function profileChip(profile: { readonly kind: 'builtin' | 'custom'; readonly label: string; readonly displayName: string }, t: (key: string) => string): string {
  return profile.kind === 'custom' ? profile.displayName : t(profile.label)
}

/** Frame-wide centered shortcuts manager + quick reference; renders nothing while closed. */
export function ShortcutOverlay({ settings, controller, availableGlobalActions, platform, t, restoreFocus, initialFocusCommand }: ShortcutOverlayProps): React.ReactElement | null {
  const [, setTick] = useState(0)
  const [query, setQuery] = useState(() => {
    const focusCommand = initialFocusCommand ?? controller.focusCommand?.() as GlobalShortcutCommand | undefined
    return focusCommand === undefined ? '' : t(`keyboard.${focusCommand}`)
  })
  const wasOpen = useRef(controller.isOpen())

  useEffect(() => settings.subscribe(() => setTick(value => value + 1)), [settings])
  useEffect(() => controller.subscribe(() => setTick(value => value + 1)), [controller])

  const open = controller.isOpen()
  useEffect(() => {
    if (open && !wasOpen.current) {
      // On open, prefill the search box with the located command's display name so the
      // quick-reference narrows to that row; typing afterwards is preserved.
      const focusCommand = initialFocusCommand ?? controller.focusCommand?.() as GlobalShortcutCommand | undefined
      setQuery(focusCommand === undefined ? '' : t(`keyboard.${focusCommand}`))
    } else if (!open && wasOpen.current) {
      const target = restoreFocus?.()
      if (target !== undefined && target !== null && target.isConnected) target.focus()
    }
    wasOpen.current = open
  }, [open, controller, initialFocusCommand, restoreFocus, t])

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
    binding.scope === 'global' && !availableGlobalActions.includes(binding.command as GlobalShortcutCommand)
  )
  const readonlyProfile = activeProfile.kind !== 'custom'
  const hasRows = activeProfile.bindings.some(matches)

  const renderRow = (binding: ShortcutBinding, index: number): React.ReactElement[] => {
    const sequences = compatibleBindingSequences(binding, platform)
    if (sequences.length === 0) return []
    const located = binding.command === (initialFocusCommand ?? controller.focusCommand?.())
    // A true capability gap: the row is genuinely unavailable (greyed + aria-disabled).
    const unavailableRow = unavailable(binding)
    // Located on a built-in profile: the display row is not interactive, so it is highlighted
    // (aria-current + focused) with a hint instead of being marked aria-disabled.
    const locatedReadonly = located && readonlyProfile
    const reason = unavailableRow
      ? t('overlay.unavailable')
      : locatedReadonly
        ? t('overlay.readonlyHint')
        : undefined
    const classes = [styles.row]
    if (located) classes.push(styles.focused)
    if (unavailableRow) classes.push(styles.rowDisabled)
    return sequences.map((sequence, sequenceIndex) => (
      <div
        className={classes.join(' ')}
        role="listitem"
        key={`${binding.command}-${binding.scope}-${index}-${sequenceIndex}`}
        {...(unavailableRow ? { 'aria-disabled': true as const } : {})}
        {...(located ? { 'aria-current': true as const } : {})}
      >
        <span className={styles.rowCommand}>{t(`keyboard.${binding.command}`)}</span>
        {reason !== undefined
          ? <span className={styles.rowReason}>{reason}</span>
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
        <div className={styles.managerArea}>
          <ShortcutManagerPanel settings={settings} availableGlobalActions={availableGlobalActions} platform={platform} t={t} hideLegend />
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
