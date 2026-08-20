import React, { useEffect, useRef, useState } from 'react'
import type { ApprovalWait } from '../contract/slots.js'
import type { ShortcutProfile } from '../contract/profile.js'
import { resolveKey } from '../keyboard/resolve.js'
import type { KeyInput } from '../contract/keyboard.js'

const composing = (event: React.KeyboardEvent<HTMLElement>): boolean => event.nativeEvent.isComposing

interface ApprovalFlowProps {
  readonly matched: ApprovalWait
  readonly activeProfile: ShortcutProfile
  readonly t: (key: string) => string
  readonly cancelTask: () => Promise<void>
}

export function ApprovalFlow({ matched, activeProfile, t, cancelTask }: ApprovalFlowProps): React.ReactElement {
  const [choice, setChoice] = useState<'allowed-once' | 'rejected'>('allowed-once')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [focusIndex, setFocusIndex] = useState(0)
  const actionRefs = useRef<Array<HTMLButtonElement | null>>([])
  useEffect(() => { actionRefs.current[focusIndex]?.focus() }, [focusIndex])
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
    const decision = resolveKey(activeProfile, 'approval', input)
    if (decision.kind === 'pass') return
    event.preventDefault()
    if (decision.command === 'cancelTask') { void cancelTask().catch(cause => { setError(cause instanceof Error ? cause.message : String(cause)); setBusy(false) }); return }
    if (decision.command === 'activate') void answer(choice)
    if (decision.command === 'focusPrevious' || decision.command === 'focusNext') {
      const delta = decision.command === 'focusPrevious' ? -1 : 1
      moveFocus(delta)
    }
  }
  return <section data-approval-key={matched.key} onKeyDown={onKeyDown} aria-busy={busy}>
    <div data-approval-scroll tabIndex={0}>{matched.payload.reason ?? matched.payload.toolName}</div>
    <div role="group" aria-label="Approval actions">
      <button ref={node => { actionRefs.current[0] = node }} autoFocus type="button" disabled={busy} aria-pressed={choice === 'allowed-once'} onClick={() => { setFocusIndex(0); void answer('allowed-once') }}>Allow once</button>
      <button ref={node => { actionRefs.current[1] = node }} type="button" disabled={busy} aria-pressed={choice === 'rejected'} onClick={() => { setFocusIndex(1); void answer('rejected') }}>Reject</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
