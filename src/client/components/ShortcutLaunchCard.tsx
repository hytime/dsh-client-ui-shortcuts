import React, { useEffect, useState } from 'react'
import type { ShortcutLaunchCardProps } from '../contract/overlay.js'
import { compatibleBindingSequences, visualizeStroke } from '../keyboard/visuals.js'
import { ShortcutKeycap, ShortcutKeycapPlus } from './ShortcutKeycap.js'
import { ShortcutIcon } from './ShortcutIcon.js'
import styles from '../styles/Shortcuts.module.css'

/** Settings-page entry that shows the open-panel shortcut and opens the manager panel. */
export function ShortcutLaunchCard({ settings, platform, t, onOpen, view }: ShortcutLaunchCardProps): React.ReactElement {
  const [, setTick] = useState(0)
  useEffect(() => settings.subscribe(() => setTick(value => value + 1)), [settings])

  // The bundle-config seat asks for a one-liner before the card is opened.
  if (view === 'summary') return <React.Fragment>{t('launch.hint')}</React.Fragment>

  const activeProfile = settings.profiles().find(candidate => candidate.id === settings.activeProfileId()) ?? settings.profiles()[0]
  const binding = activeProfile?.bindings.find(candidate => candidate.command === 'showShortcuts')
  const sequence = binding === undefined ? [] : compatibleBindingSequences(binding, platform)[0] ?? []

  return (
    <section className={styles.launchCard} aria-label={t('launch.title')}>
      <div className={styles.launchHeader}>
        <span className={styles.launchHeading}>
          <ShortcutIcon name="keyboard" size={20} />
          <span className={styles.title}>{t('launch.title')}</span>
        </span>
        {sequence.length > 0 ? (
          <span className={styles.legendKeys}>
            {sequence.flatMap(stroke => visualizeStroke(stroke, platform)).map((visual, keyIndex, visuals) => (
              <React.Fragment key={`${visual.ariaLabel}-${keyIndex}`}>
                <ShortcutKeycap visual={visual} />
                {keyIndex < visuals.length - 1 ? <ShortcutKeycapPlus /> : null}
              </React.Fragment>
            ))}
          </span>
        ) : null}
      </div>
      <p className={styles.description}>{t('launch.hint')}</p>
      <button type="button" className={styles.onboardingClose} onClick={onOpen}>{t('launch.open')}</button>
    </section>
  )
}
