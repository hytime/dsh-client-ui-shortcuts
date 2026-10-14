import type { ShortcutProfile } from '../contract/profile.js'

/** Fixed local control navigation, active only inside an explicitly enabled interaction. */
export const standardProfile: ShortcutProfile = {
  id: 'standard', label: 'Standard', description: 'Local interaction controls',
  bindings: ['question', 'approval'].flatMap(scope => [
    { command: 'focusPrevious', scope, key: { key: 'ArrowUp', modifiers: [] } },
    { command: 'focusNext', scope, key: { key: 'ArrowDown', modifiers: [] } },
    { command: 'activate', scope, key: { key: 'Enter', modifiers: [] } },
    { command: 'cancelTask', scope, key: { key: 'Escape', modifiers: [] } },
  ]) as ShortcutProfile['bindings'],
}
