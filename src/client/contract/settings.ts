import type { PersistedShortcutBinding } from '../../shortcut-binding-contract.js'

export interface PortableCustomProfile {
  readonly name: string
  readonly bindings: readonly PersistedShortcutBinding[]
}
