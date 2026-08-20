import React from 'react'
import type { ShortcutComposerProps } from '../contract/slots.js'
import { QuestionFlow } from './QuestionFlow.js'
import { ApprovalFlow } from './ApprovalFlow.js'

export function ShortcutComposer({ matched, activeProfile, t, cancelTask }: ShortcutComposerProps): React.ReactElement {
  return matched.kind === 'question'
    ? <QuestionFlow key={matched.key} matched={matched} activeProfile={activeProfile} t={t} cancelTask={cancelTask} />
    : <ApprovalFlow key={matched.key} matched={matched} activeProfile={activeProfile} t={t} cancelTask={cancelTask} />
}
