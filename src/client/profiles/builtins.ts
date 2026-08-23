import type { GlobalShortcutCommand, ShortcutCommand, ShortcutModifier, ShortcutProfile, ShortcutStroke } from '../contract/profile.js'

type GlobalBindingCommand = Extract<ShortcutCommand, GlobalShortcutCommand | 'openCommandPalette' | 'openSettings'>

const stroke = (key: string, modifiers: Partial<ReturnType<typeof makeStroke>> = {}) => makeStroke(key, modifiers)
const makeStroke = (key: string, modifiers: Partial<{ alt: boolean; ctrl: boolean; meta: boolean; shift: boolean }> = {}) => ({
  key, alt: false, ctrl: false, meta: false, shift: false, ...modifiers,
})

function uniqueModifiers(...modifiers: ShortcutModifier[]): ShortcutModifier[] {
  return [...new Set(modifiers)]
}

function globalBinding(command: GlobalBindingCommand, key: string, modifiers: readonly ShortcutModifier[] = []) {
  return { command, scope: 'global' as const, key: { key, modifiers: uniqueModifiers(...modifiers) } }
}

const globalBindings = [
  globalBinding('openCommandPalette', 'p', ['Meta']),
  globalBinding('openSettings', ',', ['Meta']),
  globalBinding('startSession', 'n', ['Meta', 'Alt', 'Shift']),
  globalBinding('previousSession', 'j', ['Meta', 'Alt', 'Shift']),
  globalBinding('nextSession', 'k', ['Meta', 'Alt', 'Shift']),
  globalBinding('previousWorkspace', 'h', ['Meta', 'Alt', 'Shift']),
  globalBinding('nextWorkspace', 'l', ['Meta', 'Alt', 'Shift']),
  globalBinding('forkSession', 'b', ['Meta', 'Alt', 'Shift']),
  globalBinding('toggleTheme', 't', ['Meta', 'Alt', 'Shift']),
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
