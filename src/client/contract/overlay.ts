import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { ShortcutSettingsFace } from './settings.js'
import type { ShortcutPlatform } from './keyboard-visual.js'
import type { GlobalShortcutCommand } from './profile.js'
import type { OverlayControllerFace } from '../overlay/controller.js'

/**
 * `shell.overlay` (root-scope list slot) is declared by DSH's ui-layout
 * package, which is not a peer of this plugin in every supported DSH
 * generation — rc.8 hosted the declaration inside dsh-client-runtime and
 * 0.1.5-alpha.1 hosts it in ui-layout. Both declare the same minimal shape,
 * so this plugin carries its own matching SlotMap merge instead of depending
 * on either owner package.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Frame-wide floating layer; this plugin's shortcuts overlay entry. */
    'shell.overlay': {
      kind: 'list'
      scope: 'root'
    }
  }
}

/** Plain props consumed by the ShortcutOverlay component. */
export interface ShortcutOverlayProps {
  readonly settings: ShortcutSettingsFace
  readonly controller: OverlayControllerFace
  readonly availableGlobalActions: readonly GlobalShortcutCommand[]
  readonly platform: ShortcutPlatform
  readonly t: (key: string) => string
  /**
   * Resolve the element that owned focus before the overlay opened, so closing
   * restores it. The caller captures it (before the search input's autoFocus
   * runs in the React commit phase) rather than the component, whose open
   * effect would already observe the overlay's own focused search box.
   */
  readonly restoreFocus?: () => HTMLElement | null
}
