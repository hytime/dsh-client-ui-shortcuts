import React, { useEffect, useRef, useState } from 'react'
import type { ApprovalWait } from '../contract/slots.js'
import type { ShortcutProfile } from '../contract/profile.js'
import { resolveKey } from '../keyboard/resolve.js'
import type { KeyInput } from '../contract/keyboard.js'
import { InteractionSurface } from './InteractionSurface.js'
import styles from '../styles/InteractionSurface.module.css'

const composing = (event: React.KeyboardEvent<HTMLElement>): boolean => event.nativeEvent.isComposing || (event.nativeEvent as KeyboardEvent).isComposing

interface ApprovalFlowProps {
  readonly matched: ApprovalWait
  readonly activeProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
  readonly platform: 'mac' | 'windows' | 'linux'
}
export function ApprovalFlow({ matched, activeProfile, t, cancelTask, platform }: ApprovalFlowProps): React.ReactElement {
  const [choice, setChoice] = useState<'allowed-once' | 'rejected'>('allowed-once')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [focusIndex, setFocusIndex] = useState(0)
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([])
  useEffect(() => { actionRefs.current[focusIndex]?.focus() }, [focusIndex, matched.key])
  useEffect(() => {
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return
    const first = actionRefs.current.find(element => element !== null && !element.disabled)
    first?.focus()
  }, [matched.key])
  const moveFocus = (delta: number) => setFocusIndex(current => (current + delta + 2) % 2)
  const answer = async (outcome: 'allowed-once' | 'rejected'): Promise<void> => {
    if (busy) return
    setChoice(outcome)
    setBusy(true)
    setError(undefined)
    try {
      const receipt = await matched.respond({
        ok: true,
        value: { sessionId: matched.sessionId, approvalId: matched.payload.approvalId, outcome },
      })
      if (!receipt.accepted) throw new Error(receipt.reason)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const input: KeyInput = { key: event.key, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, composing: composing(event), keyCode: event.keyCode, repeat: event.repeat, disabled: busy }
    const decision = resolveKey(activeProfile, 'approval', input, platform)
    if (decision.kind === 'pass') return
    event.preventDefault()
    if (decision.command === 'cancelTask') { void cancelTask().catch(cause => { setError(cause instanceof Error ? cause.message : String(cause)); setBusy(false) }); return }
    if (decision.command === 'activate') void answer(choice)
    if (decision.command === 'focusPrevious' || decision.command === 'focusNext') {
      const delta = decision.command === 'focusPrevious' ? -1 : 1
      moveFocus(delta)
    }
  }
  return <InteractionSurface kind="approval" data-approval-key={matched.key} onKeyDown={onKeyDown} aria-busy={busy}>
    <div className={styles.card}>
      <header className={styles.header}>
        <strong>{t('approval.title')}</strong>
      </header>
      <div className={styles.body} data-testid="approval-scroll" data-approval-scroll tabIndex={0} role="group" aria-label={t('approval.details')}>
        <p className={styles.detail}>{matched.payload.reason ?? matched.payload.toolName}</p>
      </div>
      <div className={styles.actions} data-testid="approval-actions" role="group" aria-label={t('approval.actions')}>
        <button className={styles.approvalReject} ref={node => { actionRefs.current[1] = node }} type="button" disabled={busy} aria-pressed={choice === 'rejected'} onClick={() => { setFocusIndex(1); void answer('rejected') }}>{t('approval.reject')}</button>
        <button className={styles.approvalAllow} ref={node => { actionRefs.current[0] = node }} autoFocus type="button" disabled={busy} aria-pressed={choice === 'allowed-once'} onClick={() => { setFocusIndex(0); void answer('allowed-once') }}>{t('approval.allowOnce')}</button>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  </InteractionSurface>
}
