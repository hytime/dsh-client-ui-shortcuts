import React, { useEffect, useRef, useState } from 'react'
import type { ApprovalWait } from '../contract/slots.js'
import { answerApproval, approvalDetail } from '../contract/slots.js'
import type { ShortcutProfile } from '../contract/profile.js'
import { resolveKey } from '../keyboard/resolve.js'
import type { KeyInput } from '../contract/keyboard.js'
import { InteractionSurface, focusInteraction } from './InteractionSurface.js'
import styles from '../styles/InteractionSurface.module.css'

const composing = (event: React.KeyboardEvent<HTMLElement>): boolean => event.nativeEvent.isComposing || (event.nativeEvent as KeyboardEvent).isComposing

interface ApprovalFlowProps {
  readonly matched: ApprovalWait
  readonly interactionProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
}
export function ApprovalFlow({ matched, interactionProfile, t, cancelTask }: ApprovalFlowProps): React.ReactElement {
  const [choice, setChoice] = useState<'allowed-once' | 'rejected'>('allowed-once')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [focusIndex, setFocusIndex] = useState(0)
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([])
  useEffect(() => { focusInteraction(actionRefs.current[focusIndex]) }, [focusIndex, matched.key])
  const focusedOutcome = (): 'allowed-once' | 'rejected' =>
    document.activeElement === actionRefs.current[1] ? 'rejected'
      : document.activeElement === actionRefs.current[0] ? 'allowed-once' : focusOutcome(focusIndex)
  /** Focus index 0 is allow-once and 1 is reject; keep the choice in step with focus. */
  const focusOutcome = (index: number): 'allowed-once' | 'rejected' => index === 0 ? 'allowed-once' : 'rejected'
  const onActionFocus = (index: number): void => { setFocusIndex(index); setChoice(focusOutcome(index)) }
  const moveFocus = (delta: number) => setFocusIndex(current => (current + delta + 2) % 2)
  const answer = async (outcome: 'allowed-once' | 'rejected'): Promise<void> => {
    if (busy) return
    setChoice(outcome)
    setBusy(true)
    setError(undefined)
    try {
      await answerApproval(matched, outcome)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setBusy(false)
    }
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const input: KeyInput = { key: event.key, alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, composing: composing(event), keyCode: event.keyCode, repeat: event.repeat, disabled: busy }
    const decision = resolveKey(interactionProfile, 'approval', input)
    if (decision.kind === 'pass') return
    event.preventDefault()
    if (decision.command === 'cancelTask') { void cancelTask().catch(cause => { setError(cause instanceof Error ? cause.message : String(cause)); setBusy(false) }); return }
    // Refocusing must never leave Enter approving while the reject action is focused.
    if (decision.command === 'activate') void answer(focusedOutcome())
    if (decision.command === 'focusPrevious' || decision.command === 'focusNext') {
      const delta = decision.command === 'focusPrevious' ? -1 : 1
      moveFocus(delta)
    }
  }
  const detail = approvalDetail(matched)
  return <InteractionSurface kind="approval" data-approval-key={matched.key} onKeyDown={onKeyDown} aria-busy={busy}>
    <div className={styles.card}>
      <header className={styles.header}>
        <strong>{t('approval.title')}</strong>
      </header>
      <div className={styles.body} data-testid="approval-scroll" data-approval-scroll tabIndex={0} role="group" aria-label={t('approval.details')}>
        <p className={styles.detail}>{detail.reason ?? detail.toolName}</p>
      </div>
      <div className={styles.actions} data-testid="approval-actions" role="group" aria-label={t('approval.actions')}>
        <button className={styles.approvalReject} ref={node => { actionRefs.current[1] = node }} type="button" disabled={busy} aria-pressed={choice === 'rejected'} onFocus={() => { onActionFocus(1) }} onClick={() => { onActionFocus(1); void answer('rejected') }}>{t('approval.reject')}</button>
        <button className={styles.approvalAllow} ref={node => { actionRefs.current[0] = node }} type="button" disabled={busy} aria-pressed={choice === 'allowed-once'} onFocus={() => { onActionFocus(0) }} onClick={() => { onActionFocus(0); void answer('allowed-once') }}>{t('approval.allowOnce')}</button>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  </InteractionSurface>
}
