/** Shortcut client locale dictionaries. */

export const NS = 'shortcuts'

export const zh = {
  'profile.standard.label': '标准',
  'profile.standard.description': '使用方向键和 Enter 操作问题与审批。',
  'profile.vim.label': 'Vim',
  'profile.vim.description': '使用 j/k 导航，并保留 Enter/Escape 操作。',
  'settings.title': '快捷键',
  'settings.description': '选择问题和审批界面的键盘操作方案。',
  'settings.profile': '快捷键方案',
  'settings.save': '保存方案',
  'settings.saving': '保存中…',
  'settings.error': '快捷键方案保存失败：{message}',
  'keyboard.focusPrevious': '聚焦上一项',
  'keyboard.focusNext': '聚焦下一项',
  'keyboard.activate': '确认当前项',
  'keyboard.cancelTask': '取消当前任务',
  'error.unknownProfile': '未知的快捷键方案',
  'error.saveFailed': '快捷键方案保存失败',
} as const

export const en = {
  'profile.standard.label': 'Standard',
  'profile.standard.description': 'Use arrow keys and Enter for questions and approvals.',
  'profile.vim.label': 'Vim',
  'profile.vim.description': 'Use j/k to navigate, with Enter and Escape actions.',
  'settings.title': 'Shortcuts',
  'settings.description': 'Choose keyboard controls for question and approval surfaces.',
  'settings.profile': 'Shortcut profile',
  'settings.save': 'Save profile',
  'settings.saving': 'Saving…',
  'settings.error': 'Could not save shortcut profile: {message}',
  'keyboard.focusPrevious': 'Focus previous item',
  'keyboard.focusNext': 'Focus next item',
  'keyboard.activate': 'Activate current item',
  'keyboard.cancelTask': 'Cancel current task',
  'error.unknownProfile': 'Unknown shortcut profile',
  'error.saveFailed': 'Could not save shortcut profile',
} satisfies Record<keyof typeof zh, string>

export type ShortcutLocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    shortcuts: ShortcutLocaleKey
  }
}
