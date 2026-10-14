import React from 'react'
import type { ShortcutComposerProps } from '../contract/slots.js'
import { QuestionFlow } from './QuestionFlow.js'
import { ApprovalFlow } from './ApprovalFlow.js'
import { isApprovalWait } from '../contract/slots.js'

export function ShortcutComposer({ matched, interactionProfile, t, cancelTask }: ShortcutComposerProps): React.ReactElement {
  return isApprovalWait(matched)
    ? <ApprovalFlow key={matched.key} matched={matched} interactionProfile={interactionProfile} t={t} cancelTask={cancelTask} />
    : <QuestionFlow key={matched.key} matched={matched} interactionProfile={interactionProfile} t={t} cancelTask={cancelTask} />
}
