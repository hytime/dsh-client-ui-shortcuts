/** Browser context is structurally supplied by the DSH Client runner. */
import { apply, inject } from './apply.js'

export { apply, inject }
export type { ShortcutProfile } from './contract/profile.js'
export type {
  ApprovalWait, QuestionWait, ShortcutWait, ShortcutComposerOwnerProps,
  ShortcutComposerProps, ShortcutProfileCardProps,
} from './contract/slots.js'
export type { ShortcutSettingsFace } from './settings/controller.js'
