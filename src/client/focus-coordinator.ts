import type { FocusCoordinator, FocusTransition, PendingFocusRequest } from './contract/slots.js'

const externalSelector = 'textarea, input, [contenteditable="true"], [role="dialog"], [aria-modal="true"], [data-popup], [data-popover]'

export function createFocusCoordinator(): FocusCoordinator & { begin: (transition: FocusTransition) => void; dispose: () => void } {
  let transition: FocusTransition | undefined
  let externalOwned = false
  let disposed = false
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    externalOwned = target.closest('[data-interaction-kind]') === null && target.matches(externalSelector)
  }
  document.addEventListener('focusin', onFocusIn, true)
  return {
    begin(next) {
      transition = next
      const active = document.activeElement
      externalOwned = active instanceof Element && active.closest('[data-interaction-kind]') === null && (active.matches(externalSelector) || active.closest('[data-popup], [data-popover], [role="dialog"], [aria-modal="true"], [contenteditable="true"]') !== null)
    },
    ownsExternalFocus: () => externalOwned,
    requestPendingFocus(request: PendingFocusRequest) {
      if (disposed || transition === undefined || request.transition.sessionId !== transition.sessionId || request.transition.key !== transition.key || externalOwned) return
      queueMicrotask(() => {
        if (!disposed && transition?.sessionId === request.transition.sessionId && transition.key === request.transition.key && !externalOwned) request.focus()
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      document.removeEventListener('focusin', onFocusIn, true)
      transition = undefined
    },
  }
}
