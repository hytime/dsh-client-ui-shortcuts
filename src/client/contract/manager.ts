import type { ShortcutSettingsFace } from './settings.js'
import type { ShortcutPlatform } from './keyboard-visual.js'
import type { GlobalShortcutCommand } from './profile.js'

/** Plain props for the manager panel embedded in the overlay. */
export interface ShortcutManagerPanelProps {
  readonly settings: ShortcutSettingsFace
  readonly availableGlobalActions: readonly GlobalShortcutCommand[]
  readonly platform: ShortcutPlatform
  readonly t: (key: string) => string
  readonly initialFocusCommand?: GlobalShortcutCommand
  readonly showUnavailableGlobalActions?: boolean
  readonly onClose?: () => void
}
