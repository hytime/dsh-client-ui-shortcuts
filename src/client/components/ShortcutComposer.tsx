import React, { useLayoutEffect } from 'react'
import type { ShortcutComposerProps } from '../contract/slots.js'
import { QuestionFlow } from './QuestionFlow.js'
import { ApprovalFlow } from './ApprovalFlow.js'

export function ShortcutComposer({ matched, activeProfile, t, cancelTask, focusCoordinator }: ShortcutComposerProps): React.ReactElement {
  useLayoutEffect(() => {
    focusCoordinator?.begin({ sessionId: String(matched.sessionId), key: matched.key })
  }, [focusCoordinator, matched.key, matched.sessionId])
  return matched.kind === 'question'
    ? <QuestionFlow key={matched.key} matched={matched} activeProfile={activeProfile} t={t} cancelTask={cancelTask} focusCoordinator={focusCoordinator} />
    : <ApprovalFlow key={matched.key} matched={matched} activeProfile={activeProfile} t={t} cancelTask={cancelTask} focusCoordinator={focusCoordinator} />
}
