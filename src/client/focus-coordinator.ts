import type { FocusCoordinator, FocusTransition, PendingFocusRequest } from './contract/slots.js'

const externalSelector = 'textarea, input, [contenteditable="true"], [role="dialog"], [aria-modal="true"], [data-popup], [data-popover]'

type TransitionToken = {
  readonly transition: FocusTransition
  readonly externalOwned: boolean
}

const isExternalElement = (element: Element | null): boolean => {
  if (element === null) return false
  if (element.closest('[data-interaction-kind]') !== null) return false
  return element.matches(externalSelector) || element.closest(externalSelector) !== null
}

export function createFocusCoordinator(): FocusCoordinator & { begin: (transition: FocusTransition) => void; dispose: () => void } {
  let token: TransitionToken | undefined
  let disposed = false
  const onFocusIn = () => {}
  document.addEventListener('focusin', onFocusIn, true)
  return {
    begin(transition) {
      token = { transition, externalOwned: isExternalElement(document.activeElement) }
    },
    ownsExternalFocus: () => token?.externalOwned === true,
    requestPendingFocus(request: PendingFocusRequest) {
      const current = token
      if (disposed || current === undefined || request.transition.sessionId !== current.transition.sessionId || request.transition.key !== current.transition.key || current.externalOwned) return
      queueMicrotask(() => {
        if (!disposed && token === current && !current.externalOwned) request.focus()
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      token = undefined
      document.removeEventListener('focusin', onFocusIn, true)
    },
  }
}
