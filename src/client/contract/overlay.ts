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
 *
 * `plugins.bundle.config` (keyed) is the same situation one generation later:
 * DSH 0.1.6 declares it in ui-plugin-manager and renders one bundle's
 * configuration on that bundle's detail page, replacing `settings.plugin.item`
 * (which 0.1.6's ui-settings-plugins stopped declaring). The compatibility
 * layer picks between the two, so only one is ever registered and both shapes
 * are carried here rather than borrowed from a peer that moved on.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Frame-wide floating layer; this plugin's shortcuts overlay entry. */
    'shell.overlay': {
      kind: 'list'
      scope: 'root'
    }
    /** One bundle's configuration on its Plugins-page detail page. */
    'plugins.bundle.config': {
      kind: 'keyed'
      scope: 'root'
      owner: PluginConfigViewProps
    }
    /**
     * The Plugins section's configurable-tab seat this plugin used before DSH
     * 0.1.6, keyed by the settings namespace the card edits. The compatibility
     * layer still mounts here when a composition declares it, so the shape is
     * carried locally: 0.1.6's ui-settings-plugins dropped its own declaration,
     * and exactly one of the two seats is ever registered.
     */
    'settings.plugin.item': {
      kind: 'keyed'
      scope: 'root'
    }
  }
}

/** Owner share of a configuration seat: which view the page asks the card for. */
export interface PluginConfigViewProps {
  /** `summary` renders the one-liner alone, as text or inline nodes; `page` renders the full card. */
  readonly view: 'summary' | 'page'
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
  /**
   * Optional command to locate (and focus) when the overlay opens, e.g. from the launch card.
   * Preferred over the controller's focus command when both are present; the launch card
   * path drives the controller instead, so this prop stays optional.
   */
  readonly initialFocusCommand?: GlobalShortcutCommand
}

/** Plain props consumed by the settings-page launch card. */
export interface ShortcutLaunchCardProps {
  readonly settings: ShortcutSettingsFace
  readonly platform: ShortcutPlatform
  readonly t: (key: string) => string
  /** Open the shortcuts manager panel focused on the open-panel row. */
  readonly onOpen: () => void
  /**
   * Which view the bundle-config seat asks for. Absent on the legacy
   * namespace-item seat, whose tab renders the card itself.
   */
  readonly view?: PluginConfigViewProps['view']
}
