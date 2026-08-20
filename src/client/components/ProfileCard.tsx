import React from 'react'
import type { ShortcutProfile } from '../contract/profile.js'
import type { ShortcutSettingsFace } from '../settings/controller.js'

export interface ProfileCardProps {
  readonly settings: ShortcutSettingsFace
  readonly profiles: readonly ShortcutProfile[]
}

export function ProfileCard({ settings, profiles }: ProfileCardProps): React.ReactElement {
  const active = settings.activeProfileId()
  return <section><h2>Shortcuts</h2><select value={active} onChange={event => void settings.setActiveProfile(event.target.value)}>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select>{settings.error() ? <p role="alert">{settings.error()}</p> : null}</section>
}
