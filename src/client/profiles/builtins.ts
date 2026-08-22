import type { ShortcutProfile, ShortcutStroke } from '../contract/profile.js'

const stroke = (key: string, modifiers: Partial<ReturnType<typeof makeStroke>> = {}) => makeStroke(key, modifiers)
const makeStroke = (key: string, modifiers: Partial<{ alt: boolean; ctrl: boolean; meta: boolean; shift: boolean }> = {}) => ({
  key, alt: false, ctrl: false, meta: false, shift: false, ...modifiers,
})

const globalBindings = [
  { command: 'openCommandPalette' as const, scope: 'global' as const, key: { key: 'p', modifiers: ['Mod'] } satisfies ShortcutStroke },
  { command: 'openSettings' as const, scope: 'global' as const, key: { key: ',', modifiers: ['Mod'] } satisfies ShortcutStroke },
  { command: 'startSession' as const, scope: 'global' as const, key: { key: 'n', modifiers: ['Mod'] } satisfies ShortcutStroke },
  { command: 'previousSession' as const, scope: 'global' as const, key: { key: 'ArrowUp', modifiers: ['Mod', 'Alt'] } satisfies ShortcutStroke },
  { command: 'nextSession' as const, scope: 'global' as const, key: { key: 'ArrowDown', modifiers: ['Mod', 'Alt'] } satisfies ShortcutStroke },
  { command: 'previousWorkspace' as const, scope: 'global' as const, key: { key: 'ArrowLeft', modifiers: ['Mod', 'Shift'] } satisfies ShortcutStroke },
  { command: 'nextWorkspace' as const, scope: 'global' as const, key: { key: 'ArrowRight', modifiers: ['Mod', 'Shift'] } satisfies ShortcutStroke },
  { command: 'forkSession' as const, scope: 'global' as const, key: { key: 'b', modifiers: ['Mod', 'Shift'] } satisfies ShortcutStroke },
  { command: 'toggleTheme' as const, scope: 'global' as const, key: { key: 'l', modifiers: ['Mod', 'Shift'] } satisfies ShortcutStroke },
]

export const standardProfile: ShortcutProfile = {
  id: 'standard', label: 'profile.standard.label', description: 'profile.standard.description',
  bindings: [
    ...globalBindings,
    { command: 'focusPrevious', scope: 'question', key: stroke('ArrowUp') },
    { command: 'focusNext', scope: 'question', key: stroke('ArrowDown') },
    { command: 'activate', scope: 'question', key: stroke('Enter') },
    { command: 'activate', scope: 'approval', key: stroke('Enter') },
    { command: 'focusPrevious', scope: 'approval', key: stroke('ArrowUp') },
    { command: 'focusNext', scope: 'approval', key: stroke('ArrowDown') },
    { command: 'cancelTask', scope: 'question', key: stroke('Escape') },
    { command: 'cancelTask', scope: 'approval', key: stroke('Escape') },
  ],
}

export const vimProfile: ShortcutProfile = {
  id: 'vim', label: 'profile.vim.label', description: 'profile.vim.description',
  bindings: [
    ...globalBindings,
    { command: 'focusPrevious', scope: 'question', key: stroke('k') },
    { command: 'focusNext', scope: 'question', key: stroke('j') },
    { command: 'activate', scope: 'question', key: stroke('Enter') },
    { command: 'activate', scope: 'approval', key: stroke('Enter') },
    { command: 'focusPrevious', scope: 'approval', key: stroke('k') },
    { command: 'focusNext', scope: 'approval', key: stroke('j') },
    { command: 'cancelTask', scope: 'question', key: stroke('Escape') },
    { command: 'cancelTask', scope: 'approval', key: stroke('Escape') },
  ],
}
