import React, { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import type { ShortcutLocaleKey } from '../locales.js'
import type { ShortcutProfile } from '../contract/profile.js'
import type { ShortcutProfileCardProps as SlotShortcutProfileCardProps } from '../contract/slots.js'
import { ShortcutIcon } from './ShortcutIcon.js'
import { ShortcutLegend } from './ShortcutLegend.js'
import styles from '../styles/Shortcuts.module.css'

export type ShortcutProfileCardProps = Omit<SlotShortcutProfileCardProps, keyof import('@deepseek-ai/dsh-client-ui-settings-plugins/client').SettingsPluginItemOwnerProps> & {
  readonly t?: (key: ShortcutLocaleKey | string) => string
}

const fallbackT = (key: string): string => key

/** Settings UI uses the latest runtime snapshot as authoritative after every save attempt. */
export function ShortcutProfileCard({ settings, profiles, t = fallbackT }: ShortcutProfileCardProps): React.ReactElement {
  const [, refresh] = useState(0)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string>()
  const [selection, setSelection] = useState(() => settings.activeProfileId())
  const [error, setError] = useState<string>()
  const requestId = useRef(0)
  const pendingRef = useRef<string>()
  const id = useId()
  const titleId = `shortcut-settings-title-${id}`
  const bodyId = `shortcut-settings-body-${id}`
  const active = profiles.find(profile => profile.id === selection) ?? profiles.find(profile => profile.id === settings.activeProfileId())

  useEffect(() => settings.subscribe(() => {
    setSelection(settings.activeProfileId())
    refresh(value => value + 1)
  }), [settings])

  const choose = async (profileId: string): Promise<void> => {
    if (pendingRef.current !== undefined || profileId === settings.activeProfileId()) return
    const currentRequest = ++requestId.current
    pendingRef.current = profileId
    setSelection(profileId)
    setPending(profileId)
    setError(undefined)
    try {
      await settings.setActiveProfile(profileId)
    } catch (reason) {
      if (currentRequest !== requestId.current) return
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (currentRequest !== requestId.current) return
      const latest = settings.activeProfileId()
      pendingRef.current = undefined
      setPending(undefined)
      setSelection(latest)
    }
  }

  const body = profiles.length === 0
    ? <p role="status" className={styles.empty}>{t('settings.empty')}</p>
    : (
      <>
        <fieldset className={styles.profileSelectGroup} disabled={pending !== undefined}>
          <legend>{t('settings.profile')}</legend>
          <label className={styles.profileSelect}>
            <span>{t('settings.currentProfile')}</span>
            <select aria-label={t('settings.profile')} value={selection} onChange={event => void choose(event.target.value)}>
              {profiles.map(profile => <option key={profile.id} value={profile.id}>{t(profile.label)}</option>)}
            </select>
            {pending !== undefined ? <span role="status">{t('settings.saving')}</span> : null}
          </label>
        </fieldset>
        {error !== undefined || settings.error() !== undefined ? <p role="alert" className={styles.error}>{t('settings.error').replace('{message}', error ?? settings.error() ?? '')}</p> : null}
        {active === undefined ? <p role="status" className={styles.empty}>{t('settings.conflict')}</p> : <>
          <p className={styles.summary}>{active.description ? t(active.description) : ''}</p>
          <ShortcutLegend bindings={active.bindings} t={t} />
        </>}
      </>
    )

  const expandedLabel = t(open ? 'settings.collapse' : 'settings.expand')
  return <section className={clsx(styles.card, open && styles.cardOpen)} aria-labelledby={titleId}>
    <button
      type="button"
      className={styles.header}
      aria-expanded={open}
      aria-controls={bodyId}
      aria-label={`${expandedLabel}: ${t('settings.title')}`}
      onClick={() => { setOpen(value => !value) }}
    >
      <ShortcutIcon name={profiles.length === 0 ? 'settings-2' : 'keyboard'} size={20} />
      <span className={styles.headerText}>
        <span id={titleId} className={styles.title}>{t('settings.title')}</span>
        <span className={styles.description}>{t('settings.description')}</span>
      </span>
      {pending !== undefined ? <span role="status" className={styles.pending}>{t('settings.saving')}</span> : null}
      <ShortcutIcon name="chevron-down" size={14} className={clsx(styles.chevron, open && styles.chevronOpen)} />
    </button>
    {open ? <div id={bodyId} className={styles.body}>{body}</div> : null}
  </section>
}

export { ShortcutProfileCard as ProfileCard }
