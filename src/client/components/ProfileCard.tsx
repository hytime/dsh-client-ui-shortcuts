import React from 'react'
import type { ShortcutLocaleKey } from '../locales.js'
import type { ShortcutProfile } from '../contract/profile.js'
import type { ShortcutSettingsFace } from '../contract/settings.js'

export interface ProfileCardProps {
  readonly settings: ShortcutSettingsFace
  readonly profiles: readonly ShortcutProfile[]
  readonly t?: (key: ShortcutLocaleKey | string) => string
}

export function ProfileCard({ settings, profiles, t = key => key }: ProfileCardProps): React.ReactElement {
  const active = settings.activeProfileId()
  return <section>
    <h2>{t('settings.title')}</h2>
    <select aria-label={t('settings.profile')} value={active} onChange={event => void settings.setActiveProfile(event.target.value)}>
      {profiles.map(profile => <option key={profile.id} value={profile.id}>{t(profile.label)}</option>)}
    </select>
    {settings.error() ? <p role="alert">{settings.error()?.message}</p> : null}
  </section>
}
