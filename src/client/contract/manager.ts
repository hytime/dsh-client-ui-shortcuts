import type { ShortcutSettingsFace } from './settings.js'
import type { ShortcutPlatform } from './keyboard-visual.js'
import type { GlobalShortcutCommand } from './profile.js'

/** Plain props for the manager panel embedded in the overlay. */
export interface ShortcutManagerPanelProps {
  readonly settings: ShortcutSettingsFace
  readonly availableGlobalActions: readonly GlobalShortcutCommand[]
  readonly platform: ShortcutPlatform
  readonly t: (key: string) => string
  /**
   * When embedded in the overlay the built-in legend is suppressed (the overlay's
   * searchable quick-reference table is the single binding list). Standalone use
   * (default false) keeps the legacy built-in legend.
   */
  readonly hideLegend?: boolean
}
