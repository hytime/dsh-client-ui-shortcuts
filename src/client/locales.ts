/** Shortcut client locale dictionaries. */

export const NS = 'dsh-shortcuts'

export const zh = {
  'profile.standard.label': '标准',
  'profile.standard.description': '使用方向键和 Enter 操作问题与审批。',
  'profile.vim.label': 'Vim',
  'profile.vim.description': '使用 j/k 导航，并保留 Enter/Escape 操作。',
  'settings.title': '快捷键',
  'settings.description': '选择问题和审批界面的键盘操作方案。',
  'settings.expand': '展开',
  'settings.collapse': '收起',
  'settings.profile': '快捷键方案',
  'settings.saving': '保存中…',
  'settings.error': '快捷键方案保存失败：{message}',
  'settings.conflict': '当前快捷键方案不可用，请重新选择。',
  'settings.empty': '暂无可用的快捷键方案。',
  'legend.scope.question': '问题操作',
  'legend.scope.approval': '审批操作',
  'aria.profileOption': '快捷键方案 {name}',
  'keyboard.focusPrevious': '聚焦上一项',
  'keyboard.focusNext': '聚焦下一项',
  'keyboard.activate': '确认当前项',
  'keyboard.cancelTask': '取消当前任务',
  'error.saveFailed': '快捷键方案保存失败',
  'approval.reject': '拒绝',
  'approval.allowOnce': '允许一次',
  'approval.details': '审批详情',
  'approval.actions': '审批操作',
  'question.custom': '补充说明',
  'question.skip': '跳过',
  'question.next': '下一题',
  'question.submit': '提交',
} as const

export const en = {
  'profile.standard.label': 'Standard',
  'profile.standard.description': 'Use arrow keys and Enter for questions and approvals.',
  'profile.vim.label': 'Vim',
  'profile.vim.description': 'Use j/k to navigate, with Enter and Escape actions.',
  'settings.title': 'Shortcuts',
  'settings.description': 'Choose keyboard controls for question and approval surfaces.',
  'settings.expand': 'Expand',
  'settings.collapse': 'Collapse',
  'settings.profile': 'Shortcut profile',
  'settings.saving': 'Saving…',
  'settings.error': 'Could not save shortcut profile: {message}',
  'settings.conflict': 'The current shortcut profile is unavailable. Choose another profile.',
  'settings.empty': 'No shortcut profiles are available.',
  'legend.scope.question': 'Question actions',
  'legend.scope.approval': 'Approval actions',
  'aria.profileOption': 'Shortcut profile {name}',
  'keyboard.focusPrevious': 'Focus previous item',
  'keyboard.focusNext': 'Focus next item',
  'keyboard.activate': 'Activate current item',
  'keyboard.cancelTask': 'Cancel current task',
  'error.saveFailed': 'Could not save shortcut profile',
  'approval.reject': 'Reject',
  'approval.allowOnce': 'Allow once',
  'approval.details': 'Approval details',
  'approval.actions': 'Approval actions',
  'question.custom': 'Additional details',
  'question.skip': 'Skip',
  'question.next': 'Next',
  'question.submit': 'Submit',
} satisfies Record<keyof typeof zh, string>

export type ShortcutLocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-shortcuts': ShortcutLocaleKey
  }
}
