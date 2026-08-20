import React, { useEffect, useState } from 'react'
import type { ShortcutProfile } from '../contract/profile.js'
import type { ShortcutSettingsFace } from '../settings/controller.js'
import type { ShortcutLocaleKey } from '../locales.js'
import { ShortcutIcon } from './ShortcutIcon.js'
import { ShortcutLegend } from './ShortcutLegend.js'
import styles from '../styles/Shortcuts.module.css'

export interface ShortcutProfileCardProps {
  readonly settings: ShortcutSettingsFace
  readonly profiles: readonly ShortcutProfile[]
  readonly t?: (key: ShortcutLocaleKey | string) => string
}

const fallbackT = (key: string): string => key

export function ShortcutProfileCard({ settings, profiles, t = fallbackT }: ShortcutProfileCardProps): React.ReactElement {
  const [, refresh] = useState(0)
  const [pending, setPending] = useState<string>()
  const [selection, setSelection] = useState(() => settings.activeProfileId())
  const [error, setError] = useState<string>()

  useEffect(() => settings.subscribe(() => {
    setSelection(settings.activeProfileId())
    refresh(value => value + 1)
  }), [settings])

  const active = profiles.find(profile => profile.id === selection) ?? profiles.find(profile => profile.id === settings.activeProfileId())
  const choose = async (id: string): Promise<void> => {
    if (pending !== undefined || id === settings.activeProfileId()) return
    const previous = settings.activeProfileId()
    setSelection(id)
    setPending(id)
    setError(undefined)
    try {
      await settings.setActiveProfile(id)
    } catch (reason) {
      setSelection(previous)
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setPending(undefined)
    }
  }

  if (profiles.length === 0) return <section className={styles.card} aria-labelledby="shortcut-settings-title">
    <header className={styles.header}><ShortcutIcon name="settings-2" size={20} /><div><h2 id="shortcut-settings-title">{t('settings.title')}</h2><p>{t('settings.description')}</p></div></header>
    <p role="status" className={styles.empty}>{t('settings.empty')}</p>
  </section>

  return <section className={styles.card} aria-labelledby="shortcut-settings-title">
    <header className={styles.header}><ShortcutIcon name="keyboard" size={20} /><div><h2 id="shortcut-settings-title">{t('settings.title')}</h2><p>{t('settings.description')}</p></div></header>
    <fieldset className={styles.profiles} disabled={pending !== undefined}>
      <legend>{t('settings.profile')}</legend>
      {profiles.map(profile => <label className={`${styles.profile} ${selection === profile.id ? styles.selected : ''}`} key={profile.id}>
        <input type="radio" name="shortcut-profile" value={profile.id} checked={selection === profile.id} onChange={() => void choose(profile.id)} />
        <span><strong>{t(profile.label)}</strong><small>{t(profile.description)}</small></span>
        {selection === profile.id ? <ShortcutIcon name="check" size={16} /> : null}
        {pending === profile.id ? <span role="status">{t('settings.saving')}</span> : null}
      </label>)}
    </fieldset>
    {error !== undefined || settings.error() !== undefined ? <p role="alert" className={styles.error}>{t('settings.error').replace('{message}', error ?? settings.error() ?? '')}</p> : null}
    {active === undefined ? <p role="status" className={styles.empty}>{t('settings.conflict')}</p> : <>
      <p className={styles.summary}>{active.description ? t(active.description) : ''}</p>
      <ShortcutLegend bindings={active.bindings} t={t} />
    </>}
  </section>
}

export { ShortcutProfileCard as ProfileCard }
