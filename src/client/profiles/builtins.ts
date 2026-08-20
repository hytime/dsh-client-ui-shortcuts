import type { ShortcutProfile } from '../contract/profile.js'

const stroke = (key: string) => ({
  key,
  alt: false,
  ctrl: false,
  meta: false,
  shift: false,
})

export const standardProfile: ShortcutProfile = {
  id: 'standard',
  label: 'shortcut.profile.standard.label',
  description: 'shortcut.profile.standard.description',
  bindings: [
    { command: 'focusPrevious', scope: 'question', key: stroke('ArrowUp') },
    { command: 'focusNext', scope: 'question', key: stroke('ArrowDown') },
    { command: 'activate', scope: 'approval', key: stroke('Enter') },
    { command: 'cancelTask', scope: 'question', key: stroke('Escape') },
    { command: 'cancelTask', scope: 'approval', key: stroke('Escape') },
  ],
}

export const vimProfile: ShortcutProfile = {
  id: 'vim',
  label: 'shortcut.profile.vim.label',
  description: 'shortcut.profile.vim.description',
  bindings: [
    { command: 'focusPrevious', scope: 'question', key: stroke('k') },
    { command: 'focusNext', scope: 'question', key: stroke('j') },
    { command: 'activate', scope: 'approval', key: stroke('Enter') },
    { command: 'cancelTask', scope: 'question', key: stroke('Escape') },
    { command: 'cancelTask', scope: 'approval', key: stroke('Escape') },
  ],
}
